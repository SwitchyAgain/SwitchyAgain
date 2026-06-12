import {
  browserUiLocale,
  decodeBackgroundError,
  normalizeUiLocale,
  optionPatch,
  runtimeAvailable,
  uiLocaleForOptions
} from '../src/react/options_client';

function installChromeMock(language = 'en-US') {
  (globalThis as any).chrome = {
    i18n: {
      getUILanguage: () => language
    },
    runtime: {
      sendMessage() {}
    }
  };
}

describe('options client helpers', () => {
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

  it('reports whether runtime messaging is available', () => {
    expect(runtimeAvailable()).toBe(true);
    (globalThis as any).chrome = {};
    expect(runtimeAvailable()).toBe(false);
  });

  it('decodes serialized background errors', () => {
    const decoded = decodeBackgroundError({
      _error: 'error',
      message: 'Download failed',
      name: 'NetworkError',
      original: {
        statusCode: 502
      },
      reason: 'bad_gateway',
      stack: 'remote stack',
      statusCode: 502
    });

    expect(decoded).toBeInstanceOf(Error);
    expect((decoded as Error).message).toBe('Download failed');
    expect((decoded as Error).name).toBe('NetworkError');
    expect((decoded as {reason?: string}).reason).toBe('bad_gateway');
    expect((decoded as {statusCode?: number}).statusCode).toBe(502);
  });

  it('leaves non-serialized background errors unchanged', () => {
    const raw = {message: 'missing name'};

    expect(decodeBackgroundError(raw)).toBe(raw);
  });

  it('builds shallow option patches for changed keys', () => {
    expect(
      optionPatch(
        {
          keep: true,
          remove: 'old',
          replace: 'before'
        },
        {
          add: 'new',
          keep: true,
          replace: 'after'
        },
        ['add', 'keep', 'remove', 'replace']
      )
    ).toEqual({
      add: [undefined, 'new'],
      remove: ['old', undefined],
      replace: ['before', 'after']
    });
  });
});
