import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  FileType, 
  Layout, 
  Database, 
  GripVertical,
  Type,
  Hash,
  CheckSquare,
  Link as LinkIcon,
  Palette,
  Layers,
  TextQuote,
  Image as ImageIcon
} from 'lucide-react';
import { workspaceService } from '../../services/WorkspaceService';
import { FieldType, TypeDefinitionDto } from '../../types/workspace';
import { useWorkspace } from '../../context/WorkspaceContext';
import { cn } from '../../lib/utils';

interface TypeEditorProps {
  initialTypeName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FieldRow {
  id: string;
  name: string;
  type: FieldType;
}

export const TypeEditor: React.FC<TypeEditorProps> = ({ initialTypeName, onClose, onSuccess }) => {
  const { templates } = useWorkspace();
  const isEditing = !!initialTypeName;
  
  const [name, setName] = useState(initialTypeName || '');
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from template if editing
  useEffect(() => {
    if (initialTypeName) {
      const template = templates.find(t => t.name === initialTypeName);
      if (template) {
        setFields(template.fields.map(f => ({
          id: Math.random().toString(36).substr(2, 9),
          name: f.name,
          type: f.field_type as FieldType
        })));
      }
    } else {
      setFields([
        { id: '1', name: 'title', type: 'string' },
        { id: '2', name: 'body', type: 'markdown' },
      ]);
    }
  }, [initialTypeName, templates]);

  const addField = () => {
    setFields([...fields, { id: Math.random().toString(36).substr(2, 9), name: '', type: 'string' }]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<FieldRow>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Type name is required");
      return;
    }
    if (fields.some(f => !f.name.trim())) {
      setError("All fields must have a name");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const definition: TypeDefinitionDto = {
        fields: fields.reduce((acc, f) => {
          acc[f.name.trim()] = f.type;
          return acc;
        }, {} as Record<string, FieldType>),
        layout: {
          type: 'stack',
          props: { direction: 'vertical' },
          bindings: {},
          actions: {},
          slots: {},
          children: fields.map(f => {
            let widgetType = 'text';
            if (f.type === 'markdown') widgetType = 'markdown';
            if (f.type === 'image') widgetType = 'image';
            if (f.type === 'link') widgetType = 'link';
            if (f.type === 'blockid') widgetType = 'link';

            return {
              type: widgetType,
              props: widgetType === 'text' ? { style: f.name === 'title' ? 'header' : 'normal' } : {},
              bindings: { value: f.name },
              actions: {},
              slots: {},
              children: []
            };
          })
        }
      };

      await workspaceService.registerType(name.toLowerCase().trim(), definition);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error saving type");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialTypeName || !window.confirm(`Are you sure you want to delete the type "${initialTypeName}"?`)) return;
    
    setIsDeleting(true);
    try {
      await workspaceService.deleteType(initialTypeName);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error deleting type");
    } finally {
      setIsDeleting(false);
    }
  };

  const fieldTypes: { value: FieldType, icon: any }[] = [
    { value: 'string', icon: Type },
    { value: 'markdown', icon: TextQuote },
    { value: 'integer', icon: Hash },
    { value: 'float', icon: Hash },
    { value: 'boolean', icon: CheckSquare },
    { value: 'image', icon: ImageIcon },
    { value: 'link', icon: LinkIcon },
    { value: 'color', icon: Palette },
    { value: 'blockid', icon: Layers },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-card border shadow-2xl rounded-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-secondary/20">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <FileType className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase">
                {isEditing ? `Edit Type: ${initialTypeName}` : "Define New Type"}
              </h2>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-60">
                Blueprint Management
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-all active:scale-90">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-y-auto space-y-8 scrollbar-hide">
          {/* Name Section */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
              <Database className="h-3 w-3" />
              IDENTIFIER
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEditing}
              placeholder="e.g. flashcard, task, habit..."
              className={cn(
                "w-full bg-secondary/40 border border-border/50 rounded-xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold",
                isEditing && "opacity-50 cursor-not-allowed bg-muted"
              )}
            />
          </div>

          {/* Fields Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <Layout className="h-3 w-3" />
                FIELDS & STRUCTURE
              </label>
              <button
                onClick={addField}
                className="flex items-center gap-1.5 text-[10px] font-black text-primary hover:bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 transition-all active:scale-95 uppercase tracking-wider"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Property
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((field) => {
                const typeInfo = fieldTypes.find(t => t.value === field.type);
                const Icon = typeInfo?.icon || Type;
                
                return (
                  <div key={field.id} className="flex items-center gap-3 group animate-in fade-in slide-in-from-left-4 duration-200">
                    <div className="flex-1 flex items-center gap-0 bg-secondary/20 border border-border/40 rounded-xl p-1.5 transition-all focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5">
                      <div className="p-2 text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => updateField(field.id, { name: e.target.value })}
                        placeholder="Field identifier"
                        className="flex-1 bg-transparent px-2 py-2 text-sm focus:outline-none font-bold"
                      />
                      <div className="h-6 w-[1px] bg-border/40 mx-2" />
                      <select
                        value={field.type}
                        onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                        className="bg-secondary/40 px-4 py-2 rounded-lg text-[10px] font-black text-primary appearance-none cursor-pointer hover:bg-secondary transition-colors uppercase tracking-widest outline-none mr-1"
                      >
                        {fieldTypes.map(t => (
                          <option key={t.value} value={t.value} className="bg-card text-foreground">{t.value}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => removeField(field.id)}
                      className="p-3 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-black uppercase tracking-widest rounded-xl animate-in shake-1 duration-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t bg-secondary/10 flex justify-between items-center">
          <div>
            {isEditing && (
              <button
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="flex items-center gap-2 px-6 py-3 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Nuke Type
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-accent rounded-xl transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              className="flex items-center gap-2 px-10 py-3 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <div className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isEditing ? "Update Architecture" : "Finalize Type"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
