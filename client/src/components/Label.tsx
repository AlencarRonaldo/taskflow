import React from 'react';
import { Badge } from 'react-bootstrap';

interface LabelProps {
  id: number;
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  onRemove?: (labelId: number) => void;
  showRemove?: boolean;
}

export const Label: React.FC<LabelProps> = ({ 
  id, 
  name, 
  color, 
  size = 'sm',
  onRemove,
  showRemove = false 
}) => {
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(id);
    }
  };

  const getTextColor = (backgroundColor: string) => {
    // Convert hex to RGB
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white text for dark colors, black for light colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  const badgeStyle = {
    backgroundColor: color,
    color: getTextColor(color),
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: size === 'sm' ? '0.75rem' : size === 'md' ? '0.875rem' : '1rem',
    fontWeight: '500' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    maxWidth: '120px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  return (
    <Badge 
      style={badgeStyle}
      title={name}
      className="user-select-none"
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {name}
      </span>
      {showRemove && onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            padding: '0',
            marginLeft: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            lineHeight: '1'
          }}
          title="Remove label"
        >
          ×
        </button>
      )}
    </Badge>
  );
};