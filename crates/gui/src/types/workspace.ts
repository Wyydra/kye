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
