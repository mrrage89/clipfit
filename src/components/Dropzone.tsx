import { useRef } from 'react';

export function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        border: '2px dashed var(--border)',
        padding: '3rem',
        textAlign: 'center',
        cursor: 'pointer',
        borderRadius: 'var(--radius)',
        background: 'color-mix(in srgb, var(--surface) 50%, transparent)',
      }}
    >
      <div style={{ fontSize: 16, marginBottom: 4 }}>Drop a video here, or click to choose</div>
      <small className="muted">Your file never leaves your device.</small>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
