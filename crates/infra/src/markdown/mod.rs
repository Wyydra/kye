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
    fn map_from_markdown(&self, mut fields: domain::models::block::schema::Fields, body: String, sections: std::collections::BTreeMap<String, String>, _registry: &domain::models::block::type_registry::TypeRegistry) -> domain::models::block::schema::Fields {
        // 1. If we have sections, map them to fields
        for (title, content) in sections {
            fields.insert(
                domain::models::block::schema::FieldName::new(&title), 
                domain::models::block::schema::Value::String(content)
            );
        }

        // 2. Ensure title exists (Natural H2 model)
        if fields.get(&domain::models::block::schema::FieldName::new("title")).is_none() {
            fields.insert(
                domain::models::block::schema::FieldName::new("title"),
                domain::models::block::schema::Value::String("Untitled".to_string())
            );
        }

        // 3. Ensure body exists
        fields.insert(
            domain::models::block::schema::FieldName::new("body"), 
            domain::models::block::schema::Value::String(body)
        );
        
        fields
    }

    fn parse_markdown_segments(&self, content: &str) -> (String, std::collections::BTreeMap<String, String>) {
        let mut sections = std::collections::BTreeMap::new();
        let mut body = String::new();
        
        let arena = Arena::new();
        let options = Options::default();
        let root = parse_document(&arena, content, &options);

        let mut current_section: Option<String> = None;
        let mut current_buffer = String::new();
        let mut found_title = false;

        for node in root.children() {
            let n = node.data.borrow();
            match &n.value {
                NodeValue::Heading(h) if h.level == 2 && !found_title => {
                    // First H2 is the TITLE
                    let mut title = String::new();
                    for child in node.children() {
                        let c = child.data.borrow();
                        if let NodeValue::Text(t) = &c.value {
                            title.push_str(t);
                        }
                    }
                    sections.insert("title".to_string(), title.trim().to_string());
                    found_title = true;
                }
                NodeValue::Heading(h) if h.level >= 3 => {
                    // H3 or lower are FIELDS
                    // Save previous section/body
                    if let Some(key) = current_section.take() {
                        sections.insert(key, current_buffer.trim().to_string());
                        current_buffer.clear();
                    } else if !current_buffer.trim().is_empty() {
                        body = current_buffer.trim().to_string();
                        current_buffer.clear();
                    }

                    // Extract heading text for new field
                    let mut field_name = String::new();
                    for child in node.children() {
                        let c = child.data.borrow();
                        if let NodeValue::Text(t) = &c.value {
                            field_name.push_str(t);
                        }
                    }
                    current_section = Some(field_name.trim().to_string());
                }
                _ => {
                    let mut text = String::new();
                    format_commonmark(node, &options, &mut text).unwrap_or_default();
                    current_buffer.push_str(&text);
                }
            }
        }

        // Final cleanup
        if let Some(key) = current_section {
            sections.insert(key, current_buffer.trim().to_string());
        } else if !current_buffer.trim().is_empty() {
            body = current_buffer.trim().to_string();
        }

        (body, sections)
    }

    fn render_block_to_markdown(&self, block: &domain::models::block::Block, registry: &domain::models::block::type_registry::TypeRegistry) -> String {
        let mut draft = String::new();
        
        let mut json_fields = domain::models::block::schema::Fields::new();
        let mut markdown_fields = std::collections::BTreeMap::new();

        // 1. Collect ALL fields required by the block's shapes
        let shapes = registry.identify_block_shapes(block.fields());
        for shape_name in shapes {
            if let Some(def) = registry.get(&shape_name) {
                for field_name in def.fields.keys() {
                    markdown_fields.insert(field_name.to_string(), String::new());
                }
            }
        }

        // 2. Merge with ACTUAL values from the block
        for (name, value) in block.fields().iter() {
            let name_str = name.to_string();
            let is_technical = name_str == "id" || name_str.starts_with('_');

            if is_technical {
                json_fields.insert(name.clone(), value.clone());
            } else {
                let val_str = match value {
                    domain::models::block::schema::Value::None => String::new(),
                    domain::models::block::schema::Value::String(s) => s.clone(),
                    v => v.to_string().trim_matches('"').to_string(),
                };
                markdown_fields.insert(name_str, val_str);
            }
        }

        // 3. Render JSON metadata comment
        let meta_json = crate::metadata::render_json(block.id(), &json_fields);
        draft.push_str(&format!("<!-- {} -->\n", meta_json));

        // 4. Render Markdown content
        // Order: Title (H2), Body (Raw), Fields (H3)
        let mut title = String::new();
        let mut main_content = String::new();
        let mut other_sections = Vec::new();

        for (name, content) in markdown_fields {
            if name == "title" {
                title = content;
            } else if name == "body" {
                main_content = content;
            } else {
                other_sections.push((name, content));
            }
        }

        // Write Title
        if !title.is_empty() {
            draft.push_str(&format!("## {}\n", title));
        } else {
            draft.push_str("## Untitled\n");
        }

        // Write main content (body)
        if !main_content.is_empty() {
            draft.push_str(&format!("\n{}\n", main_content));
        }

        // Write other sections
        for (name, content) in other_sections {
            draft.push_str(&format!("\n### {}\n\n{}\n", name, content));
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
                                    let fields = self.map_from_markdown(fields, body, sections, _registry);
                                    
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
                    let fields = self.map_from_markdown(fields, body, sections, _registry);
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

    async fn delete_type(
        &self,
        name: &domain::models::block::schema::TypeName,
    ) -> Result<(), anyhow::Error> {
        let file_path = self.dir_path.join(domain::KYE_DIR).join("types").join(format!("{}.json", name));
        if file_path.exists() {
            fs::remove_file(file_path)?;
        }
        Ok(())
    }
}
