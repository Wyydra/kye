import React from "react";
import { Node, Layout } from "../../../types/domain";

export interface LayoutProps {
  node: Node;
  layout: Layout;
  depth: number;
}

export type LayoutComponent = React.FC<LayoutProps>;
