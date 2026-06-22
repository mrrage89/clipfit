import type { ReactNode, CSSProperties } from 'react';

// A select with a reliably-positioned chevron (a real SVG element, not a
// background-image that browsers position inconsistently).
export function Select({
  value,
  onChange,
  children,
  style,
  'aria-label': ariaLabel,
}: {
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
  style?: CSSProperties;
  'aria-label'?: string;
}) {
  return (
    <span className="select-wrap" style={style}>
      <select value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <svg
        className="select-chev"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  );
}
