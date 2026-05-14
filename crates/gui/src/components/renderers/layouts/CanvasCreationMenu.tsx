import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useGraphStore } from '../../../store/graphStore';

interface CanvasCreationMenuProps {
  x: number;
  y: number;
  onSelect: (kind: string) => void;
  onClose: () => void;
}

export const CanvasCreationMenu: React.FC<CanvasCreationMenuProps> = ({ 
  x, y, onSelect, onClose 
}) => {
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const kinds = useGraphStore(state => state.kinds);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filteredKinds = useMemo(() => {
    return Object.entries(kinds)
      .filter(([id, def]) => 
        id.toLowerCase().includes(search.toLowerCase()) || 
        def.label.toLowerCase().includes(search.toLowerCase())
      )
      .map(([id, def]) => ({ id, ...def }));
  }, [kinds, search]);

  return (
    <div 
      ref={menuRef}
      className="fixed z-[100] w-64 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
      style={{ left: x, top: y }}
    >
      <div className="relative flex items-center border-b border-border px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <input 
          autoFocus
          className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search node types..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && filteredKinds.length > 0) {
              onSelect(filteredKinds[0].id);
            }
          }}
        />
      </div>
      <div className="max-h-[300px] overflow-y-auto p-1">
        {filteredKinds.map(kind => (
          <button 
            key={kind.id} 
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            onClick={() => onSelect(kind.id)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background text-lg shadow-sm">
              {kind.icon || '📦'}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold leading-none text-xs">
                {kind.label}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                {kind.id}
              </span>
            </div>
          </button>
        ))}
        {filteredKinds.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No results found.
          </div>
        )}
      </div>
    </div>
  );
};
