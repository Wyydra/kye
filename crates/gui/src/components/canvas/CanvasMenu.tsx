import React, { useState, useEffect, useRef, useMemo } from 'react';
import { workspaceService } from '../../services/WorkspaceService';
import { TemplateDto } from '../../types/workspace';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CanvasMenuProps {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  templates: TemplateDto[];
  onClose: () => void;
  onCreated: () => void;
}

export const CanvasMenu: React.FC<CanvasMenuProps> = ({ 
  x, y, worldX, worldY, templates, onClose, onCreated 
}) => {
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => 
      t.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [templates, search]);

  const handleSelect = async (template: TemplateDto) => {
    try {
      const initialFields: Record<string, any> = {
        _x: Math.round(worldX),
        _y: Math.round(worldY),
        _width: 300,
        _height: 200,
      };

      template.fields.forEach(field => {
        if (!(field.name in initialFields)) {
          initialFields[field.name] = getDefaultValue(field.field_type);
        }
      });

      const metadata = JSON.stringify(initialFields);
      await workspaceService.createBlock('', metadata);
      
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create block:', err);
    }
  };

  return (
    <div 
      ref={menuRef}
      className="absolute z-50 w-64 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
      style={{ left: x, top: y }}
    >
      <div className="relative flex items-center border-b px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <input 
          autoFocus
          className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Search node types..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && filteredTemplates.length > 0) {
              handleSelect(filteredTemplates[0]);
            }
          }}
        />
      </div>
      <div className="max-h-[300px] overflow-y-auto p-1">
        {filteredTemplates.map(template => (
          <button 
            key={template.name} 
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => handleSelect(template)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted text-lg">
              {getIconForType(template.name)}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold leading-none">
                {template.name.charAt(0).toUpperCase() + template.name.slice(1)}
              </span>
              <span className="text-xs text-muted-foreground">Node</span>
            </div>
          </button>
        ))}
        {filteredTemplates.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        )}
      </div>
    </div>
  );
};

function getIconForType(type: string) {
  switch (type.toLowerCase()) {
    case 'text': return '📄';
    case 'image': return '🖼️';
    case 'code': return '💻';
    case 'todo': return '✅';
    default: return '📦';
  }
}

function getDefaultValue(type: string): any {
  if (type === 'Boolean') return false;
  if (type === 'Integer') return 0;
  if (type === 'Float') return 0.0;
  if (type === 'String') return '';
  if (type === 'List') return [];
  if (type === 'Record') return {};
  return null;
}
