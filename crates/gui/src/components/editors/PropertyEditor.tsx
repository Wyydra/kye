import { memo, useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import type { FieldDefinitionDto } from '../../types/workspace';
import { cn } from '../../lib/utils';

const IGNORED_FIELDS = new Set(['id', 'position', 'size', 'width', 'height', 'type', 'title']);

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
}

function resolveInputKind(fieldDef?: FieldDefinitionDto, jsValue?: unknown): 'checkbox' | 'number' | 'text' {
  if (fieldDef) {
    const ft = fieldDef.field_type;
    if (ft === 'Boolean') return 'checkbox';
    if (ft === 'Integer' || ft === 'Float') return 'number';
    return 'text';
  }
  if (typeof jsValue === 'boolean') return 'checkbox';
  if (typeof jsValue === 'number') return 'number';
  return 'text';
}

const FieldRow = memo(function FieldRow({ fieldDef, name, value, onChange }: FieldRowProps) {
  const [localValue, setLocalValue] = useState(value ?? '');

  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  const kind = resolveInputKind(fieldDef, value);

  const inputClasses = "w-full bg-background border border-border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-ring outline-none transition-all";

  if (kind === 'checkbox') {
    return (
      <input
        id={`prop-${name}`}
        type="checkbox"
        checked={!!localValue}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
      />
    );
  }

  if (kind === 'number') {
    return (
      <input
        id={`prop-${name}`}
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
    );
  }

  const safeStr = (v: unknown) =>
    v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

  return (
    <input
      id={`prop-${name}`}
      type="text"
      value={safeStr(localValue)}
      onChange={(e) => {
        setLocalValue(e.target.value);
        onChange(e.target.value);
      }}
      placeholder={`Value for ${name}`}
      className={inputClasses}
    />
  );
});

export const PropertyEditor = memo(function PropertyEditor({
  blockType,
  metadata,
  onMetadataChange,
}: PropertyEditorProps) {
  const { templates } = useWorkspace();

  const templateDef = blockType ? templates.find(t => t.name === blockType) : undefined;

  const handleFieldChange = (key: string, value: unknown) => {
    onMetadataChange({ ...metadata, [key]: value });
  };

  const templateFields = templateDef?.fields.filter(f => !IGNORED_FIELDS.has(f.name)) ?? [];
  const templateFieldNames = new Set(templateFields.map(f => f.name));
  const orphanFields = Object.keys(metadata).filter(k => !IGNORED_FIELDS.has(k) && !templateFieldNames.has(k));

  if (templateFields.length === 0 && orphanFields.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-[100px_1fr] items-center gap-x-4 gap-y-3">
        {templateFields.map((fieldDef) => (
          <div key={fieldDef.name} className="contents">
            <label 
              htmlFor={`prop-${fieldDef.name}`} 
              className="text-xs font-medium text-muted-foreground truncate"
            >
              {fieldDef.name}
            </label>
            <div className="flex items-center h-8">
              <FieldRow
                fieldDef={fieldDef}
                name={fieldDef.name}
                value={metadata[fieldDef.name]}
                onChange={(val) => handleFieldChange(fieldDef.name, val)}
              />
            </div>
          </div>
        ))}

        {orphanFields.map((key) => (
          <div key={key} className="contents opacity-70">
            <label 
              htmlFor={`prop-${key}`} 
              className="text-xs font-medium text-muted-foreground truncate italic" 
              title="Out-of-schema field"
            >
              {key} *
            </label>
            <div className="flex items-center h-8">
              <FieldRow
                name={key}
                value={metadata[key]}
                onChange={(val) => handleFieldChange(key, val)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
