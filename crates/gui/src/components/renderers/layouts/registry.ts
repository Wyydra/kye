import { LayoutComponent } from "./types";

/**
 * Shared registry for layouts to avoid circular dependencies.
 * Components are registered here at boot time.
 */
export const LAYOUT_REGISTRY: Record<string, LayoutComponent> = {};

export function getLayout(type: string): LayoutComponent | undefined {
  return LAYOUT_REGISTRY[type];
}
