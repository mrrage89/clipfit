export interface Tool {
  id: string;
  label: string;
}

export function ToolPicker({
  tools,
  active,
  onSelect,
}: {
  tools: Tool[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={t.id === active ? 'primary' : ''}
          style={{ borderRadius: 20 }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
