import { memo, useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import type { FieldDefinitionDto } from '../../types/workspace';


interface PropertyEditorProps {
  blockType?: string;                          // ex: "image", "text"
  metadata: Record<string, any>;
  onMetadataChange: (newMetadata: Record<string, any>) => void;
}

interface FieldRowProps {
  fieldDef?: FieldDefinitionDto;               
  name: string;
  value: any;
  onChange: (value: any) => void;
}


function resolveInputKind(fieldDef?: FieldDefinitionDto, jsValue?: any): 'checkbox' | 'number' | 'text' {
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

const IGNORED_FIELDS = new Set(['id', 'position', 'type', 'title']);

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
        value={localValue}
        onChange={(e) => {
          const val = fieldDef?.field_type === 'Float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
          setLocalValue(isNaN(val) ? 0 : val);
          onChange(isNaN(val) ? 0 : val);
        }}
      />
    );
  }

  return (
    <input
      id={`prop-${name}`}
      type="text"
      value={String(localValue)}
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

  const templateDef = blockType
    ? templates.find(t => t.name === blockType)
    : undefined;

  const handleFieldChange = (key: string, value: any) => {
    onMetadataChange({ ...metadata, [key]: value });
  };

  const templateFields = templateDef?.fields.filter(f => !IGNORED_FIELDS.has(f.name)) ?? [];
  const templateFieldNames = new Set(templateFields.map(f => f.name));

  const orphanFields = Object.keys(metadata)
    .filter(k => !IGNORED_FIELDS.has(k) && !templateFieldNames.has(k));

  const hasContent = templateFields.length > 0 || orphanFields.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div className="property-editor">
      <div className="property-grid">
        {templateFields.map((fieldDef) => (
          <div key={fieldDef.name} className="property-row">
            <label htmlFor={`prop-${fieldDef.name}`}>{fieldDef.name}</label>
            <FieldRow
              fieldDef={fieldDef}
              name={fieldDef.name}
              value={metadata[fieldDef.name]}
              onChange={(val) => handleFieldChange(fieldDef.name, val)}
            />
          </div>
        ))}

        {orphanFields.map((key) => (
          <div key={key} className="property-row property-row--orphan">
            <label htmlFor={`prop-${key}`} title="Champ hors-schéma">{key} *</label>
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
