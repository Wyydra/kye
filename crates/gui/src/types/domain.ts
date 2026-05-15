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

// ── Values ──────────────────────────────────────────────────────────────────

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

/**
 * Helper to safely extract a value from a Value union.
 * Returns undefined if the value is Null or doesn't have a 'v' property.
 */
export function val<T>(value: Value | undefined): T | undefined {
  if (!value || value.t === "Null") return undefined;
  return (value as any).v as T;
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

// ── Views ───────────────────────────────────────────────────────────────────

export interface ViewDef {
  layout: Layout;
  bindings: Record<string, string>;
  actions: ActionDef[];
}

export type Layout =
  | { t: "Document" }
  | { t: "Canvas" }
  | { t: "Grid"; v: { columns: number } }
  | { t: "Stack"; v: { direction: "horizontal" | "vertical" } }
  | { t: "Gallery" }
  | { t: "Table" }
  | { t: "Kanban"; v: { group_by: string } }
  | { t: "Widget"; v: { name: string } };

export interface ActionDef {
  id: string;
  label: string;
  kind: string;
}

export interface KindDef {
  label: string;
  icon: string;
  title_prop: string;
  view?: ViewDef;
}

// ── Commands & Events ───────────────────────────────────────────────────────

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
  | { type: "node_created"; node: Node; index: number }
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
