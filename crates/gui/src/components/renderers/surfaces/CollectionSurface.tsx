import React from "react";
import { Node, CollectionLayout as CollectionLayoutType } from "../../../types/domain";
import {
  getCollectionLayout,
  registerCollectionLayout,
} from "../layouts/collections/registry";
import { TableLayout } from "../layouts/collections/TableLayout";
import { KanbanLayout } from "../layouts/collections/KanbanLayout";
import { GalleryLayout } from "../layouts/collections/GalleryLayout";
import { ListLayout } from "../layouts/collections/ListLayout";
import { MatrixLayout } from "../layouts/MatrixLayout";

// Register default Collection Layouts in strategy registry
registerCollectionLayout("Table", TableLayout);
registerCollectionLayout("Kanban", KanbanLayout);
registerCollectionLayout("Gallery", GalleryLayout);
registerCollectionLayout("List", ListLayout);
registerCollectionLayout("Matrix", MatrixLayout);

interface CollectionSurfaceProps {
  node: Node;
  layout: CollectionLayoutType;
  depth: number;
}

export const CollectionSurface: React.FC<CollectionSurfaceProps> = ({
  node,
  layout,
  depth,
}) => {
  const Component = getCollectionLayout(layout.t) || ListLayout;

  return <Component node={node} layout={layout} depth={depth} />;
};

