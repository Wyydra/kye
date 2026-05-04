import React, { useState, useEffect, useRef, useMemo } from 'react';
import { workspaceService } from '../../services/WorkspaceService';
import styles from './CanvasMenu.module.css';
import { TemplateDto } from '../../types/workspace';
import { Icons } from './Icons';

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
        x: Math.round(worldX),
        y: Math.round(worldY),
        width: 300,
        height: 200,
      };

      // Add default values for required fields from template
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
      className={styles.menu} 
      style={{ left: x, top: y }}
    >
      <input 
        autoFocus
        className={styles.search}
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
      <div className={styles.list}>
        {filteredTemplates.map(template => (
          <div 
            key={template.name} 
            className={styles.item}
            onClick={() => handleSelect(template)}
          >
            <div className={styles.itemIcon}>
              {getIconForType(template.name)}
            </div>
            <div className={styles.itemName}>
              {template.name.charAt(0).toUpperCase() + template.name.slice(1)}
            </div>
            <div className={styles.itemType}>Node</div>
          </div>
        ))}
        {filteredTemplates.length === 0 && (
          <div className={styles.item} style={{ opacity: 0.5, cursor: 'default' }}>
            No results
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
