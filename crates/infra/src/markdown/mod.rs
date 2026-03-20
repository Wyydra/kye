use std::fs;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::{Arc, RwLock};
use std::collections::HashMap;

use uuid::Uuid;
use walkdir::WalkDir;

use domain::{
    models::{
        workspace::{Workspace, WorkspaceName, SaveWorkspaceError},
        block::{Block, Content, Metadata},
    },
    ports::WorkspaceRepository,
};

use comrak::{Arena, Options, parse_document, format_commonmark};
use comrak::nodes::NodeValue;

#[derive(Debug, Clone)]
pub struct DirectoryWorkspaceRepository {
    dir_path: PathBuf,
    // Maps each Block ID to the file it was loaded from
    block_index: Arc<RwLock<HashMap<Uuid, PathBuf>>>,
    // Stores the introductory text (H1, paragraphs) before the first block for each file
    file_prefixes: Arc<RwLock<HashMap<PathBuf, String>>>,
    // Default file for new blocks
    default_inbox_file: PathBuf,
}

impl DirectoryWorkspaceRepository {
    pub fn new(dir_path: PathBuf) -> Self {
        let default_inbox_file = dir_path.join("inbox.md");
        Self { 
            dir_path,
            block_index: Arc::new(RwLock::new(HashMap::new())),
            file_prefixes: Arc::new(RwLock::new(HashMap::new())),
            default_inbox_file,
        }
    }
}

