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

export type Metadata = Record<string, any>;

export interface FieldDefinitionDto {
  name: string;
  field_type: string;
}

export interface TemplateDto {
  name: string;
  fields: FieldDefinitionDto[];
}
