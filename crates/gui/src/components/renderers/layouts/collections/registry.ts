import React from "react";
import { Node, CollectionLayout } from "../../../../types/domain";

export interface CollectionLayoutProps {
  node: Node;
  layout: CollectionLayout;
  depth: number;
}

export type CollectionLayoutComponent = React.FC<CollectionLayoutProps>;

export const COLLECTION_LAYOUT_REGISTRY: Record<string, CollectionLayoutComponent> = {};

export function registerCollectionLayout(type: string, component: CollectionLayoutComponent) {
  COLLECTION_LAYOUT_REGISTRY[type] = component;
}

export function getCollectionLayout(type: string): CollectionLayoutComponent | undefined {
  return COLLECTION_LAYOUT_REGISTRY[type];
}
