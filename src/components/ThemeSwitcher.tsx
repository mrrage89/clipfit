import { useState } from 'react';
import { THEMES, applyTheme, loadTheme, type ThemeId } from '../theme/themes';
import { Select } from './Select';
import { Toggle } from './Toggle';

export function ThemeSwitcher() {
  const [choice, setChoice] = useState(loadTheme());

  function update(next: typeof choice) {
    setChoice(next);
    applyTheme(next);
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
      <Toggle
        on={choice.mode === 'dark'}
        onChange={(on) => update({ ...choice, mode: on ? 'dark' : 'light' })}
      >
        Dark
      </Toggle>
    </div>
  );
}