impl WorkspaceRepository for DirectoryWorkspaceRepository {
    async fn load_workspace(&self) -> Result<Workspace, anyhow::Error> {
        let workspace_name = self.dir_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Sans titre")
            .to_string();
        
        let mut blocks = Vec::new();
        
        let mut new_index = HashMap::new();
        let mut new_prefixes = HashMap::new();

        if !self.dir_path.exists() {
            fs::create_dir_all(&self.dir_path)?;
        }

        // On itère sur tous les fichiers .md (y compris index.md)
        for entry in WalkDir::new(&self.dir_path).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                let content = fs::read_to_string(path)?;
                let arena = Arena::new();
                let options = Options::default();
                let root = parse_document(&arena, &content, &options);

                let mut current_block_id: Option<Uuid> = None;
                let mut current_metadata = String::new();
                let mut current_content = String::new();
                let mut prefix_draft = String::new();
                let mut found_first_block = false;

                for node in root.children() {
                    let n = node.data.borrow();
                    match &n.value {
                        NodeValue::HtmlBlock(html) => {
                            let mut is_block_metadata = false;
                            if let Some(next) = node.next_sibling() {
                                if let NodeValue::Heading(h) = &next.data.borrow().value {
                                    if h.level == 2 {
                                        is_block_metadata = true;
                                    }
                                }
                            }

                            if is_block_metadata {
                                found_first_block = true;
                                if let Some(id) = current_block_id.take() {
                                    blocks.push(Block::new(id, Content::new(current_content.trim()), Metadata::new(&current_metadata)));
                                    new_index.insert(id, path.to_path_buf());
                                    current_content.clear();
                                    current_metadata.clear();
                                }
                                let text = html.literal.trim();
                                if text.starts_with("<!--") && text.ends_with("-->") {
                                    current_metadata = text.trim_start_matches("<!--").trim_end_matches("-->").trim().to_string();
                                }
                            } else {
                                let mut text = String::new();
                                format_commonmark(node, &options, &mut text).unwrap_or_default();
                                if current_block_id.is_some() {
                                    current_content.push_str(&text);
                                } else if !found_first_block {
                                    prefix_draft.push_str(&text);
                                }
                            }
                        },
                        NodeValue::Heading(h) if h.level == 2 => {
                            found_first_block = true;
                            if let Some(id) = current_block_id.take() {
                                blocks.push(Block::new(id, Content::new(current_content.trim()), Metadata::new(&current_metadata)));
                                new_index.insert(id, path.to_path_buf());
                                current_content.clear();
                                current_metadata.clear();
                            }

                            let mut text = String::new();
                            format_commonmark(node, &options, &mut text).unwrap_or_default();
                            let s = text.replace("## ", "").trim().to_string();
                            
                            if let Ok(id) = Uuid::from_str(&s) {
                                current_block_id = Some(id);
                            } else {
                                current_block_id = Some(Uuid::new_v4());
                            }
                        },
                        _ => {
                            let mut text = String::new();
                            format_commonmark(node, &options, &mut text).unwrap_or_default();
                            
                            if current_block_id.is_some() {
                                current_content.push_str(&text);
                            } else if !found_first_block {
                                prefix_draft.push_str(&text);
                            }
                        }
                    }
                }

                if let Some(id) = current_block_id.take() {
                    blocks.push(Block::new(id, Content::new(current_content.trim()), Metadata::new(&current_metadata)));
                    new_index.insert(id, path.to_path_buf());
                }
                
                // On sauvegarde le "Frontmatter" / texte d'intro du fichier
                new_prefixes.insert(path.to_path_buf(), prefix_draft);
            }
        }

        // Met à jour les index atomiquement (Write Lock)
        {
            let mut index_guard = self.block_index.write().map_err(|_| anyhow::anyhow!("Poison error"))?;
            *index_guard = new_index;
            
            let mut pref_guard = self.file_prefixes.write().map_err(|_| anyhow::anyhow!("Poison error"))?;
            *pref_guard = new_prefixes;
        }

        let ws_id = Uuid::new_v4();
        let ws_name = WorkspaceName::new(&workspace_name).map_err(|e| anyhow::anyhow!("Name error: {}", e))?;
        
        Ok(Workspace::new(ws_id, ws_name, blocks))
    }

    async fn save_workspace(&self, workspace: &Workspace) -> Result<(), SaveWorkspaceError> {
        // SOLUTION 3: On clone les map depuis le ReadLock et on relâche le Lock tout de suite !
        // Comme ça, pas de goulot d'étranglement pendant l'écriture sur le disque.
        let (files_to_write, prefixes) = {
            let index_guard = self.block_index.read().map_err(|_| SaveWorkspaceError::Unknown(anyhow::anyhow!("Poison error")))?;
            let pref_guard = self.file_prefixes.read().map_err(|_| SaveWorkspaceError::Unknown(anyhow::anyhow!("Poison error")))?;
            
            let mut fw: HashMap<PathBuf, Vec<Block>> = HashMap::new();
            for block in workspace.blocks() {
                let path = index_guard.get(block.id()).unwrap_or(&self.default_inbox_file).clone();
                fw.entry(path).or_default().push(block.clone()); // Block hérite de Clone!
            }
            (fw, pref_guard.clone())
        };

        for (path, blocks) in files_to_write {
            let mut draft = String::new();
            
            // SOLUTION 1: On réinjecte le texte d'intro du fichier (qui contient le H1) !
            if let Some(prefix) = prefixes.get(&path) {
                draft.push_str(prefix);
            }

            for block in blocks {
                let meta = block.metadata().to_string();
                if !meta.is_empty() {
                    draft.push_str(&format!("<!-- {} -->\n", meta));
                }
                draft.push_str(&format!("## {}\n", block.id()));
                draft.push_str(&format!("{}\n\n", block.content()));
            }

            let arena = Arena::new();
            let options = Options::default();
            let root = parse_document(&arena, &draft, &options);

            let mut final_output = String::new();
            format_commonmark(root, &options, &mut final_output)
                .map_err(|e| SaveWorkspaceError::Unknown(anyhow::anyhow!("Format error: {}", e)))?;

            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| SaveWorkspaceError::Unknown(e.into()))?;
            }

            fs::write(&path, final_output)
                .map_err(|e| SaveWorkspaceError::Unknown(e.into()))?;
        }

        Ok(())
    }
}
