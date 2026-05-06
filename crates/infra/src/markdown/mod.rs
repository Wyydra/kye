use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use uuid::Uuid;
use walkdir::WalkDir;

use domain::{
    models::{
        workspace::SaveWorkspaceError,
    },
    ports::{WorkspaceRepository},
};

use comrak::nodes::NodeValue;
use comrak::{Arena, Options, format_commonmark, parse_document};

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

impl DirectoryWorkspaceRepository {
    fn separate_fields(&self, fields: &domain::models::block::schema::Fields) -> (domain::models::block::schema::Fields, domain::models::block::schema::Fields) {
        let mut system = domain::models::block::schema::Fields::new();
        let mut content = domain::models::block::schema::Fields::new();
        
        for (name, value) in fields.iter() {
            let name_str = name.to_string();
            // Fields starting with _ or specific layout/system fields are hidden in JSON
            if name_str.starts_with('_') || ["x", "y", "width", "height", "type"].contains(&name_str.as_str()) {
                system.insert(name.clone(), value.clone());
            } else {
                content.insert(name.clone(), value.clone());
            }
        }
        (system, content)
    }

    fn map_from_markdown(
        &self,
        base_fields: domain::models::block::schema::Fields,
        body: String,
        sections: std::collections::BTreeMap<String, String>,
    ) -> domain::models::block::schema::Fields {
        let mut fields = base_fields.clone();
        
        if !body.is_empty() {
            fields.insert(
                domain::models::block::schema::FieldName::new("body"),
                domain::models::block::schema::Value::String(body)
            );
        }

        for (title, content) in sections {
            fields.insert(
                domain::models::block::schema::FieldName::new(&title), 
                domain::models::block::schema::Value::String(content)
            );
        }
        
        fields
    }

    fn map_to_markdown(
        &self,
        fields: &domain::models::block::schema::Fields,
    ) -> (String, std::collections::BTreeMap<String, String>, domain::models::block::schema::Fields) {
        let mut body = String::new();
        let mut sections = std::collections::BTreeMap::new();
        let mut frontmatter_fields = domain::models::block::schema::Fields::new();

        for (name, value) in fields.iter() {
            let name_str = name.to_string();
            if name_str == "title" { continue; }

            match value {
                domain::models::block::schema::Value::String(s) => {
                    if name_str == "body" || name_str == "content" {
                        body = s.clone();
                    } else if s.contains('\n') || s.len() > 100 {
                        sections.insert(name_str, s.clone());
                    } else {
                        frontmatter_fields.insert(name.clone(), value.clone());
                    }
                }
                _ => {
                    frontmatter_fields.insert(name.clone(), value.clone());
                }
            }
        }
        
        (body, sections, frontmatter_fields)
    }

    fn parse_markdown_segments(&self, content: &str) -> (String, std::collections::BTreeMap<String, String>) {
        let mut sections = std::collections::BTreeMap::new();
        let mut body;

        let parts: Vec<&str> = content.split("\n### ").collect();
        if parts.len() > 1 {
            body = parts[0].trim().to_string();
            for part in &parts[1..] {
                if let Some((title, content)) = part.split_once('\n') {
                    sections.insert(title.trim().to_string(), content.trim().to_string());
                } else {
                    sections.insert(part.trim().to_string(), String::new());
                }
            }
        } else {
            body = content.trim().to_string();
        }

        // Clean title heading if present
        if body.starts_with("## ") {
            if let Some(newline_idx) = body.find('\n') {
                body = body[newline_idx..].trim().to_string();
            } else {
                body = String::new();
            }
        }

        (body, sections)
    }

    fn render_block_to_markdown(&self, block: &domain::models::block::Block, _registry: &domain::models::block::type_registry::TypeRegistry) -> String {
        let mut draft = String::new();
        
        let (system, content) = self.separate_fields(block.fields());
        let (body, sections, extra_meta) = self.map_to_markdown(&content);
        
        let mut meta_fields = system.clone();
        for (name, val) in extra_meta.iter() {
            meta_fields.insert(name.clone(), val.clone());
        }

        let meta_json = crate::metadata::render_json(block.id(), &meta_fields);
        draft.push_str(&format!("<!-- {} -->\n", meta_json));
        
        let title = block.fields().get(&domain::models::block::schema::FieldName::new("title"))
            .and_then(|v| if let domain::models::block::schema::Value::String(s) = v { Some(s.as_str()) } else { None })
            .unwrap_or("Sans titre");
        
        draft.push_str(&format!("## {}\n", title));
        
        if !body.is_empty() { draft.push_str(&format!("{}\n", body)); }
        
        for (title, content) in sections {
            draft.push_str(&format!("\n### {}\n{}\n", title, content));
        }
        draft.push_str("\n");
        draft
    }
}

