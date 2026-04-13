import { memo } from 'react';

interface PropertyEditorProps {
  metadata: Record<string, any>;
  onMetadataChange: (newMetadata: Record<string, any>) => void;
}

export const PropertyEditor = memo(function PropertyEditor({ 
  metadata, 
  onMetadataChange 
}: PropertyEditorProps) {
  
  const handleFieldChange = (key: string, value: any) => {
    onMetadataChange({
      ...metadata,
      [key]: value
    });
  };

  const ignoredFields = ['id', 'position', 'type'];
  const fields = Object.entries(metadata).filter(([key]) => !ignoredFields.includes(key));

  if (fields.length === 0) {
    return (
      <div className="property-editor empty">
        <p>No extra properties to configure.</p>
      </div>
    );
  }

  return (
    <div className="property-editor">
      <div className="property-grid">
        {fields.map(([key, value]) => (
          <div key={key} className="property-row">
            <label htmlFor={`prop-${key}`}>{key}</label>
            {typeof value === 'boolean' ? (
              <input 
                id={`prop-${key}`}
                type="checkbox" 
                checked={value} 
                onChange={(e) => handleFieldChange(key, e.target.checked)} 
              />
            ) : typeof value === 'number' ? (
              <input 
                id={`prop-${key}`}
                type="number" 
                value={value} 
                onChange={(e) => handleFieldChange(key, Number(e.target.value))} 
              />
            ) : (
              <input 
                id={`prop-${key}`}
                type="text" 
                value={value || ''} 
                onChange={(e) => handleFieldChange(key, e.target.value)} 
                placeholder={`Value for ${key}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
