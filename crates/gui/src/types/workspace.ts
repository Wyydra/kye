export interface Block {
  id: string;
  shapes: string[];
  fields: Record<string, any>;
  primary_shape: string;
}

export interface Workspace {
  name: string;
  blocks: Block[];
}

export type FieldType = 'boolean' | 'integer' | 'float' | 'string' | 'markdown' | 'image' | 'link' | 'color' | 'blockid';

export interface FieldDefinitionDto {
  name: string;
  field_type: FieldType | string;
  required: boolean;
  label?: string;
  description?: string;
}

export type InteractionAction = 
  | { type: 'update_field', field: string, value: any }
  | { type: 'navigate_to', block_id: string };

export interface WidgetBlueprint {
  type: string;
  props: Record<string, any>;
  bindings: Record<string, string>;
  actions: Record<string, InteractionAction>;
  slots: Record<string, WidgetBlueprint>;
  children: WidgetBlueprint[];
}

export interface TypeDefinitionDto {
  fields: Record<string, {
    type: { kind: string; data?: any };
    required: boolean;
    label?: string;
    description?: string;
  }>;
  layout?: WidgetBlueprint;
}

export interface TemplateDto {
  name: string;
  fields: FieldDefinitionDto[];
  layout?: WidgetBlueprint;
}
