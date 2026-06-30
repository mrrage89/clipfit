import { useEffect, useState } from 'react';
import { THEMES, applyTheme, loadTheme, type ThemeId } from '../theme/themes';
import { Select } from './Select';
import { Toggle } from './Toggle';

export function ThemeSwitcher() {
  const [choice, setChoice] = useState(loadTheme());

  // Re-apply the persisted theme on mount (handles reload + a custom accent).
  useEffect(() => {
    applyTheme(choice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(next: typeof choice) {
    setChoice(next);
    applyTheme(next);
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Select
        value={choice.theme}
        aria-label="Theme"
        onChange={(v) => update({ ...choice, theme: v as ThemeId })}
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
        <option value="custom">Custom</option>
      </Select>
      {choice.theme === 'custom' && (
        <input
          type="color"
          aria-label="Custom accent colour"
          title="Custom accent colour"
          value={choice.custom ?? '#7c6cf6'}
          onChange={(e) => update({ ...choice, theme: 'custom', custom: e.target.value })}
          style={{
            width: 32,
            height: 32,
            padding: 2,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            cursor: 'pointer',
          }}
        />
      )}
      <Toggle
        on={choice.mode === 'dark'}
        onChange={(on) => update({ ...choice, mode: on ? 'dark' : 'light' })}
      >
        Dark
      </Toggle>
    </div>
  );
}
