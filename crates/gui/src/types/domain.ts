export interface WorkspaceMeta {
  id: string;
  name: string;
}

export interface Graph {
  nodes: Record<string, Node>;
  roots: string[];
}

export interface Node {
  id: string;
  kind: string;
  parent: string | null;
  children: string[];
  props: Record<string, Value>;
  created_at: string;
  updated_at: string;
  view_override?: ViewDef;
}

export type Value =
  | { t: "Null" }
  | { t: "Bool"; v: boolean }
  | { t: "Int"; v: number }
  | { t: "Float"; v: number }
  | { t: "Text"; v: string }
  | { t: "Rich"; v: RichText }
  | { t: "Ref"; v: string }
  | { t: "Array"; v: Value[] }
  | { t: "Date"; v: string }
  | { t: "DateTime"; v: string }
  | { t: "Color"; v: string };

export function val<T>(value: Value | undefined): T | undefined {
  if (!value || value.t === "Null") return undefined;
  return (value as any).v as T;
}

export function valRich(value: Value | undefined): RichText {
  if (!value || value.t === "Null") return { spans: [] };
  if (value.t === "Text") {
    return { spans: [{ text: value.v, marks: [] }] };
  }
  if (value.t === "Rich") {
    return value.v;
  }
  return { spans: [] };
}

export interface RichText {

  spans: Span[];
}

export interface Span {
  text: string;
  marks: Mark[];
}

export type Mark =
  | { t: "Bold" }
  | { t: "Italic" }
  | { t: "Code" }
  | { t: "Strikethrough" }
  | { t: "Underline" }
  | { t: "Link"; v: string }
  | { t: "Color"; v: string }
  | { t: "Ref"; v: string };

export interface ViewDef {
  surface: Surface;
  source: DataSource;
  overlay: ViewOverlay;
  bindings: Record<string, string>;
  actions: ActionDef[];
}

export type Surface =
  | { t: "Document"; v: { layout: DocumentLayout } }
  | { t: "Canvas"; v: { layout: CanvasLayout; diagram_kind: string | null } }
  | { t: "Collection"; v: { layout: CollectionLayout } }
  | { t: "Widget"; v: { name: string } };

export type DocumentLayout =
  | { t: "VerticalStream" }
  | { t: "Columns"; v: { count: number } };

export type CanvasLayout =
  | { t: "Absolute" }
  | { t: "AutoTree" }
  | { t: "ForceDirected" };

export type CollectionLayout =
  | { t: "Table"; v: { columns: string[] } }
  | { t: "Kanban"; v: { group_by: string } }
  | { t: "Gallery" }
  | { t: "List" }
  | { t: "Matrix"; v: { edge_kind: string } };

export type DataSource =
  | { t: "DirectChildren" }
  | { t: "PersistedQuery"; v: { query_node_id: string } }
  | { t: "DualQuery"; v: { row_query_node_id: string; col_query_node_id: string } };

export interface ViewOverlay {
  hidden_edge_kinds: string[];
  focus_node_id?: string | null;
}

export interface NodeOccurrence {
  id: string;
  node_id: string;
  canvas_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  detail_level: "compact" | "full" | "expanded";
}

export interface ActionDef {
  id: string;
  label: string;
  kind: string;
}

export type ValueType =
  | { type: "Bool" }
  | { type: "Int" }
  | { type: "Float" }
  | { type: "Text" }
  | { type: "Rich" }
  | { type: "Ref" }
  | { type: "RefTo"; config: { kind: string } }
  | { type: "OneOf"; config: { options: string[] } }
  | { type: "Array"; config: { item_type: ValueType } }
  | { type: "Optional"; config: { inner_type: ValueType } }
  | { type: "Date" }
  | { type: "DateTime" }
  | { type: "Color" };

export interface PropDef {
  value_type: ValueType;
  required: boolean;
  label?: string;
  description?: string;
}

export type Constraint =
  | { type: "AllowedChildKinds"; config: { kinds: string[] } }
  | { type: "AllowedParentKinds"; config: { kinds: string[] } }
  | { type: "ConnectionSourceKinds"; config: { kinds: string[] } }
  | { type: "ConnectionTargetKinds"; config: { kinds: string[] } }
  | { type: "MaxChildren"; config: { max: number } };

export interface KindDef {
  label: string;
  icon: string;
  title_prop: string;
  view?: ViewDef;
  props?: Record<string, PropDef>;
  constraints?: Constraint[];
}

export type Command =
  | {
      type: "create_node";
      id: string;
      kind: string;
      parent_id: string | null;
      index: number;
      props: Record<string, Value>;
    }
  | { type: "delete_node"; id: string; cascade: boolean }
  | {
      type: "move_node";
      node_id: string;
      new_parent_id: string | null;
      new_index: number;
    }
  | { type: "set_prop"; node_id: string; key: string; value: Value }
  | { type: "delete_prop"; node_id: string; key: string }
  | { type: "set_props"; node_id: string; props: Record<string, Value> }
  | { type: "set_view_override"; node_id: string; view: ViewDef | null }
  | { type: "set_kind"; node_id: string; new_kind: string };

export type Event =
  | { type: "node_created"; node: Node; parent_id: string | null; index: number }
  | {
      type: "node_deleted";
      nodes: Node[];
      old_parent: string | null;
      old_index: number;
    }
  | {
      type: "node_moved";
      node_id: string;
      old_parent: string | null;
      old_index: number;
      new_parent: string | null;
      new_index: number;
    }
  | {
      type: "prop_set";
      node_id: string;
      key: string;
      new_value: Value;
      old_value: Value | null;
    }
  | { type: "prop_deleted"; node_id: string; key: string; old_value: Value }
  | {
      type: "props_set";
      node_id: string;
      changes: [string, Value, Value | null][];
    }
  | {
      type: "view_override_set";
      node_id: string;
      new_view: ViewDef | null;
      old_view: ViewDef | null;
    }
  | { type: "kind_set"; node_id: string; new_kind: string; old_kind: string }
  | { type: "batch"; events: Event[] };

export interface DiffLine {
  type: "add" | "remove" | "info";
  text: string;
}

export interface ReviewableCommand {
  id: string;
  selected: boolean;
  description: string;
  nodeTitle: string;
  cmd: Command;
  diffLines: DiffLine[];
}

export interface SyncDiff {
  local: ReviewableCommand[];
  remote: ReviewableCommand[];
}
