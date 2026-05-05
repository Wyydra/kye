import { memo, useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import type { FieldDefinitionDto } from '../../types/workspace';
import { cn } from '../../lib/utils';

// We only ignore internal metadata that shouldn't be edited directly as a "property"
const SYSTEM_FIELDS = new Set(['id', 'title']);

interface PropertyEditorProps {
  blockType?: string;
  metadata: Record<string, unknown>;
  onMetadataChange: (newMetadata: Record<string, unknown>) => void;
}

interface FieldRowProps {
  fieldDef?: FieldDefinitionDto;
  name: string;
  value: unknown;
  onChange: (value: unknown) => void;
  level?: number;
}

function resolveInputKind(fieldDef?: FieldDefinitionDto, jsValue?: unknown): 'checkbox' | 'number' | 'text' | 'object' | 'color' | 'id' {
  if (fieldDef) {
    const ft = fieldDef.field_type;
    if (ft === 'Boolean') return 'checkbox';
    if (ft === 'Integer' || ft === 'Float') return 'number';
    if (ft === 'Color') return 'color';
    if (ft === 'BlockId') return 'id';
    if (ft === 'Record' || ft.startsWith('Named:')) return 'object';
    return 'text';
  }
  if (typeof jsValue === 'boolean') return 'checkbox';
  if (typeof jsValue === 'number') return 'number';
  if (typeof jsValue === 'object' && jsValue !== null && !Array.isArray(jsValue)) return 'object';
  return 'text';
}

const FieldRow = memo(function FieldRow({ fieldDef, name, value, onChange, level = 0 }: FieldRowProps) {
  const [localValue, setLocalValue] = useState(value ?? '');

  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  const kind = resolveInputKind(fieldDef, value);

  // Recursive rendering for nested objects (Records)
  if (kind === 'object') {
    return (
      <div className="col-span-2 pl-4 border-l border-border/50 ml-2 py-2 flex flex-col gap-2">
        <PropertyEditor 
          metadata={(value as Record<string, unknown>) ?? {}} 
          onMetadataChange={onChange}
        />
      </div>
    );
  }

  const inputClasses = "w-full bg-background border border-border/50 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/30";

  if (kind === 'checkbox') {
    return (
      <div className="flex items-center h-8">
        <input
          id={`prop-${name}-${level}`}
          type="checkbox"
          checked={!!localValue}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
        />
      </div>
    );
  }

  if (kind === 'number') {
    return (
      <div className="flex items-center h-8">
        <input
          id={`prop-${name}-${level}`}
          type="number"
          step={fieldDef?.field_type === 'Float' ? 'any' : '1'}
          value={String(localValue)}
          onChange={(e) => {
            const val = fieldDef?.field_type === 'Float'
              ? parseFloat(e.target.value)
              : parseInt(e.target.value, 10);
            const safe = isNaN(val) ? 0 : val;
            setLocalValue(safe);
            onChange(safe);
          }}
          className={inputClasses}
        />
      </div>
    );
  }

  if (kind === 'color') {
    return (
      <div className="flex items-center h-8 gap-2">
        <input
          id={`prop-${name}-${level}`}
          type="color"
          value={String(localValue || '#000000')}
          onChange={(e) => {
            setLocalValue(e.target.value);
            onChange(e.target.value);
          }}
          className="h-6 w-10 bg-transparent border-none cursor-pointer"
        />
        <span className="text-[10px] font-mono opacity-50 uppercase">{String(localValue)}</span>
      </div>
    );
  }

  if (kind === 'id') {
    return (
      <div className="flex items-center h-8">
        <input
          id={`prop-${name}-${level}`}
          type="text"
          value={String(localValue)}
          readOnly
          className={cn(inputClasses, "font-mono text-[10px] bg-muted/30 border-dashed cursor-default")}
          title="Reference ID (Read-only)"
        />
      </div>
    );
  }

  const safeStr = (v: unknown) =>
    v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

  return (
    <div className="flex items-center h-8">
      <input
        id={`prop-${name}-${level}`}
        type="text"
        value={safeStr(localValue)}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={`Value for ${name}`}
        className={inputClasses}
      />
    </div>
  );
});

export const PropertyEditor = memo(function PropertyEditor({
  blockType,
  metadata,
  onMetadataChange,
}: PropertyEditorProps) {
  const { templates } = useWorkspace();

  // Find template for this block type
  const templateDef = useMemo(() => 
    blockType ? templates.find(t => t.name === blockType) : undefined
  , [blockType, templates]);

  const handleFieldChange = (key: string, value: unknown) => {
    onMetadataChange({ ...metadata, [key]: value });
  };

  // 1. Identify fields from the template (Schema)
  const templateFields = useMemo(() => 
    templateDef?.fields.filter(f => !SYSTEM_FIELDS.has(f.name)) ?? []
  , [templateDef]);

  const templateFieldNames = useMemo(() => 
    new Set(templateFields.map(f => f.name))
  , [templateFields]);

  // 2. Identify "Orphan" fields (present in metadata but not in template)
  const orphanFields = useMemo(() => 
    Object.keys(metadata).filter(k => 
      !SYSTEM_FIELDS.has(k) && !templateFieldNames.has(k)
    )
  , [metadata, templateFieldNames]);

  if (templateFields.length === 0 && orphanFields.length === 0) {
    return (
      <div className="p-4 text-[10px] text-muted-foreground/40 italic text-center uppercase tracking-widest">
        No properties
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-4 overflow-y-auto max-h-[300px]">
      <div className="grid grid-cols-[100px_1fr] items-start gap-x-4 gap-y-2">
        {/* Schema-defined fields (Primary) */}
        {templateFields.map((fieldDef) => (
          <div key={fieldDef.name} className="contents">
            <label 
              htmlFor={`prop-${fieldDef.name}-0`} 
              className="text-[11px] font-bold text-foreground/70 h-8 flex items-center truncate"
            >
              {fieldDef.name}
            </label>
            <FieldRow
              fieldDef={fieldDef}
              name={fieldDef.name}
              value={metadata[fieldDef.name]}
              onChange={(val) => handleFieldChange(fieldDef.name, val)}
            />
          </div>
        ))}

        {/* Dynamic/Orphan fields (Secondary) */}
        {orphanFields.length > 0 && (
          <>
            {orphanFields.map((key) => (
              <div key={key} className="contents">
                <label 
                  htmlFor={`prop-${key}-0`} 
                  className="text-[11px] font-medium text-muted-foreground/50 h-8 flex items-center truncate italic" 
                  title="Dynamic field (not in schema)"
                >
                  {key}*
                </label>
                <FieldRow
                  name={key}
                  value={metadata[key]}
                  onChange={(val) => handleFieldChange(key, val)}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
});
