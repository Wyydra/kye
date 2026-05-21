

import React from "react";
import { Node, Value, Mark } from "../types/domain";
import { execute, executeBatch } from "../lib/commands";

export interface BlockTypeSpec {

  id: string;

  kind: string;

  label: string;

  icon: React.ReactNode;

  markdownTrigger?: string;

  keywords?: string[];

  propsOnConvert: (currentNode: Node) => Record<string, Value>;

  propsToDelete?: (currentNode: Node) => string[];
}

export interface MarkSpec {
  id: string;
  mark: Mark;
  label: string;
  icon: React.ReactNode;

  shortcut?: string;
}

export function convertBlockType(node: Node, spec: BlockTypeSpec): void {
  const newProps = spec.propsOnConvert(node);
  const toDelete = spec.propsToDelete?.(node) ?? [];

  const cmds = [
    { type: "set_kind" as const, node_id: node.id, new_kind: spec.kind },
    { type: "set_props" as const, node_id: node.id, props: newProps },
    ...toDelete.map((key) => ({
      type: "delete_prop" as const,
      node_id: node.id,
      key,
    })),
  ];

  executeBatch(cmds);
}

export function createBlockOfType(
  spec: BlockTypeSpec,
  parentId: string | null,
  index: number,
  _initialText: Value = { t: "Rich", v: { spans: [] } },
): string {
  const id = crypto.randomUUID();
  const props = spec.propsOnConvert({
    id,
    kind: spec.kind,
    parent: parentId,
    children: [],
    props: {},
    created_at: "",
    updated_at: "",
  });

  execute({
    type: "create_node",
    id,
    kind: spec.kind,
    parent_id: parentId,
    index,
    props,
  });

  return id;
}
