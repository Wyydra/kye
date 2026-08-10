import React from "react";
import { Node, Surface } from "../../../types/domain";

export interface SurfaceProps {
  node: Node;
  surface: Surface;
  depth: number;
}

export type SurfaceComponent = React.FC<SurfaceProps>;

export const SURFACE_REGISTRY: Record<string, SurfaceComponent> = {};

export function registerSurface(type: string, component: SurfaceComponent) {
  SURFACE_REGISTRY[type] = component;
}

export function getSurface(type: string): SurfaceComponent | undefined {
  return SURFACE_REGISTRY[type];
}
