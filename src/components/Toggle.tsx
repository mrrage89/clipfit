import type { ReactNode } from 'react';

// Sliding on/off switch: a pill track with a knob that slides and fills the
// accent colour when on, with a label beside it.
export function Toggle({
  on,
  onChange,
  children,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="switch-track" aria-hidden="true">
        <span className="switch-knob" />
      </span>
      <span>{children}</span>
    </button>
  );
}
