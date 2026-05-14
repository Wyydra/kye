import React from "react";
import { Node, Layout } from "../../../types/domain";
import { DocumentLayout } from "./DocumentLayout";
import { StackLayout } from "./StackLayout";
import { WidgetLayout } from "./WidgetLayout";
import { CanvasLayout } from "./CanvasLayout";

export interface LayoutProps {
  node: Node;
  layout: Layout;
  depth: number;
}

export type LayoutComponent = React.FC<LayoutProps>;

export const LAYOUT_REGISTRY: Record<string, LayoutComponent> = {
  Document: DocumentLayout,
  Stack: StackLayout,
  Widget: WidgetLayout,
  Canvas: CanvasLayout,
};

export function getLayout(type: string): LayoutComponent | undefined {
  return LAYOUT_REGISTRY[type];
}
