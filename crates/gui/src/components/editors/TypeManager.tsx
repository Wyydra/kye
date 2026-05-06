import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Settings2, 
  FileType, 
  Search, 
  MoreVertical, 
  Layout, 
  ChevronRight,
  Database,
  ArrowRight
} from 'lucide-react';
import { workspaceService } from '../../services/WorkspaceService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { cn } from '../../lib/utils';
import { TypeEditor } from './TypeEditor';

interface TypeManagerProps {
  onClose: () => void;
}

export const TypeManager: React.FC<TypeManagerProps> = ({ onClose }) => {
  const { templates, refresh } = useWorkspace();
  const [search, setSearch] = useState('');
  const [editingType, setEditingType] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  }, [templates, search]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-5xl h-[80vh] bg-card/80 border shadow-[0_32px_64px_rgba(0,0,0,0.2)] rounded-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b bg-secondary/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary shadow-inner">
              <Settings2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-foreground">Type Architecture</h2>
              <p className="text-sm text-muted-foreground font-medium">Manage and define your workspace data structures</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <input 
                type="text" 
                placeholder="Search types..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-secondary/40 border border-border/50 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-64 transition-all"
              />
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-full transition-all active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex">
          
          {/* Sidebar / Stats (Optional but cool) */}
          <div className="w-64 border-r bg-muted/20 p-8 hidden md:flex flex-col gap-8">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Statistics</span>
              <div className="mt-4 space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-sm text-muted-foreground">Total Types</span>
                  <span className="text-2xl font-black">{templates.length}</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(templates.length / 20) * 100}%` }} />
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowCreator(true)}
              className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-4 bg-primary text-primary-foreground rounded-xl font-black text-sm shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              NEW TYPE
            </button>
          </div>

          {/* Main Grid */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              
              {/* New Type Empty Card */}
              <button 
                onClick={() => setShowCreator(true)}
                className="group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-muted-foreground/10 hover:border-primary/40 hover:bg-primary/5 transition-all min-h-[180px]"
              >
                <div className="p-4 rounded-full bg-muted/40 group-hover:bg-primary/20 group-hover:text-primary transition-all duration-300">
                  <Plus className="h-6 w-6" />
                </div>
                <span className="mt-4 text-xs font-black uppercase tracking-widest text-muted-foreground/60 group-hover:text-primary">Create New Type</span>
              </button>

              {/* Template Cards */}
              {filteredTemplates.map((template) => (
                <div 
                  key={template.name}
                  onClick={() => setEditingType(template.name)}
                  className="group relative flex flex-col p-6 rounded-2xl border bg-card hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-pointer overflow-hidden"
                >
                  {/* Glass Background Decoration */}
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all" />
                  
                  <div className="flex items-start justify-between mb-6">
                    <div className="p-3 bg-secondary/50 rounded-xl group-hover:text-primary transition-colors">
                      <FileType className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">
                      <Database className="h-3 w-3" />
                      {template.fields.length} Fields
                    </div>
                  </div>

                  <h3 className="text-lg font-black capitalize tracking-tight group-hover:translate-x-1 transition-transform">{template.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {template.fields.slice(0, 3).map(f => (
                      <span key={f.name} className="text-[9px] font-bold px-2 py-0.5 rounded bg-muted/50 text-muted-foreground uppercase">{f.name}</span>
                    ))}
                    {template.fields.length > 3 && <span className="text-[9px] font-bold text-muted-foreground/40">+{template.fields.length - 3}</span>}
                  </div>

                  <div className="mt-auto pt-6 flex items-center justify-between border-t border-border/40 mt-6">
                    <span className="text-[10px] font-bold text-muted-foreground/40 group-hover:text-primary/60 transition-colors uppercase">Edit definition</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editors */}
      {(showCreator || editingType) && (
        <TypeEditor 
          initialTypeName={editingType || undefined}
          onClose={() => {
            setShowCreator(false);
            setEditingType(null);
          }}
          onSuccess={() => {
            refresh();
            setShowCreator(false);
            setEditingType(null);
          }}
        />
      )}
    </div>
  );
};
