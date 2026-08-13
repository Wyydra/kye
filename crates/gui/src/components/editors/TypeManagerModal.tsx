import React, { useState, useMemo } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { kyeService } from "../../services/kyeService";
import { KindDef, ValueType, PropDef } from "../../types/domain";
import {
  Plus,
  Trash2,
  Layers,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Card } from "../ui/Card";
import { VStack, HStack } from "../ui/LayoutPrimitives";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/utils";

const AVAILABLE_TYPE_PRESETS: { value: string; label: string; defaultIcon: string }[] = [
  { value: "Text", label: "Text", defaultIcon: "📝" },
  { value: "Rich", label: "Rich Text (Markdown)", defaultIcon: "📄" },
  { value: "Int", label: "Integer", defaultIcon: "#" },
  { value: "Float", label: "Decimal Number", defaultIcon: "0.0" },
  { value: "Bool", label: "Checkbox (Boolean)", defaultIcon: "✓" },
  { value: "Date", label: "Date (YYYY-MM-DD)", defaultIcon: "📅" },
  { value: "DateTime", label: "Date & Time", defaultIcon: "🕒" },
  { value: "Color", label: "Color Hex", defaultIcon: "🎨" },
  { value: "Ref", label: "Reference to Node", defaultIcon: "→" },
  { value: "OneOf", label: "Single Select / Status", defaultIcon: "🏷️" },
];

