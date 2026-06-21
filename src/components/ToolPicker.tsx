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
    <div className="segmented">
      {tools.map((t) => (
        <button key={t.id} onClick={() => onSelect(t.id)} className={t.id === active ? 'primary' : ''}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
