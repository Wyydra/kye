import React, { useState } from 'react';
import { X, Plus, Trash2, Save, FileType, Layout, Database } from 'lucide-react';
import { workspaceService } from '../../services/WorkspaceService';
import { FieldType, TypeDefinitionDto } from '../../types/workspace';
import { cn } from '../../lib/utils';

interface TypeCreatorProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface FieldRow {
  id: string;
  name: string;
  type: FieldType;
}

export const TypeCreator: React.FC<TypeCreatorProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError("Le nom du type est requis");
      return;
    }
    if (fields.some(f => !f.name.trim())) {
      setError("Tous les champs doivent avoir un nom");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const definition: TypeDefinitionDto = {
        fields: fields.reduce((acc, f) => {
          acc[f.name.trim()] = {
            type: { kind: f.type },
            required: true
          };
          return acc;
        }, {} as TypeDefinitionDto['fields']),
        // Default layout: a vertical stack of all fields
        layout: {
          type: 'stack',
          props: { direction: 'vertical' },
          bindings: {},
          actions: {},
          slots: {},
          children: fields.map(f => ({
            type: f.type === 'markdown' ? 'markdown' : 'text',
            props: f.type === 'markdown' ? {} : { style: f.name === 'title' ? 'header' : 'normal' },
            bindings: { value: f.name },
            actions: {},
            slots: {},
            children: []
          }))
        }
      };

      await workspaceService.registerType(name.toLowerCase().trim(), definition);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création du type");
    } finally {
      setIsSaving(false);
    }
  };

  const fieldTypes: FieldType[] = ['string', 'integer', 'float', 'boolean', 'markdown', 'url', 'color', 'blockid'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-card border shadow-2xl rounded-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <FileType className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Créer un nouveau Type</h2>
              <p className="text-xs text-muted-foreground">Définissez la structure et l'apparence de vos blocs</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-y-auto space-y-8">
          {/* Name Section */}
          <div className="space-y-3">
            <label className="text-sm font-bold flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Nom du Type
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: flashcard, task, habit..."
              className="w-full bg-secondary/50 border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            />
          </div>

          {/* Fields Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold flex items-center gap-2">
                <Layout className="h-4 w-4 text-primary" />
                Champs (Structure)
              </label>
              <button
                onClick={addField}
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/5 px-2 py-1 rounded-md transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter un champ
              </button>
            </div>

            <div className="space-y-3">
              {fields.length === 0 ? (
                <div className="py-8 border border-dashed rounded-xl flex flex-col items-center justify-center bg-secondary/10 text-muted-foreground animate-in fade-in duration-300">
                  <Layout className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm font-medium">Aucun champ défini</p>
                  <p className="text-[10px]">Cliquez sur "Ajouter un champ" pour commencer</p>
                </div>
              ) : (
                fields.map((field) => (
                  <div key={field.id} className="flex items-center gap-3 group">
                    <div className="flex-1 flex items-center gap-2 bg-secondary/30 border rounded-lg p-1">
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => updateField(field.id, { name: e.target.value })}
                        placeholder="Nom du champ"
                        className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none font-medium"
                      />
                      <div className="h-4 w-[1px] bg-border mx-1" />
                      <select
                        value={field.type}
                        onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                        className="bg-transparent px-3 py-2 text-sm focus:outline-none font-bold text-primary appearance-none cursor-pointer"
                      >
                        {fieldTypes.map(t => (
                          <option key={t} value={t}>{t.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => removeField(field.id)}
                      className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium rounded-lg animate-in shake-1 duration-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-secondary/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold hover:bg-accent rounded-lg transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-lg shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer le Type
          </button>
        </div>
      </div>
    </div>
  );
};