export const TypeManagerModal: React.FC = () => {
  const isTypeManagerOpen = useUIStore((state) => state.isTypeManagerOpen);
  const setTypeManagerOpen = useUIStore((state) => state.setTypeManagerOpen);
  const kinds = useGraphStore((state) => state.kinds);
  const loadGraph = useGraphStore((state) => state.loadGraph);

  const [search, setSearch] = useState("");
  const [selectedKindId, setSelectedKindId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form State for creating / editing
  const [kindId, setKindId] = useState("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("📄");
  const [titleProp, setTitleProp] = useState("title");
  const [surfaceType, setSurfaceType] = useState<"Document" | "Canvas" | "Collection" | "Widget">("Document");
  const [propsList, setPropsList] = useState<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    optionsStr: string;
  }[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const kindEntries = useMemo(() => {
    const list = Object.entries(kinds);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      ([k, def]) =>
        k.toLowerCase().includes(q) ||
        def.label.toLowerCase().includes(q) ||
        (def.icon && def.icon.includes(q))
    );
  }, [kinds, search]);

  const handleStartCreate = () => {
    setIsCreatingNew(true);
    setSelectedKindId(null);
    setKindId("user.");
    setLabel("");
    setIcon("🏷️");
    setTitleProp("title");
    setSurfaceType("Document");
    setPropsList([
      { key: "title", label: "Title", type: "Text", required: true, optionsStr: "" },
    ]);
    setErrorMsg(null);
  };

  const handleSelectKind = (kId: string) => {
    setIsCreatingNew(false);
    setSelectedKindId(kId);
    const def = kinds[kId];
    if (!def) return;
    setKindId(kId);
    setLabel(def.label);
    setIcon(def.icon || "📄");
    setTitleProp(def.title_prop || "title");

    let sType: "Document" | "Canvas" | "Collection" | "Widget" = "Document";
    if (def.view?.surface) {
      if ("Canvas" in def.view.surface) sType = "Canvas";
      else if ("Collection" in def.view.surface) sType = "Collection";
      else if ("Widget" in def.view.surface) sType = "Widget";
    }
    setSurfaceType(sType);

    const pList: {
      key: string;
      label: string;
      type: string;
      required: boolean;
      optionsStr: string;
    }[] = [];

    if (def.props) {
      for (const [pKey, pDef] of Object.entries(def.props)) {
        const tName = pDef.value_type.type;
        let optStr = "";
        if (pDef.value_type.type === "OneOf" && "config" in pDef.value_type) {
          optStr = pDef.value_type.config.options.join(", ");
        }
        pList.push({
          key: pKey,
          label: pDef.label || pKey,
          type: tName,
          required: pDef.required,
          optionsStr: optStr,
        });
      }
    }
    setPropsList(pList);
    setErrorMsg(null);
  };

  const handleAddProp = () => {
    setPropsList((prev) => [
      ...prev,
      {
        key: `prop_${prev.length + 1}`,
        label: `Property ${prev.length + 1}`,
        type: "Text",
        required: false,
        optionsStr: "",
      },
    ]);
  };

  const handleRemoveProp = (index: number) => {
    setPropsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!kindId.trim() || kindId.trim() === "user.") {
      setErrorMsg("Please specify a valid technical kind identifier (e.g. user.project)");
      return;
    }
    if (!label.trim()) {
      setErrorMsg("Please specify a label for this type");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const formattedProps: Record<string, PropDef> = {};

      for (const p of propsList) {
        if (!p.key.trim()) continue;
        let valTypeObj: ValueType;
        if (p.type === "OneOf") {
          const opts = p.optionsStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          valTypeObj = { type: "OneOf", config: { options: opts } };
        } else {
          valTypeObj = { type: p.type as any };
        }

        formattedProps[p.key.trim()] = {
          value_type: valTypeObj,
          required: p.required,
          label: p.label.trim() || p.key.trim(),
        };
      }

      let surfaceObj: any;
      if (surfaceType === "Canvas") {
        surfaceObj = { Canvas: { layout: "Absolute", diagram_kind: null } };
      } else if (surfaceType === "Collection") {
        surfaceObj = { Collection: { layout: "List" } };
      } else if (surfaceType === "Widget") {
        surfaceObj = { Widget: { name: label.toLowerCase() } };
      } else {
        surfaceObj = { Document: { layout: "VerticalStream" } };
      }

      const newDef: KindDef = {
        label: label.trim(),
        icon: icon.trim() || "📄",
        title_prop: titleProp.trim() || "title",
        props: formattedProps,
        view: {
          surface: surfaceObj,
          source: { t: "DirectChildren" },
          overlay: { hidden_edge_kinds: [] },
          bindings: {},
          actions: [],
        },
        constraints: [],
      };

      await kyeService.registerKind(kindId.trim(), newDef);
      await loadGraph(true);
      setIsCreatingNew(false);
      setSelectedKindId(kindId.trim());
    } catch (err: any) {
      setErrorMsg(err.toString());
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (kId: string) => {
    if (!window.confirm(`Are you sure you want to delete type "${kId}"?`)) return;
    try {
      await kyeService.deleteKind(kId);
      await loadGraph(true);
      if (selectedKindId === kId) {
        setSelectedKindId(null);
      }
    } catch (err: any) {
      alert(`Failed to delete kind: ${err}`);
    }
  };

  const isBuiltIn = selectedKindId ? selectedKindId.startsWith("core.") : false;

  return (
    <Modal
      isOpen={isTypeManagerOpen}
      onClose={() => setTypeManagerOpen(false)}
      size="xl"
      title={
        <HStack gap="sm">
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-bold text-xs">TYPE_SCHEMA_ARCHITECTURE</span>
          <Badge variant="active" className="text-[10px]">
            {Object.keys(kinds).length} Types
          </Badge>
        </HStack>
      }
    >
      <div className="flex h-full w-full -m-5 overflow-hidden font-mono text-xs">
        {/* Left Column: Type List */}
        <div className="w-64 border-r border-border/60 flex flex-col bg-muted/10">
          <VStack gap="xs" className="p-3 border-b border-border/40">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter types..."
              className="w-full bg-background border border-border/60 rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
            />
            <button
              onClick={handleStartCreate}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded font-semibold text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Custom Type</span>
            </button>
          </VStack>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {kindEntries.map(([kId, def]) => {
              const isSelected = selectedKindId === kId && !isCreatingNew;
              const isCore = kId.startsWith("core.");

              return (
                <div
                  key={kId}
                  onClick={() => handleSelectKind(kId)}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer group transition-colors",
                    isSelected
                      ? "bg-primary/20 text-primary border border-primary/30 font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span>{def.icon || "📄"}</span>
                    <span className="truncate">{def.label}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isCore ? (
                      <span className="text-[9px] text-muted-foreground/50 uppercase">core</span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(kId);
                        }}
                        className="p-1 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete custom type"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Schema Editor / Inspector */}
        <div className="flex-1 flex flex-col bg-background overflow-y-auto p-6">
          {isCreatingNew || selectedKindId ? (
            <VStack gap="md" className="max-w-2xl">
              {/* Form Header */}
              <HStack justify-between="true" className="border-b border-border/40 pb-3" align="center">
                <VStack gap="none">
                  <span className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span>{icon}</span>
                    <span>{isCreatingNew ? "Define New Custom Type" : label}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    Identifier: <span className="text-primary">{kindId}</span>
                  </span>
                </VStack>

                {!isBuiltIn && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-bold rounded hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 text-xs ml-auto"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSaving ? "Saving..." : "Save Schema"}</span>
                  </button>
                )}
              </HStack>

              {errorMsg && (
                <div className="p-2.5 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  {errorMsg}
                </div>
              )}

              {/* Meta Inputs Grid */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <VStack gap="xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Kind Identifier
                  </span>
                  <input
                    type="text"
                    value={kindId}
                    onChange={(e) => setKindId(e.target.value)}
                    disabled={!isCreatingNew}
                    placeholder="e.g. user.project"
                    className="w-full bg-muted/20 border border-border/60 rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/60 disabled:opacity-50 transition-colors"
                  />
                </VStack>

                <VStack gap="xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Display Label
                  </span>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    disabled={isBuiltIn}
                    placeholder="e.g. Project"
                    className="w-full bg-muted/20 border border-border/60 rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/60 disabled:opacity-50 transition-colors"
                  />
                </VStack>

                <VStack gap="xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Icon / Emoji
                  </span>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    disabled={isBuiltIn}
                    className="w-full bg-muted/20 border border-border/60 rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/60 disabled:opacity-50 transition-colors"
                  />
                </VStack>

                <VStack gap="xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Default Surface View
                  </span>
                  <select
                    value={surfaceType}
                    onChange={(e) => setSurfaceType(e.target.value as any)}
                    disabled={isBuiltIn}
                    className="w-full bg-muted/20 border border-border/60 rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/60 disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    <option value="Document">Document (Vertical Stream)</option>
                    <option value="Canvas">Canvas (Infinite 2D)</option>
                    <option value="Collection">Collection (List / Table)</option>
                    <option value="Widget">Custom Widget</option>
                  </select>
                </VStack>
              </div>

              {/* Properties Section */}
              <VStack gap="sm" className="pt-2">
                <HStack justify-between="true" className="border-b border-border/40 pb-2" align="center">
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                    Properties ({propsList.length})
                  </span>

                  {!isBuiltIn && (
                    <button
                      onClick={handleAddProp}
                      className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer ml-auto"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Property</span>
                    </button>
                  )}
                </HStack>

                {propsList.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 italic py-2">
                    No custom properties defined for this type.
                  </p>
                ) : (
                  <VStack gap="xs">
                    {propsList.map((p, idx) => (
                      <Card key={idx} className="p-2 bg-muted/10 border-border/50">
                        <HStack gap="xs" align="center">
                          <input
                            type="text"
                            value={p.key}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPropsList((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, key: val } : item))
                              );
                            }}
                            disabled={isBuiltIn}
                            placeholder="key (e.g. deadline)"
                            className="w-32 bg-background border border-border/60 rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/60 disabled:opacity-50"
                          />

                          <input
                            type="text"
                            value={p.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPropsList((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, label: val } : item))
                              );
                            }}
                            disabled={isBuiltIn}
                            placeholder="Label"
                            className="flex-1 bg-background border border-border/60 rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/60 disabled:opacity-50"
                          />

                          <select
                            value={p.type}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPropsList((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, type: val } : item))
                              );
                            }}
                            disabled={isBuiltIn}
                            className="w-36 bg-background border border-border/60 rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/60 disabled:opacity-50 cursor-pointer"
                          >
                            {AVAILABLE_TYPE_PRESETS.map((pt) => (
                              <option key={pt.value} value={pt.value}>
                                {pt.defaultIcon} {pt.label}
                              </option>
                            ))}
                          </select>

                          {p.type === "OneOf" && (
                            <input
                              type="text"
                              value={p.optionsStr}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPropsList((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, optionsStr: val } : item
                                  )
                                );
                              }}
                              disabled={isBuiltIn}
                              placeholder="todo, doing, done"
                              className="w-36 bg-background border border-border/60 rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/60 disabled:opacity-50"
                            />
                          )}

                          {!isBuiltIn && (
                            <button
                              onClick={() => handleRemoveProp(idx)}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                              title="Remove property"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </HStack>
                      </Card>
                    ))}
                  </VStack>
                )}
              </VStack>
            </VStack>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50 space-y-2">
              <Layers className="w-8 h-8 opacity-40" />
              <p>Select a type on the left or create a new custom type</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
