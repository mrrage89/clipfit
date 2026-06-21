export type ThemeId = 'studio' | 'noir' | 'sunset';
export type Mode = 'dark' | 'light';

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'studio', label: 'Studio' },
  { id: 'noir', label: 'Neon Noir' },
  { id: 'sunset', label: 'Sunset' },
];

export interface ThemeChoice {
  theme: ThemeId;
  mode: Mode;
}

const KEY = 'clipfit-theme';
const DEFAULT: ThemeChoice = { theme: 'studio', mode: 'dark' };

export function applyTheme(choice: ThemeChoice): void {
  const el = document.documentElement;
  el.dataset.theme = choice.theme;
  el.dataset.mode = choice.mode;
  try {
    localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    /* ignore storage errors */
  }
}

export function loadTheme(): ThemeChoice {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ThemeChoice;
      if (parsed.theme && parsed.mode) return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT;
}
