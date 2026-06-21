import type { FC } from 'react';

export interface Tool {
  id: string;
  label: string;
}

export interface ToolPickerProps {
  tools: Tool[];
  active: string;
  onSelect: (id: string) => void;
}

export const ToolPicker: FC<ToolPickerProps> = ({ tools, active, onSelect }) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  };

  const buttonBaseStyle: React.CSSProperties = {
    padding: '8px 12px',
    cursor: 'pointer',
    borderRadius: '4px',
    border: 'none',
    fontSize: '14px',
    transition: 'background-color 0.2s, color 0.2s',
  };

  return (
    <div style={containerStyle}>
      {tools.map((tool) => {
        const isActive = tool.id === active;
        const buttonStyle: React.CSSProperties = {
          ...buttonBaseStyle,
          backgroundColor: isActive ? '#007bff' : '#f0f0f0',
          color: isActive ? '#fff' : '#000',
          fontWeight: isActive ? 'bold' : 'normal',
          border: isActive ? '2px solid #0056b3' : '1px solid #ccc',
        };
        return (
          <button
            key={tool.id}
            style={buttonStyle}
            onClick={() => onSelect(tool.id)}
          >
            {tool.label}
          </button>
        );
      })}
    </div>
  );
};
