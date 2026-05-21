

import { Node, Value } from "../types/domain";
import { BlockTypeSpec, MarkSpec } from "./registry";

function transferText(node: Node, targetPropKey: string): Record<string, Value> {
  const textValue =
    node.props["body"] ||
    node.props["text"] ||
    node.props["title"] ||
    node.props["front"] || { t: "Rich" as const, v: { spans: [] } };
  return { [targetPropKey]: textValue };
}

export const CORE_BLOCK_TYPES: BlockTypeSpec[] = [
  {
    id: "paragraph",
    kind: "core.paragraph",
    label: "Paragraph",
    keywords: ["text", "para", "p"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 4H8.5C6 4 4 6 4 8.5s2 4.5 4.5 4.5H12v7h2V4h-1z"/>
        <line x1="16" y1="4" x2="16" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/>
      </svg>
    ),
    markdownTrigger: undefined,
    propsOnConvert: (node) => transferText(node, "body"),
    propsToDelete: (node) =>
      ["text", "level", "checked", "title", "front", "back"].filter((k) => k in node.props),
  },
  {
    id: "heading-1",
    kind: "core.heading",
    label: "Heading 1",
    keywords: ["h1", "title", "big"],
    icon: <span className="font-black text-sm leading-none">H1</span>,
    markdownTrigger: "# ",
    propsOnConvert: (node) => ({
      ...transferText(node, "body"),
      level: { t: "Int" as const, v: 1 },
    }),
    propsToDelete: (node) => ["text", "checked", "title", "front", "back"].filter((k) => k in node.props),
  },
  {
    id: "heading-2",
    kind: "core.heading",
    label: "Heading 2",
    keywords: ["h2", "subtitle"],
    icon: <span className="font-bold text-sm leading-none">H2</span>,
    markdownTrigger: "## ",
    propsOnConvert: (node) => ({
      ...transferText(node, "body"),
      level: { t: "Int" as const, v: 2 },
    }),
    propsToDelete: (node) => ["text", "checked", "title", "front", "back"].filter((k) => k in node.props),
  },
  {
    id: "heading-3",
    kind: "core.heading",
    label: "Heading 3",
    keywords: ["h3"],
    icon: <span className="font-semibold text-sm leading-none">H3</span>,
    markdownTrigger: "### ",
    propsOnConvert: (node) => ({
      ...transferText(node, "body"),
      level: { t: "Int" as const, v: 3 },
    }),
    propsToDelete: (node) => ["text", "checked", "title", "front", "back"].filter((k) => k in node.props),
  },
  {
    id: "task",
    kind: "core.task",
    label: "Task",
    keywords: ["task", "todo", "check", "checkbox"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
    ),
    markdownTrigger: "[] ",
    propsOnConvert: (node) => ({
      ...transferText(node, "title"),
      checked: { t: "Bool" as const, v: false },
    }),
    propsToDelete: (node) => ["body", "text", "level", "front", "back"].filter((k) => k in node.props),
  },
  {
    id: "flashcard",
    kind: "core.flashcard",
    label: "Flashcard",
    keywords: ["flashcard", "card", "quiz", "korean", "vocab", "study"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <path d="M8 14h.01M12 14h.01M16 14h.01"/>
      </svg>
    ),
    markdownTrigger: "? ",
    propsOnConvert: (node) => ({
      ...transferText(node, "front"),
      back: { t: "Rich" as const, v: { spans: [] } },
    }),
    propsToDelete: (node) => ["body", "text", "level", "checked", "title"].filter((k) => k in node.props),
  },
  {
    id: "image",
    kind: "core.image",
    label: "Image",
    keywords: ["image", "pic", "photo", "img"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
    markdownTrigger: undefined,
    propsOnConvert: (_node) => ({
      url: { t: "Text" as const, v: "" },
    }),
    propsToDelete: (node) =>
      ["body", "level", "checked", "text", "title", "front", "back"].filter((k) => k in node.props),
  },
];


export const CORE_MARKS: MarkSpec[] = [
  {
    id: "bold",
    mark: { t: "Bold" },
    label: "Bold",
    shortcut: "⌘B",
    icon: <strong className="text-sm">B</strong>,
  },
  {
    id: "italic",
    mark: { t: "Italic" },
    label: "Italic",
    shortcut: "⌘I",
    icon: <em className="text-sm">I</em>,
  },
  {
    id: "strikethrough",
    mark: { t: "Strikethrough" },
    label: "Strikethrough",
    shortcut: "⌘⇧S",
    icon: <s className="text-sm">S</s>,
  },
  {
    id: "code",
    mark: { t: "Code" },
    label: "Code",
    shortcut: "⌘E",
    icon: <code className="text-xs font-mono bg-muted px-0.5 rounded">{"<>"}</code>,
  },
];
