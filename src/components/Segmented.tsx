// A 2+ option segmented pill (the "Hotels | Apartments" style). The active
// option gets `.primary` (solid accent); see `.segmented` in themes.css.
// `full` stretches it to fill its container (equal halves); otherwise it sizes
// to its content.
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  full,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
  full?: boolean;
}) {
  return (
    <div className={`segmented${full ? ' full' : ''}`} role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'primary' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
