import { Node, KindDef, ActionDef } from "../types/domain";
import { execute } from "./commands";
import { useUIStore } from "../store/uiStore";

export interface ActionContext {
  nodeId: string;
  node: Node;
  kindDef?: KindDef;
}

type CustomActionHandler = (action: ActionDef, ctx: ActionContext) => Promise<void> | void;

const customActionRegistry: Map<string, CustomActionHandler> = new Map();

/**
 * Register a programmable action handler (e.g. for user scripts, plugins, or extensions).
 */
export function registerCustomAction(actionName: string, handler: CustomActionHandler): void {
  customActionRegistry.set(actionName, handler);
}

/**
 * Dispatch and execute any declarative or user-programmed action on a block.
 */
export async function executeBlockAction(action: ActionDef, ctx: ActionContext): Promise<void> {
  const kind = action.kind;

  // 1. Declarative Toggle Property Action (e.g. toggle_prop:checked)
  if (kind.startsWith("toggle_prop:")) {
    const propKey = kind.replace("toggle_prop:", "");
    const currentVal = ctx.node.props[propKey]?.t === "Bool" ? (ctx.node.props[propKey] as any).v : false;
    execute({
      type: "set_prop",
      node_id: ctx.nodeId,
      key: propKey,
      value: { t: "Bool", v: !currentVal },
    });
    return;
  }

  // 2. Declarative Navigation Action (e.g. navigate_to:<id>)
  if (kind.startsWith("navigate_to:")) {
    const targetId = kind.replace("navigate_to:", "");
    useUIStore.getState().openBuffer(targetId);
    return;
  }

  // 3. Open in Canvas Action
  if (kind === "open_canvas") {
    useUIStore.getState().openBuffer(ctx.nodeId);
    useUIStore.getState().setActiveViewMode("graph");
    return;
  }

  // 4. User Programmable Action Hook (Script / Plugin Extension)
  const customHandler = customActionRegistry.get(kind);
  if (customHandler) {
    try {
      await customHandler(action, ctx);
    } catch (e) {
      console.error(`Error executing custom action "${kind}":`, e);
    }
    return;
  }

  console.info(`[ActionDispatcher] Action triggered: ${action.label} (${kind}) on node ${ctx.nodeId}`);
}
