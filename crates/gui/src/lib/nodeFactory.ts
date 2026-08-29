import { useGraphStore } from "../store/graphStore";
import { useUIStore } from "../store/uiStore";
import { execute } from "./commands";
import { Value } from "../types/domain";

export interface CreateNodeOptions {
  kind: string;
  parentId?: string | null;
  position?: { x: number; y: number };
  title?: string;
  initialProps?: Record<string, Value>;
  openBuffer?: boolean;
}

/**
 * Universally creates a new node in the graph with dynamically populated
 * default properties conforming to its registered KindDef schema.
 *
 * Used by Sidebar (+ New), Canvas (Double Click / Context Menu),
 * BufferBar, Quick Capture, and Slash Commands.
 */
export async function createNode({
  kind,
  parentId = null,
  position,
  title,
  initialProps = {},
  openBuffer = true,
}: CreateNodeOptions): Promise<string> {
  const state = useGraphStore.getState();
  const kindDef = state.kinds[kind];
  const newId = crypto.randomUUID();

  // Compute children index
  const childrenList = parentId
    ? state.nodes[parentId]?.children || []
    : state.roots;
  const nextIndex = childrenList.length;

  // Dynamically initialize props from schema
  const props: Record<string, Value> = { ...initialProps };

  // 1. Position coordinates (if created on canvas)
  if (position) {
    props.x = { t: "Float", v: position.x };
    props.y = { t: "Float", v: position.y };
  }

  // 2. Title property (if schema specifies title_prop or if given)
  const titleKey = kindDef?.title_prop || "title";
  if (!props[titleKey]) {
    const defaultTitle =
      title ||
      (kind === "core.page"
        ? "Untitled Page"
        : `New ${kindDef?.label || "Block"}`);
    props[titleKey] = { t: "Text", v: defaultTitle };
  }

  // 3. Initialize default empty values for required props if defined in kindDef
  if (kindDef?.props) {
    for (const [propKey, propDef] of Object.entries(kindDef.props)) {
      if (!props[propKey]) {
        const vType = propDef.value_type?.type;
        if (vType === "Bool") {
          props[propKey] = { t: "Bool", v: false };
        } else if (vType === "Int") {
          props[propKey] = { t: "Int", v: 0 };
        } else if (vType === "Float") {
          props[propKey] = { t: "Float", v: 0.0 };
        } else if (vType === "Rich") {
          props[propKey] = { t: "Rich", v: { spans: [] } };
        }
      }
    }
  }

  // Execute canonical domain command
  await execute({
    type: "create_node",
    id: newId,
    kind,
    parent_id: parentId,
    index: nextIndex,
    props,
  });

  // Open in buffer if requested
  if (openBuffer) {
    useUIStore.getState().openBuffer(newId);
  }

  return newId;
}

/**
 * Helper to create a child block under a given parent node.
 */
export async function createChildNode(
  parentId: string,
  kind: string,
  options?: Omit<CreateNodeOptions, "kind" | "parentId">
): Promise<string> {
  return createNode({
    kind,
    parentId,
    ...options,
  });
}

/**
 * Helper to create a spatial node positioned on a canvas.
 */
export async function createCanvasNode(
  kind: string,
  x: number,
  y: number,
  parentId: string | null = null,
  options?: Omit<CreateNodeOptions, "kind" | "parentId" | "position">
): Promise<string> {
  return createNode({
    kind,
    parentId,
    position: { x, y },
    openBuffer: false,
    ...options,
  });
}
