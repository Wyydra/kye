import React from "react";
import { CollectionLayoutProps } from "./registry";
import { NodeRenderer } from "../../NodeRenderer";
import { ListContainer, ListItem } from "../../../ui/List";

export const ListLayout: React.FC<CollectionLayoutProps> = ({ node, depth }) => {
  return (
    <ListContainer>
      {node.children.map((childId) => (
        <ListItem key={childId}>
          <NodeRenderer nodeId={childId} depth={depth + 1} />
        </ListItem>
      ))}
    </ListContainer>
  );
};
