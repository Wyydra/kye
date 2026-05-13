/**
 * Extension Registry — source unique de vérité pour tous les "types" de blocs
 * et de marks inline disponibles dans l'éditeur.
 *
 * Un BlockTypeSpec décrit comment créer un bloc, comment le reconnaître,
 * comment l'afficher dans les menus (slash, turn-into, toolbar).
 * Un MarkSpec décrit un formatage inline.
 *
 * Tout composant qui a besoin de cette liste (ParagraphWidget slash menu,
 * NodeRenderer "turn into", RichTextToolbar) lit depuis ici.
 */

import React from "react";
import { Node, Value, Mark } from "../types/domain";
import { execute, executeBatch } from "../lib/commands";

// ── Block Types ───────────────────────────────────────────────────────────────

export interface BlockTypeSpec {
  /** Identifiant unique lisible, ex: "heading-1" */
  id: string;
  /** kind Kye correspondant, ex: "core.heading" */
  kind: string;
  /** Label affiché dans les menus */
  label: string;
  /** Icône React */
  icon: React.ReactNode;
  /** Raccourci Markdown déclenchant la conversion (ex: "# ") */
  markdownTrigger?: string;
  /** Mots-clés supplémentaires pour la recherche dans la slash command */
  keywords?: string[];
  /**
   * Props à injecter lors de la création ou de la conversion vers ce type.
   * Peut utiliser les props actuelles du nœud pour transférer le texte.
   */
  propsOnConvert: (currentNode: Node) => Record<string, Value>;
  /**
   * Props à supprimer lors de la conversion (ex: "body" → "text")
   */
  propsToDelete?: (currentNode: Node) => string[];
}

export interface MarkSpec {
  id: string;
  mark: Mark;
  label: string;
  icon: React.ReactNode;
  /** Raccourci clavier (affiché dans le tooltip) */
  shortcut?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Applique une conversion de type sur un nœud existant. */
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

/** Crée un nouveau nœud du type donné. */
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
