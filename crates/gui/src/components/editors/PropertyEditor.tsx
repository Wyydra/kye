import { memo, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Hash,
  Type,
  CheckSquare,
  Link as LinkIcon,
  Palette,
  Layers,
  MoreHorizontal,
  Copy,
  ExternalLink,
  TextQuote,
  Maximize2,
  Image as ImageIcon
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { useWorkspace } from '../../context/WorkspaceContext';
import type { FieldDefinitionDto } from '../../types/workspace';
import { cn } from '../../lib/utils';

const SYSTEM_FIELDS = new Set(['id']);

interface PropertyEditorProps {
  blockType?: string;
  metadata: Record<string, unknown>;
  onMetadataChange: (newMetadata: Record<string, unknown>) => void;
}

const InputWrapper = ({ icon: Icon, label, children, isOrphan, onRemove }: any) => (
  <div className="group/row flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-accent/5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="text-muted-foreground/40">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider",
          isOrphan ? "text-muted-foreground/60 italic" : "text-foreground/70"
        )}>
          {label}
          {isOrphan && "*"}
        </span>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover/row:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      )}
    </div>
    <div className="flex-1">
      {children}
    </div>
  </div>
);

const PropertyInput = memo(({ type, value, onChange, placeholder }: any) => {
  const [localValue, setLocalValue] = useState(value ?? '');

  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  const handleChange = (val: any) => {
    setLocalValue(val);
    onChange(val);
  };

  const inputBase = "w-full bg-transparent border-none p-0 text-sm focus:outline-none placeholder:text-muted-foreground/20 font-medium";

  // CodeMirror extensions for rich editing
  const cmExtensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    EditorView.lineWrapping,
    EditorView.theme({
      "&": { height: "auto", minHeight: "80px", backgroundColor: "transparent", fontSize: "14px" },
      ".cm-content": { padding: "0px", lineHeight: "1.6" },
      ".cm-gutters": { display: "none" },
      "&.cm-focused": { outline: "none" }
    })
  ], []);

  // Normalize type to handle potential casing differences
  const normalizedType = typeof type === 'string' ? type.toLowerCase() : '';

  switch (normalizedType) {
    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleChange(!localValue)}
            className={cn(
              "flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              localValue ? "bg-primary" : "bg-muted"
            )}
          >
            <span className={cn(
              "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
              localValue ? "translate-x-4" : "translate-x-0"
            )} />
          </button>
          <span className="text-xs text-muted-foreground">{localValue ? "True" : "False"}</span>
        </div>
      );

    case 'integer':
    case 'float':
      return (
        <input
          type="number"
          value={localValue}
          onChange={(e) => handleChange(normalizedType === 'integer' ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
          className={cn(inputBase, "font-mono")}
          placeholder="0"
        />
      );

    case 'color':
      return (
        <div className="flex items-center gap-3">
          <div className="relative h-6 w-6 rounded-md border overflow-hidden shrink-0 group/color">
            <input
              type="color"
              value={localValue || '#000000'}
              onChange={(e) => handleChange(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div
              className="h-full w-full"
              style={{ backgroundColor: (localValue as string) || '#000000' }}
            />
          </div>
          <input
            type="text"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            className={cn(inputBase, "font-mono uppercase")}
            placeholder="#000000"
          />
        </div>
      );

    case 'markdown':
      return (
        <div className="mt-1 border-l-2 border-primary/10 pl-3 py-1 hover:border-primary/30 transition-colors">
          <CodeMirror
            value={String(localValue)}
            extensions={cmExtensions}
            onChange={handleChange}
            className="text-sm"
          />
        </div>
      );

    case 'image':
      return (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-secondary/50 text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" />
          </div>
          <input
            type="text"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            className={cn(inputBase, "text-[12px]")}
            placeholder="Image path or URL..."
          />
        </div>
      );

    case 'link':
      return (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            className={cn(inputBase, "text-primary underline underline-offset-4")}
            placeholder="https://..."
          />
          {localValue && (
            <a href={String(localValue)} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-accent rounded text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      );

    case 'blockid':
      return (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={localValue}
            readOnly
            className={cn(inputBase, "font-mono text-[11px] text-muted-foreground/60")}
          />
          <button
            onClick={() => navigator.clipboard.writeText(String(localValue))}
            className="p-1 hover:bg-accent rounded text-muted-foreground"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          className={inputBase}
          placeholder={placeholder || "Empty"}
        />
      );
  }
});

const getTypeIcon = (type: string) => {
  const t = typeof type === 'string' ? type.toLowerCase() : '';
  switch (t) {
    case 'boolean': return CheckSquare;
    case 'integer':
    case 'float': return Hash;
    case 'color': return Palette;
    case 'image': return ImageIcon;
    case 'link': return LinkIcon;
    case 'blockid': return Layers;
    case 'markdown': return TextQuote;
    default: return Type;
  }
};

/**
 * Main Component
 */
export const PropertyEditor = memo(function PropertyEditor({
  blockType,
  metadata,
  onMetadataChange,
}: PropertyEditorProps) {
  const { templates } = useWorkspace();

  const templateDef = useMemo(() =>
    blockType ? templates.find(t => t.name === blockType) : undefined
    , [blockType, templates]);

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    onMetadataChange({ ...metadata, [key]: value });
  }, [metadata, onMetadataChange]);

  const templateFields = useMemo(() =>
    templateDef?.fields.filter(f => !SYSTEM_FIELDS.has(f.name) && !f.name.startsWith('_')) ?? []
    , [templateDef]);

  const templateFieldNames = useMemo(() =>
    new Set(templateFields.map(f => f.name))
    , [templateFields]);

  const orphanFields = useMemo(() =>
    Object.keys(metadata).filter(k =>
      !SYSTEM_FIELDS.has(k) && !templateFieldNames.has(k) && !k.startsWith('_')
    )
    , [metadata, templateFieldNames]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden border-t">
      {/* Header / Subtitle */}
      <div className="px-4 py-3 border-b bg-secondary/20 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          Properties
        </span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-[10px] font-bold text-primary lowercase">{blockType || 'Generic'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border/50">
        {/* Schema Fields */}
        {templateFields.map((field) => (
          <InputWrapper
            key={field.name}
            label={field.name}
            icon={getTypeIcon(field.field_type as string)}
          >
            <PropertyInput
              type={field.field_type}
              value={metadata[field.name]}
              onChange={(val: any) => handleFieldChange(field.name, val)}
            />
          </InputWrapper>
        ))}

        {/* Orphan Fields */}
        {orphanFields.length > 0 && (
          <div className="bg-secondary/10">
            <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 flex items-center gap-2">
              <div className="h-[1px] flex-1 bg-border/50" />
              Additional Data
              <div className="h-[1px] flex-1 bg-border/50" />
            </div>
            {orphanFields.map((key) => (
              <InputWrapper
                key={key}
                label={key}
                icon={Type}
                isOrphan
                onRemove={() => {
                  const newMeta = { ...metadata };
                  delete newMeta[key];
                  onMetadataChange(newMeta);
                }}
              >
                <PropertyInput
                  value={metadata[key]}
                  onChange={(val: any) => handleFieldChange(key, val)}
                />
              </InputWrapper>
            ))}
          </div>
        )}

        {templateFields.length === 0 && orphanFields.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="p-3 rounded-full bg-secondary mb-3">
              <Layers className="h-5 w-5 text-muted-foreground/30" />
            </div>
            <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">
              No Properties Defined
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
