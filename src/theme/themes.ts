export type ThemeId = 'studio' | 'noir' | 'sunset' | 'forest' | 'ocean' | 'rose' | 'custom';
export type Mode = 'dark' | 'light';

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'studio', label: 'Studio' },
  { id: 'noir', label: 'Neon Noir' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'forest', label: 'Forest' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'rose', label: 'Rose' },
];

export interface ThemeChoice {
  theme: ThemeId;
  mode: Mode;
  custom?: string; // hex accent, used when theme === 'custom'
}

const KEY = 'clipfit-theme';
const DEFAULT: ThemeChoice = { theme: 'studio', mode: 'dark' };
const ACCENT_VARS = ['--accent', '--accent-2', '--glow', '--on-accent'] as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function lighten({ r, g, b }: { r: number; g: number; b: number }, amt: number) {
  return {
    r: Math.round(r + (255 - r) * amt),
    g: Math.round(g + (255 - g) * amt),
    b: Math.round(b + (255 - b) * amt),
  };
}

export function applyTheme(choice: ThemeChoice): void {
  const el = document.documentElement;
  el.dataset.theme = choice.theme;
  el.dataset.mode = choice.mode;
  if (choice.theme === 'custom' && choice.custom) {
    // Derive the accent family from the picked colour; base (bg/surface/text)
    // comes from the neutral [data-theme='custom'] block in themes.css.
    const rgb = hexToRgb(choice.custom);
    const a2 = lighten(rgb, 0.22);
    const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    el.style.setProperty('--accent', choice.custom);
    el.style.setProperty('--accent-2', `rgb(${a2.r},${a2.g},${a2.b})`);
    el.style.setProperty('--glow', `rgba(${rgb.r},${rgb.g},${rgb.b},0.4)`);
    el.style.setProperty('--on-accent', lum > 0.6 ? '#0b0b12' : '#ffffff');
  } else {
    for (const v of ACCENT_VARS) el.style.removeProperty(v);
  }
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
