import { useState } from 'react';
import { THEMES, applyTheme, loadTheme, type ThemeId } from '../theme/themes';

export function ThemeSwitcher() {
  const [choice, setChoice] = useState(loadTheme());

  function update(next: typeof choice) {
    setChoice(next);
    applyTheme(next);
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select
        value={choice.theme}
        aria-label="Theme"
        onChange={(e) => update({ ...choice, theme: e.target.value as ThemeId })}
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <button
        onClick={() => update({ ...choice, mode: choice.mode === 'dark' ? 'light' : 'dark' })}
        aria-label="Toggle light/dark mode"
      >
        {choice.mode === 'dark' ? 'Light' : 'Dark'}
      </button>
    </div>
  );
}
