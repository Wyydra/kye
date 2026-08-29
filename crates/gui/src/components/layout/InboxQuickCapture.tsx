import React, { useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { createNode, createChildNode } from "../../lib/nodeFactory";
import { val } from "../../types/domain";
import { FileText, CheckSquare, Sparkles, Send, Check } from "lucide-react";

export const InboxQuickCapture: React.FC = () => {
  const [text, setText] = useState("");
  const [type, setType] = useState<"note" | "todo">("note");
  const [status, setStatus] = useState<"idle" | "capturing" | "success">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || status === "capturing") return;

    setStatus("capturing");
    try {
      const state = useGraphStore.getState();
      const nodes = state.nodes;

      // 1. Locate or create the "Inbox" page
      let inboxNode = Object.values(nodes).find(
        (n) => n.kind === "core.page" && val<string>(n.props.title) === "Inbox"
      );

      let inboxId = inboxNode ? inboxNode.id : null;

      if (!inboxId) {
        inboxId = await createNode({
          kind: "core.page",
          title: "Inbox",
          openBuffer: false,
        });
      }

      // 2. Append the new block to the Inbox
      if (type === "note") {
        await createChildNode(inboxId, "core.paragraph", {
          openBuffer: false,
          initialProps: {
            body: {
              t: "Rich",
              v: { spans: [{ text: text.trim(), marks: [] }] },
            },
          },
        });
      } else {
        await createChildNode(inboxId, "core.task", {
          openBuffer: false,
          initialProps: {
            title: {
              t: "Rich",
              v: { spans: [{ text: text.trim(), marks: [] }] },
            },
            checked: { t: "Bool", v: false },
          },
        });
      }

      setText("");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      console.error("Failed to capture node", e);
      setStatus("idle");
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
      {/* Selector Tabs */}
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setType("note")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-semibold ${
            type === "note"
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-transparent text-muted-foreground border border-transparent hover:bg-muted"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Note / Idea</span>
        </button>
        <button
          onClick={() => setType("todo")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-semibold ${
            type === "todo"
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-transparent text-muted-foreground border border-transparent hover:bg-muted"
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Todo / Task</span>
        </button>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={
              type === "note"
                ? "Capture an idea in Inbox..."
                : "Add a task to Inbox..."
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={status === "capturing"}
            className="w-full pl-3 pr-10 py-2.5 bg-muted/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm placeholder:opacity-60"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-muted-foreground/30">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
        </div>

        <button
          type="submit"
          disabled={!text.trim() || status === "capturing"}
          className={`px-3.5 rounded-xl flex items-center justify-center transition-all shadow-xs ${
            status === "success"
              ? "bg-emerald-500 text-white"
              : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30"
          }`}
        >
          {status === "success" ? (
            <Check className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
};
