export interface Block {
  id: string;
  content: string;
  metadata: string;
  shapes: string[];
}

export interface Workspace {
  name: string;
  blocks: Block[];
}

export interface FieldDefinitionDto {
  name: string;
  field_type: 'String' | 'Integer' | 'Float' | 'Boolean' | 'Markdown' | 'Url' | 'Color' | 'BlockId' | string;
}

export interface TemplateDto {
  name: string;
  fields: FieldDefinitionDto[];
}
