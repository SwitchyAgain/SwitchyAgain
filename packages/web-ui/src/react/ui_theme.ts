export type UiTheme = 'light' | 'dark' | 'system';
export type EffectiveUiTheme = 'light' | 'dark';

export type UiThemeOption = {
  fallback: string;
  messageKey: string;
  value: UiTheme;
};

export const UI_THEME_ICON = 'glyphicon-adjust';

export const UI_THEMES: UiThemeOption[] = [
  {
    fallback: 'Light',
    messageKey: 'options_interfaceThemeLight',
    value: 'light'
  },
  {
    fallback: 'Dark',
    messageKey: 'options_interfaceThemeDark',
    value: 'dark'
  },
  {
    fallback: 'System',
    messageKey: 'options_interfaceThemeSystem',
    value: 'system'
  }
];

let darkModeQuery: MediaQueryList | null = null;
let darkModeListener: ((event: MediaQueryListEvent) => void) | null = null;

export function normalizeUiTheme(value: unknown): UiTheme {
  return value === 'dark' || value === 'system' ? value : 'light';
}

export function uiThemeForOptions(options?: {'-uiTheme'?: unknown} | null): UiTheme {
  return normalizeUiTheme(options?.['-uiTheme']);
}

export function effectiveUiTheme(theme: unknown, systemPrefersDark = false): EffectiveUiTheme {
  const normalized = normalizeUiTheme(theme);
  return normalized === 'dark' || (normalized === 'system' && systemPrefersDark) ? 'dark' : 'light';
}

function removeSystemListener() {
  if (!darkModeQuery || !darkModeListener) {
    darkModeQuery = null;
    darkModeListener = null;
    return;
  }
  if (darkModeQuery.removeEventListener) {
    darkModeQuery.removeEventListener('change', darkModeListener);
  } else {
    darkModeQuery.removeListener?.(darkModeListener);
  }
  darkModeQuery = null;
  darkModeListener = null;
}

function setDocumentTheme(theme: UiTheme, systemPrefersDark: boolean) {
  const effective = effectiveUiTheme(theme, systemPrefersDark);
  document.documentElement.classList.toggle('theme-dark', effective === 'dark');
  document.documentElement.classList.toggle('theme-light', effective === 'light');
  document.documentElement.dataset.uiTheme = theme;
  document.documentElement.dataset.effectiveTheme = effective;
  document.documentElement.style.colorScheme = effective;
}

export function applyUiTheme(themeValue: unknown) {
  const theme = normalizeUiTheme(themeValue);
  removeSystemListener();

  if (theme !== 'system' || typeof window.matchMedia !== 'function') {
    setDocumentTheme(theme, false);
    return theme;
  }

  darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeListener = (event) => setDocumentTheme(theme, event.matches);
  setDocumentTheme(theme, darkModeQuery.matches);
  if (darkModeQuery.addEventListener) {
    darkModeQuery.addEventListener('change', darkModeListener);
  } else {
    darkModeQuery.addListener?.(darkModeListener);
  }
  return theme;
}
