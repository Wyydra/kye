import React from "react";
import { CollectionLayoutProps } from "./collections/registry";
import { useGraphStore } from "../../../store/graphStore";
import {
  TableContainer,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../../ui/Table";
import { Badge } from "../../ui/Badge";

export const MatrixLayout: React.FC<CollectionLayoutProps> = ({ node, layout }) => {
  const edgeKind = layout.t === "Matrix" ? layout.v.edge_kind : "connection";
  const nodes = useGraphStore((state) => state.nodes);
  const children = node.children.map((id) => nodes[id]).filter(Boolean);

  const rowNodes = children.slice(0, Math.ceil(children.length / 2));
  const colNodes = children.slice(Math.ceil(children.length / 2));

  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              {node.props.title?.t === "Text" ? node.props.title.v : "Matrix"} ({edgeKind})
            </TableHead>
            {colNodes.map((col) => (
              <TableHead key={col.id} className="text-center font-medium">
                {col.props.title?.t === "Text" ? col.props.title.v : col.id.slice(0, 6)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowNodes.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                {row.props.title?.t === "Text" ? row.props.title.v : row.id.slice(0, 6)}
              </TableCell>
              {colNodes.map((col) => {
                const isConnected = row.children.includes(col.id) || col.children.includes(row.id);
                return (
                  <TableCell key={col.id} className="text-center">
                    <Badge variant={isConnected ? "active" : "muted"}>
                      {isConnected ? "Connected" : "—"}
                    </Badge>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
