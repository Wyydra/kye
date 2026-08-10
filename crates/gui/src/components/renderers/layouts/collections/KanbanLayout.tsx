import React from "react";
import { CollectionLayoutProps } from "./registry";
import { NodeRenderer } from "../../NodeRenderer";
import { val } from "../../../../types/domain";
import { useGraphStore } from "../../../../store/graphStore";
import {
  KanbanContainer,
  KanbanColumn,
  KanbanHeader,
  KanbanCard,
} from "../../../ui/Kanban";
import { VStack } from "../../../ui/LayoutPrimitives";

export const KanbanLayout: React.FC<CollectionLayoutProps> = ({ node, layout, depth }) => {
  const nodes = useGraphStore((state) => state.nodes);
  const groupByKey = layout.t === "Kanban" ? layout.v.group_by : "status";

  const childrenNodes = node.children.map((id) => nodes[id]).filter(Boolean);

  const columnsMap: Record<string, string[]> = {};

  childrenNodes.forEach((child) => {
    const rawVal = val<string>(child.props[groupByKey]);
    const groupVal = rawVal ? String(rawVal) : "Uncategorized";
    if (!columnsMap[groupVal]) {
      columnsMap[groupVal] = [];
    }
    columnsMap[groupVal].push(child.id);
  });

  const columnKeys = Object.keys(columnsMap);
  if (columnKeys.length === 0) {
    columnKeys.push("Default");
    columnsMap["Default"] = node.children;
  }

  return (
    <KanbanContainer>
      {columnKeys.map((colName) => (
        <KanbanColumn key={colName}>
          <KanbanHeader title={colName} count={columnsMap[colName].length} />

          <VStack gap="xs">
            {columnsMap[colName].map((childId) => (
              <KanbanCard key={childId}>
                <NodeRenderer nodeId={childId} depth={depth + 1} />
              </KanbanCard>
            ))}
          </VStack>
        </KanbanColumn>
      ))}
    </KanbanContainer>
  );
};
