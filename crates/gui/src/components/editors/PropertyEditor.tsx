import { memo, useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import type { FieldDefinitionDto } from '../../types/workspace';
import styles from './PropertyEditor.module.css';

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

  if (kind === 'checkbox') {
    return (
      <input
        id={`prop-${name}`}
        type="checkbox"
        checked={!!localValue}
        onChange={(e) => onChange(e.target.checked)}
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
    <div className={styles.editor}>
      <div className={styles.grid}>
        {templateFields.map((fieldDef) => (
          <div key={fieldDef.name} className={styles.row}>
            <label htmlFor={`prop-${fieldDef.name}`} className={styles.label}>{fieldDef.name}</label>
            <FieldRow
              fieldDef={fieldDef}
              name={fieldDef.name}
              value={metadata[fieldDef.name]}
              onChange={(val) => handleFieldChange(fieldDef.name, val)}
            />
          </div>
        ))}

        {orphanFields.map((key) => (
          <div key={key} className={`${styles.row} ${styles.orphan}`}>
            <label htmlFor={`prop-${key}`} className={styles.label} title="Out-of-schema field">{key} *</label>
            <FieldRow
              name={key}
              value={metadata[key]}
              onChange={(val) => handleFieldChange(key, val)}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
