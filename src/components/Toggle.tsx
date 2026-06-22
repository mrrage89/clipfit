import type { ReactNode } from 'react';

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
    <button type="button" aria-pressed={on} className={on ? 'toggle-on' : ''} onClick={() => onChange(!on)}>
      {children}
    </button>
  );
}
