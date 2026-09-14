export type ThemeName = 'dark' | 'light' | 'midnight' | 'ocean' | 'forest' | 'sunset';

export interface ThemeVars {
  bg: string;
  surface1: string;
  surface2: string;
  border: string;
  primary: string;
  primaryFg: string;
  sidebar: string;
  text: string;
  muted: string;
}

export const THEMES: Record<ThemeName, ThemeVars> = {
  dark: {
    bg: '#0f1117',
    surface1: '#161a23',
    surface2: '#1f2530',
    border: '#2a3040',
    primary: '#7c5cff',
    primaryFg: '#ffffff',
    sidebar: '#0b0d13',
    text: '#e6eaf2',
    muted: '#8a92a6',
  },
  light: {
    bg: '#f5f7fb',
    surface1: '#ffffff',
    surface2: '#eef1f7',
    border: '#dfe4ee',
    primary: '#6d4dff',
    primaryFg: '#ffffff',
    sidebar: '#ffffff',
    text: '#1a2233',
    muted: '#6b7488',
  },
  midnight: {
    bg: '#0a0a0f',
    surface1: '#12121a',
    surface2: '#1c1c28',
    border: '#2a2a3a',
    primary: '#a78bfa',
    primaryFg: '#1a1a2e',
    sidebar: '#06060a',
    text: '#e2e8f0',
    muted: '#6b7280',
  },
  ocean: {
    bg: '#071523',
    surface1: '#0c1f36',
    surface2: '#132a4a',
    border: '#1d3a66',
    primary: '#38bdf8',
    primaryFg: '#06121f',
    sidebar: '#050f1a',
    text: '#c5e6ff',
    muted: '#5b7694',
  },
  forest: {
    bg: '#08130c',
    surface1: '#0d2012',
    surface2: '#142e19',
    border: '#1e4424',
    primary: '#34d399',
    primaryFg: '#07130d',
    sidebar: '#050d08',
    text: '#c8f2d6',
    muted: '#567a60',
  },
  sunset: {
    bg: '#1a0f2a',
    surface1: '#251638',
    surface2: '#32204a',
    border: '#4a2f66',
    primary: '#fb923c',
    primaryFg: '#201006',
    sidebar: '#120a1e',
    text: '#fde2c8',
    muted: '#8a6f9e',
  },
};

export const THEME_LABELS: Record<ThemeName, string> = {
  dark: 'Escuro',
  light: 'Claro',
  midnight: 'Meia-Noite',
  ocean: 'Oceano',
  forest: 'Floresta',
  sunset: 'Pôr do Sol',
};

export function applyTheme(name: ThemeName): void {
  const vars = THEMES[name];
  const root = document.documentElement;

  root.style.setProperty('--color-bg', vars.bg);
  root.style.setProperty('--color-surface-1', vars.surface1);
  root.style.setProperty('--color-surface-2', vars.surface2);
  root.style.setProperty('--color-border', vars.border);
  root.style.setProperty('--color-primary', vars.primary);
  root.style.setProperty('--color-primary-fg', vars.primaryFg);
  root.style.setProperty('--color-sidebar', vars.sidebar);
  root.style.setProperty('--color-text', vars.text);
  root.style.setProperty('--color-muted', vars.muted);

  root.classList.toggle('dark', name !== 'light');
}
