import { useRef } from 'react';

export function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      style={{
        border: '2px dashed #ccc',
        padding: '3rem',
        textAlign: 'center',
        borderRadius: '8px',
        cursor: 'pointer',
        color: '#666',
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        accept="video/*"
        ref={inputRef}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div>Drop a video here, or click to choose</div>
      <small>Your file never leaves your device.</small>
    </div>
  );
}
