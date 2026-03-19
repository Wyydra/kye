use std::fs;
use std::str::FromStr;
use uuid::Uuid;

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
pub struct ComrakMarkdownRepository {
    path: std::path::PathBuf,
}

impl ComrakMarkdownRepository {
    pub fn new(path: std::path::PathBuf) -> Self {
        Self { path }
    }
}

impl WorkspaceRepository for ComrakMarkdownRepository {
    async fn load_workspace(&self) -> Result<Workspace, anyhow::Error> {
        let content = fs::read_to_string(&self.path)?;
        let arena = Arena::new();
        let options = Options::default();
        let root = parse_document(&arena, &content, &options);

        let mut workspace_name = String::from("Sans titre");
        let mut blocks = Vec::new();

        let mut current_block_id: Option<Uuid> = None;
        let mut current_metadata = String::new();
        let mut current_content = String::new();

        for node in root.children() {
            let n = node.data.borrow();
            match &n.value {
                NodeValue::Heading(h) if h.level == 1 => {
                    let mut text = String::new();
                    format_commonmark(node, &options, &mut text).map_err(|e| anyhow::anyhow!("format error: {}", e))?;
                    let s = text.replace("# ", "").trim().to_string();
                    if !s.is_empty() {
                        workspace_name = s;
                    }
                },
                NodeValue::HtmlBlock(html) => {
                    // On regarde le noeud SUIVANT pour savoir si c'est la metadata du BLOC 
                    // ou si c'est juste un sous-bloc (liste, paragraphe, etc.)
                    let mut is_block_metadata = false;
                    if let Some(next) = node.next_sibling() {
                        if let NodeValue::Heading(h) = &next.data.borrow().value {
                            if h.level == 2 {
                                is_block_metadata = true;
                            }
                        }
                    }

                    if is_block_metadata {
                        // 1. C'est le VRAI début d'un nouveau bloc ! On sauvegarde l'ancien.
                        if let Some(id) = current_block_id.take() {
                            blocks.push(Block::new(id, Content::new(current_content.trim()), Metadata::new(&current_metadata)));
                            current_content.clear();
                            current_metadata.clear();
                        }

                        // 2. On lit la nouvelle metadata
                        let text = html.literal.trim();
                        if text.starts_with("<!--") && text.ends_with("-->") {
                            current_metadata = text.trim_start_matches("<!--").trim_end_matches("-->").trim().to_string();
                        }
                    } else {
                        // C'est un sous-bloc (ou une simple note HTML). On le garde dans le content.
                        if current_block_id.is_some() {
                            let mut text = String::new();
                            format_commonmark(node, &options, &mut text).map_err(|e| anyhow::anyhow!("format error: {}", e))?;
                            current_content.push_str(&text);
                        }
                    }
                },
                NodeValue::Heading(h) if h.level == 2 => {
                    // Si on n'a PAS eu de meta HTML juste avant, current_block_id est toujours Some.
                    // Donc il faut fermer le bloc précédent ICI.
                    if let Some(id) = current_block_id.take() {
                        blocks.push(Block::new(id, Content::new(current_content.trim()), Metadata::new(&current_metadata)));
                        current_content.clear();
                        current_metadata.clear();
                    }

                    let mut text = String::new();
                    format_commonmark(node, &options, &mut text).map_err(|e| anyhow::anyhow!("format error: {}", e))?;
                    let s = text.replace("## ", "").trim().to_string();
                    
                    if let Ok(id) = Uuid::from_str(&s) {
                        current_block_id = Some(id);
                    } else {
                        current_block_id = Some(Uuid::new_v4());
                    }
                },
                _ => {
                    // On accumule le texte si on a commencé un bloc SAUF si c'est un noeud vide
                    if current_block_id.is_some() {
                        let mut text = String::new();
                        format_commonmark(node, &options, &mut text).map_err(|e| anyhow::anyhow!("format error: {}", e))?;
                        current_content.push_str(&text);
                    }
                }
            }
        }

        if let Some(id) = current_block_id.take() {
            blocks.push(Block::new(id, Content::new(current_content.trim()), Metadata::new(&current_metadata)));
        }

        let ws_id = Uuid::new_v4();
        let ws_name = WorkspaceName::new(&workspace_name).map_err(|e| anyhow::anyhow!("Name error: {}", e))?;
        
        Ok(Workspace::new(ws_id, ws_name, blocks))
    }

    async fn save_workspace(&self, workspace: &Workspace) -> Result<(), SaveWorkspaceError> {
        // 1. On fabrique le brouillon brut
        let mut draft = String::new();

        // Ajout du titre du workspace en H1
        draft.push_str(&format!("# {}\n\n", workspace.name()));

        for block in workspace.blocks() {
            let meta = block.metadata().to_string();
            if !meta.is_empty() {
                draft.push_str(&format!("<!-- {} -->\n", meta));
            }
            draft.push_str(&format!("## {}\n", block.id()));
            draft.push_str(&format!("{}\n\n", block.content()));
        }

        // 2. On utilise comrak pour parser ce brouillon en AST structuré, 
        // ce qui gère automatiquement le Markdown brut enfoui dans les "content"
        let arena = Arena::new();
        let options = Options::default();
        let root = parse_document(&arena, &draft, &options);

        // 3. On reformate l'AST complet avec comrak pour obtenir 
        // un Markdown propre, normalisé et canonique
        let mut final_output = String::new();
        format_commonmark(root, &options, &mut final_output)
            .map_err(|e| SaveWorkspaceError::Unknown(anyhow::anyhow!("Format error: {}", e)))?;

        fs::write(&self.path, final_output)
            .map_err(|e| SaveWorkspaceError::Unknown(e.into()))?;

        Ok(())
    }
}
