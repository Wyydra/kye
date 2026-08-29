import React from "react";
import { Node, DocumentLayout, val } from "../../../types/domain";
import { NodeRenderer } from "../NodeRenderer";
import { execute } from "../../../lib/commands";
import { useUIStore } from "../../../store/uiStore";
import {
  DocumentTitleInput,
  DocumentEmptyPlaceholder,
  DocumentAddBlockZone,
} from "../../ui/Document";
import { VStack, GridCols } from "../../ui/LayoutPrimitives";

interface DocumentSurfaceProps {
  node: Node;
  layout: DocumentLayout;
  depth: number;
}

export const DocumentSurface: React.FC<DocumentSurfaceProps> = ({
  node,
  layout,
  depth,
}) => {
  const setFocusedNode = useUIStore((state) => state.setFocusedNode);

  const titleVal = val<string>(node.props["title"]) ?? "";
  const isCollapsed = !!val<boolean>(node.props["is_collapsed"]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    execute({
      type: "set_prop",
      node_id: node.id,
      key: "title",
      value: { t: "Text", v: e.target.value },
    });
  };

  const handleCreateBlockAt = (index: number) => {
    const newId = crypto.randomUUID();
    execute({
      type: "create_node",
      id: newId,
      kind: "core.paragraph",
      parent_id: node.id,
      index,
      props: {
        body: { t: "Rich", v: { spans: [] } },
      },
    });
    setFocusedNode(newId);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (node.children.length > 0) {
        setFocusedNode(node.children[0]);
      } else {
        handleCreateBlockAt(0);
      }
    }
  };

  const isColumns = layout.t === "Columns";
  const colCount = isColumns ? layout.v.count || 2 : 1;

  const titleHeader = depth === 0 && (
    <DocumentTitleInput
      value={titleVal}
      onChange={handleTitleChange}
      onKeyDown={handleTitleKeyDown}
    />
  );

  if (node.children.length === 0) {
    return (
      <VStack gap="none">
        {titleHeader}
        <DocumentEmptyPlaceholder onClick={() => handleCreateBlockAt(0)} />
      </VStack>
    );
  }

  // If this node is collapsed (e.g. toggle heading), do not render its sub-tree!
  if (isCollapsed && depth > 0) {
    return <>{titleHeader}</>;
  }

  if (isColumns) {
    return (
      <VStack gap="none">
        {titleHeader}
        <GridCols cols={colCount} gap="md">
          {node.children.map((childId) => (
            <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />
          ))}
        </GridCols>
      </VStack>
    );
  }

  return (
    <VStack
      gap="xs"
      className={depth > 0 ? "border-l border-border/30 hover:border-primary/40 pl-4 my-1 transition-colors" : ""}
    >
      {titleHeader}
      {node.children.map((childId) => (
        <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />
      ))}
      {depth === 0 && (
        <DocumentAddBlockZone onClick={() => handleCreateBlockAt(node.children.length)} />
      )}
    </VStack>
  );
};
