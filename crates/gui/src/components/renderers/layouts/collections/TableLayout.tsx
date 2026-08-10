import React from "react";
import { CollectionLayoutProps } from "./registry";
import { NodeRenderer } from "../../NodeRenderer";
import { val } from "../../../../types/domain";
import { useGraphStore } from "../../../../store/graphStore";
import {
  TableContainer,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../../../ui/Table";

export const TableLayout: React.FC<CollectionLayoutProps> = ({ node, layout, depth }) => {
  const nodes = useGraphStore((state) => state.nodes);
  const columns = layout.t === "Table" ? layout.v.columns : ["title"];

  const childrenNodes = node.children.map((id) => nodes[id]).filter(Boolean);

  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {columns.map((col) => (
              <TableHead key={col} className="capitalize">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {childrenNodes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground italic">
                No items in table.
              </TableCell>
            </TableRow>
          ) : (
            childrenNodes.map((child) => (
              <TableRow key={child.id}>
                <TableCell className="font-medium">
                  <NodeRenderer nodeId={child.id} depth={depth + 1} />
                </TableCell>
                {columns.map((col) => {
                  const propValue = child.props[col];
                  const displayStr = val<string>(propValue) ?? "";
                  return <TableCell key={col}>{displayStr}</TableCell>;
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