impl WorkspaceRepository for DirectoryWorkspaceRepository {
    async fn load_workspace(&self, _registry: &domain::models::block::type_registry::TypeRegistry) -> Result<domain::models::workspace::Workspace, anyhow::Error> {
        let workspace_name = self
            .dir_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Sans titre")
            .to_string();

        let mut blocks_map: HashMap<Uuid, domain::models::block::Block> = HashMap::new();
        let mut new_index = HashMap::new();
        let mut new_prefixes = HashMap::new();

        if !self.dir_path.exists() {
            fs::create_dir_all(&self.dir_path)?;
        }

        for entry in WalkDir::new(&self.dir_path)
            .into_iter()
            .filter_entry(|e| !e.file_name().to_str().map(|s| s == domain::KYE_DIR).unwrap_or(false))
            .filter_map(|e| e.ok())
        {
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
                            let text = html.literal.trim();
                            if text.starts_with("<!--") && text.ends_with("-->") {
                                if let Some(id) = current_block_id.take() {
                                    let fields = crate::metadata::JsonMetadataProvider(current_metadata.clone()).get_fields().unwrap_or_default();
                                    let (body, sections) = self.parse_markdown_segments(&current_content);
                                    let fields = self.map_from_markdown(fields, body, sections);
                                    
                                    let block = domain::models::block::Block::new(id, fields);
                                    blocks_map.insert(id, block);
                                    new_index.insert(id, path.to_path_buf());
                                    current_content.clear();
                                }

                                found_first_block = true;
                                let raw_meta = text.trim_start_matches("<!--").trim_end_matches("-->").trim().to_string();
                                current_metadata = raw_meta.clone();
                                current_block_id = crate::metadata::JsonMetadataProvider(raw_meta).get_id();
                            } else {
                                let mut text = String::new();
                                format_commonmark(node, &options, &mut text).unwrap_or_default();
                                if current_block_id.is_some() { current_content.push_str(&text); }
                                else if !found_first_block { prefix_draft.push_str(&text); }
                            }
                        }
                        _ => {
                            let mut text = String::new();
                            format_commonmark(node, &options, &mut text).unwrap_or_default();
                            if current_block_id.is_some() { current_content.push_str(&text); }
                            else if !found_first_block { prefix_draft.push_str(&text); }
                        }
                    }
                }

                if let Some(id) = current_block_id.take() {
                    let fields = crate::metadata::JsonMetadataProvider(current_metadata.clone()).get_fields().unwrap_or_default();
                    let (body, sections) = self.parse_markdown_segments(&current_content);
                    let fields = self.map_from_markdown(fields, body, sections);
                    let block = domain::models::block::Block::new(id, fields);
                    blocks_map.insert(id, block);
                    new_index.insert(id, path.to_path_buf());
                }
                new_prefixes.insert(path.to_path_buf(), prefix_draft);
            }
        }

        {
            let mut index_guard = self.block_index.write().unwrap();
            *index_guard = new_index;
            let mut pref_guard = self.file_prefixes.write().unwrap();
            *pref_guard = new_prefixes;
        }

        let blocks: Vec<_> = blocks_map.into_values().collect();
        let name = domain::models::workspace::WorkspaceName::new(&workspace_name).unwrap_or_else(|_| domain::models::workspace::WorkspaceName::new("Sans titre").unwrap());
        Ok(domain::models::workspace::Workspace::new(Uuid::new_v4(), name, blocks))
    }

    async fn save_workspace(&self, workspace: &domain::models::workspace::Workspace, registry: &domain::models::block::type_registry::TypeRegistry) -> Result<(), SaveWorkspaceError> {
        let (files_to_write, prefixes) = {
            let index_guard = self.block_index.read().unwrap();
            let pref_guard = self.file_prefixes.read().unwrap();

            let mut fw: HashMap<PathBuf, Vec<Uuid>> = HashMap::new();
            for block in workspace.blocks() {
                let path = index_guard.get(block.id()).unwrap_or(&self.default_inbox_file).clone();
                fw.entry(path).or_default().push(*block.id());
            }
            (fw, pref_guard.clone())
        };

        for (path, block_ids) in files_to_write {
            let mut draft = String::new();
            if let Some(prefix) = prefixes.get(&path) { draft.push_str(prefix); }

            for id in block_ids {
                if let Some(block) = workspace.blocks().iter().find(|b| *b.id() == id) {
                    draft.push_str(&self.render_block_to_markdown(block, registry));
                }
            }

            let arena = Arena::new();
            let options = Options::default();
            let root = parse_document(&arena, &draft, &options);
            let mut final_output = String::new();
            format_commonmark(root, &options, &mut final_output).map_err(|e| SaveWorkspaceError::Unknown(e.into()))?;

            if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| SaveWorkspaceError::Unknown(e.into()))?; }
            fs::write(&path, final_output).map_err(|e| SaveWorkspaceError::Unknown(e.into()))?;
        }

        Ok(())
    }
}

impl domain::ports::TypeRepository for DirectoryWorkspaceRepository {
    async fn load_types(&self) -> Result<std::collections::BTreeMap<domain::models::block::schema::TypeName, domain::models::block::schema::TypeDefinition>, anyhow::Error> {
        crate::types::TypeLoader::load_from_dir(&self.dir_path)
    }

    async fn save_type(
        &self,
        name: &domain::models::block::schema::TypeName,
        definition: &domain::models::block::schema::TypeDefinition,
    ) -> Result<(), anyhow::Error> {
        let types_dir = self.dir_path.join(domain::KYE_DIR).join("types");
        if !types_dir.exists() {
            fs::create_dir_all(&types_dir)?;
        }

        let file_path = types_dir.join(format!("{}.json", name));
        let dto = crate::types::dto::TypeDefinitionDto::from_domain(definition);
        let content = serde_json::to_string_pretty(&dto)?;
        fs::write(file_path, content)?;
        
        Ok(())
    }
}
