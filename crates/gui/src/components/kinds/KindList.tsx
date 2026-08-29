import React, { useState, useMemo } from "react";
import { KindDef } from "../../types/domain";
import { SearchInput } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";
import { KindIcon } from "./KindIcon";
import { cn } from "../../lib/utils";

export interface KindListProps {
  kinds: Record<string, KindDef>;
  onSelect: (kindId: string) => void;
  showSearch?: boolean;
  searchPlaceholder?: string;
  maxHeightClass?: string;
  autoFocusSearch?: boolean;
}

export const KindList: React.FC<KindListProps> = ({
  kinds,
  onSelect,
  showSearch = false,
  searchPlaceholder = "Search block types...",
  maxHeightClass = "max-h-56",
  autoFocusSearch = false,
}) => {
  const [search, setSearch] = useState("");

  const filteredKinds = useMemo(() => {
    const entries = Object.entries(kinds);
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      ([id, def]) =>
        id.toLowerCase().includes(q) ||
        def.label.toLowerCase().includes(q) ||
        (def.icon && def.icon.includes(q))
    );
  }, [kinds, search]);

  return (
    <div className="space-y-1.5 w-full font-sans text-xs select-none">
      {showSearch && (
        <SearchInput
          inputSize="xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder={searchPlaceholder}
          autoFocus={autoFocusSearch}
        />
      )}

      {filteredKinds.length === 0 ? (
        <EmptyState
          title="No types found"
          bordered={false}
          className="py-4 text-xs"
        />
      ) : (
        <div className={`overflow-y-auto space-y-0.5 pr-1 custom-scrollbar ${maxHeightClass}`}>
          {filteredKinds.map(([kId, kDef]) => (
            <button
              key={kId}
              type="button"
              onClick={() => onSelect(kId)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer group",
                "hover:bg-muted/60 text-foreground/90"
              )}
            >
              <div className="w-6 h-6 rounded-md bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground group-hover:text-foreground shrink-0 transition-colors">
                <KindIcon kind={kId} kindDef={kDef} size={13} />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium text-xs truncate leading-tight group-hover:text-foreground">
                  {kDef.label}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono truncate leading-tight">
                  {kId}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
