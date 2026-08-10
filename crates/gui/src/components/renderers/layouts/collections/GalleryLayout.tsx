import React from "react";
import { CollectionLayoutProps } from "./registry";
import { NodeRenderer } from "../../NodeRenderer";
import { Card } from "../../../ui/Card";
import { GridCols } from "../../../ui/LayoutPrimitives";

export const GalleryLayout: React.FC<CollectionLayoutProps> = ({ node, depth }) => {
  return (
    <GridCols cols={3} gap="md">
      {node.children.map((childId) => (
        <Card key={childId} interactive>
          <NodeRenderer nodeId={childId} depth={depth + 1} />
        </Card>
      ))}
    </GridCols>
  );
};
