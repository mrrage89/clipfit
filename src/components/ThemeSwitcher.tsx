import { useState } from 'react';
import { THEMES, applyTheme, loadTheme, type ThemeId } from '../theme/themes';
import { Select } from './Select';

export function ThemeSwitcher() {
  const [choice, setChoice] = useState(loadTheme());

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
      </Select>
      <button
        onClick={() => update({ ...choice, mode: choice.mode === 'dark' ? 'light' : 'dark' })}
        aria-label="Toggle light/dark mode"
      >
        {choice.mode === 'dark' ? 'Light' : 'Dark'}
      </button>
    </div>
  );
}
