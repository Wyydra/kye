export interface Block {
  id: string;
  content: string;
  metadata: string;
  shapes: string[];
  source: string;
}

export interface Workspace {
  name: string;
  blocks: Block[];
}

export interface FieldDefinitionDto {
  name: string;
  field_type: 'String' | 'Integer' | 'Float' | 'Boolean' | 'Markdown' | 'Url' | 'Color' | 'BlockId' | string;
}

export interface InteractionAction {
  type: 'update_field';
  field: string;
  value: any;
}

export interface WidgetBlueprint {
  type: 'stack' | 'grid' | 'markdown' | 'text' | 'button' | 'flipCard' | 'link';
  direction?: 'vertical' | 'horizontal';
  columns?: number;
  bind?: string;
  value?: string;
  style?: string;
  label?: string;
  onClick?: InteractionAction;
  children?: WidgetBlueprint[];
  front?: WidgetBlueprint;
  back?: WidgetBlueprint;
}

export interface TemplateDto {
  name: string;
  fields: FieldDefinitionDto[];
  layout?: WidgetBlueprint;
}
