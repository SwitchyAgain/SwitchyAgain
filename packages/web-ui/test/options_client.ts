import {
  browserUiLocale,
  decodeBackgroundError,
  normalizeUiLocale,
  optionPatch,
  runtimeAvailable,
  uiLocaleForOptions
} from '../src/react/options_client';
import * as backgroundClient from '../src/react/background_client';
import * as i18nClient from '../src/react/i18n_client';
import * as navigationClient from '../src/react/navigation_client';
import * as optionsApiClient from '../src/react/options_api_client';
import * as optionsClient from '../src/react/options_client';
import * as optionPatchClient from '../src/react/option_patch';
import * as stateClient from '../src/react/state_client';

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

  it('keeps facade exports wired to split client modules', () => {
    expect(optionsClient.UI_LOCALES).toBe(i18nClient.UI_LOCALES);
    expect(optionsClient.browserUiLocale).toBe(i18nClient.browserUiLocale);
    expect(optionsClient.message).toBe(i18nClient.message);
    expect(optionsClient.normalizeUiLocale).toBe(i18nClient.normalizeUiLocale);
    expect(optionsClient.setUiLocale).toBe(i18nClient.setUiLocale);
    expect(optionsClient.uiLocaleForOptions).toBe(i18nClient.uiLocaleForOptions);

    expect(optionsClient.callBackground).toBe(backgroundClient.callBackground);
    expect(optionsClient.callBackgroundNoReply).toBe(backgroundClient.callBackgroundNoReply);
    expect(optionsClient.callBackgroundWithRefresh).toBe(backgroundClient.callBackgroundWithRefresh);
    expect(optionsClient.decodeBackgroundError).toBe(backgroundClient.decodeBackgroundError);
    expect(optionsClient.runtimeAvailable).toBe(backgroundClient.runtimeAvailable);

    expect(optionsClient.applyProfile).toBe(optionsApiClient.applyProfile);
    expect(optionsClient.explainRequest).toBe(optionsApiClient.explainRequest);
    expect(optionsClient.loadOptions).toBe(optionsApiClient.loadOptions);
    expect(optionsClient.patchAndLoadOptions).toBe(optionsApiClient.patchAndLoadOptions);
    expect(optionsClient.patchOptions).toBe(optionsApiClient.patchOptions);
    expect(optionsClient.renameProfile).toBe(optionsApiClient.renameProfile);
    expect(optionsClient.replaceRef).toBe(optionsApiClient.replaceRef);
    expect(optionsClient.resetOptions).toBe(optionsApiClient.resetOptions);
    expect(optionsClient.resetOptionsSync).toBe(optionsApiClient.resetOptionsSync);
    expect(optionsClient.setOptionsSync).toBe(optionsApiClient.setOptionsSync);
    expect(optionsClient.updateProfile).toBe(optionsApiClient.updateProfile);

    expect(optionsClient.getLocalState).toBe(stateClient.getLocalState);
    expect(optionsClient.getState).toBe(stateClient.getState);
    expect(optionsClient.lastUrl).toBe(stateClient.lastUrl);
    expect(optionsClient.setLocalState).toBe(stateClient.setLocalState);
    expect(optionsClient.setState).toBe(stateClient.setState);

    expect(optionsClient.downloadBlob).toBe(navigationClient.downloadBlob);
    expect(optionsClient.manifestVersion).toBe(navigationClient.manifestVersion);
    expect(optionsClient.openManage).toBe(navigationClient.openManage);
    expect(optionsClient.openOptions).toBe(navigationClient.openOptions);
    expect(optionsClient.openShortcutConfig).toBe(navigationClient.openShortcutConfig);
    expect(optionsClient.shouldAutoMount).toBe(navigationClient.shouldAutoMount);

    expect(optionsClient.optionPatch).toBe(optionPatchClient.optionPatch);
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
