import {effectiveUiTheme, normalizeUiTheme, uiThemeForOptions} from '../src/react/ui_theme';

describe('ui theme logic', () => {
  it('normalizes theme option values with light as the compatibility default', () => {
    expect(normalizeUiTheme('dark')).toBe('dark');
    expect(normalizeUiTheme('system')).toBe('system');
    expect(normalizeUiTheme('light')).toBe('light');
    expect(normalizeUiTheme('unknown')).toBe('light');
    expect(normalizeUiTheme(undefined)).toBe('light');
    expect(uiThemeForOptions({})).toBe('light');
  });

  it('resolves the effective theme from system preference only for system mode', () => {
    expect(effectiveUiTheme('dark', false)).toBe('dark');
    expect(effectiveUiTheme('light', true)).toBe('light');
    expect(effectiveUiTheme('system', true)).toBe('dark');
    expect(effectiveUiTheme('system', false)).toBe('light');
  });
});
