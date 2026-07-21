import {browserUiLocale, normalizeUiLocale, uiLocaleForOptions} from '../src/react/i18n_client';

function installChromeMock(language = 'en-US') {
  (globalThis as any).chrome = {
    i18n: {
      getUILanguage: () => language
    }
  };
}

describe('i18n client', () => {
  beforeEach(() => {
    installChromeMock();
  });

  it('normalizes supported UI locale values and extension locale names', () => {
    expect(normalizeUiLocale('zh_Hans')).toBe('zh-Hans');
    expect(normalizeUiLocale('zh_TW')).toBe('zh-Hant');
    expect(normalizeUiLocale('es')).toBe('es');
    expect(normalizeUiLocale('unknown')).toBeNull();
    expect(normalizeUiLocale(null)).toBeNull();
  });

  it('maps browser UI languages to bundled locales', () => {
    expect(browserUiLocale('zh-CN')).toBe('zh-Hans');
    expect(browserUiLocale('zh-HK')).toBe('zh-Hant');
    expect(browserUiLocale('cs-CZ')).toBe('cs');
    expect(browserUiLocale('fr-FR')).toBe('en');
  });

  it('uses explicit option locale before browser locale', () => {
    installChromeMock('zh-CN');

    expect(uiLocaleForOptions({'-uiLocale': 'ru'})).toBe('ru');
    expect(uiLocaleForOptions({'-uiLocale': 'not-bundled'})).toBe('zh-Hans');
  });
});
