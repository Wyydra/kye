import { LayoutComponent } from "./types";

export const LAYOUT_REGISTRY: Record<string, LayoutComponent> = {};

export function getLayout(type: string): LayoutComponent | undefined {
  return LAYOUT_REGISTRY[type];
}
