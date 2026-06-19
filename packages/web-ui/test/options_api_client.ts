// @vitest-environment jsdom

import {loadOptions, patchOptions, resetOptions, updateProfile} from '../src/react/options_api_client';
import type {ExtensionChromeApi, ExtensionRuntimeApi} from '../src/react/browser_env';
import type {Options, OptionsPatch} from '../src/react/options_client_types';

type TestGlobal = typeof globalThis & {
  chrome?: ExtensionChromeApi;
};

type RuntimeResponse = unknown | ((message: unknown) => unknown);
type RuntimeSendMessage = NonNullable<ExtensionRuntimeApi['sendMessage']>;

function testGlobal() {
  return globalThis as TestGlobal;
}

function optionsWithUi(uiTheme: string, uiLocale: string): Options {
  return {
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile'
    },
    '-uiLocale': uiLocale,
    '-uiTheme': uiTheme
  };
}

function installBackgroundResponses(responses: RuntimeResponse[]) {
  const messages: unknown[] = [];
  const sendMessage: RuntimeSendMessage = vi.fn((message, callback) => {
    messages.push(message);
    const response = responses.shift();
    callback(typeof response === 'function' ? response(message) : response);
  });
  testGlobal().chrome = {
    i18n: {
      getMessage: () => '',
      getUILanguage: () => 'en'
    },
    runtime: {
      getURL: (path) => `file://${path}`,
      sendMessage
    }
  };
  return {
    messages,
    sendMessage
  };
}

function expectAppliedUi(theme: string, effectiveTheme: string, locale: string, dir: string) {
  expect(document.documentElement.dataset.uiTheme).toBe(theme);
  expect(document.documentElement.dataset.effectiveTheme).toBe(effectiveTheme);
  expect(document.documentElement.lang).toBe(locale);
  expect(document.documentElement.dir).toBe(dir);
}

beforeEach(() => {
  document.documentElement.className = '';
  delete document.documentElement.dataset.uiTheme;
  delete document.documentElement.dataset.effectiveTheme;
  document.documentElement.lang = '';
  document.documentElement.dir = '';
  document.documentElement.style.colorScheme = '';
});

describe('options API client', () => {
  it('loads options through the background client and applies UI settings', async () => {
    const options = optionsWithUi('dark', 'fa');
    const {messages} = installBackgroundResponses([
      {
        result: options
      }
    ]);

    await expect(loadOptions()).resolves.toBe(options);

    expect(messages).toEqual([
      {
        args: [],
        method: 'getAll'
      }
    ]);
    expectAppliedUi('dark', 'dark', 'fa', 'rtl');
  });

  it('patches options and applies the returned UI settings', async () => {
    const patch: OptionsPatch = {
      '-uiTheme': ['light', 'dark']
    };
    const options = optionsWithUi('dark', 'en');
    const {messages} = installBackgroundResponses([
      {
        result: options
      }
    ]);

    await expect(patchOptions(patch)).resolves.toBe(options);

    expect(messages).toEqual([
      {
        args: [patch],
        method: 'patch'
      }
    ]);
    expectAppliedUi('dark', 'dark', 'en', 'ltr');
  });

  it('resets options with optional input and applies the returned UI settings', async () => {
    const options = optionsWithUi('light', 'zh-Hans');
    const {messages} = installBackgroundResponses([
      {
        result: options
      }
    ]);

    await expect(resetOptions('defaults')).resolves.toBe(options);

    expect(messages).toEqual([
      {
        args: ['defaults'],
        method: 'reset'
      }
    ]);
    expectAppliedUi('light', 'light', 'zh-Hans', 'ltr');
  });

  it('decodes profile update results and reloads options afterwards', async () => {
    const options = optionsWithUi('dark', 'en');
    const {messages} = installBackgroundResponses([
      {
        result: {
          proxy: {
            _error: 'error',
            message: 'Profile download failed',
            name: 'ProfileUpdateError',
            reason: 'bad_status',
            statusCode: 500
          },
          stable: {
            ok: true
          }
        }
      },
      {
        result: options
      }
    ]);

    const result = await updateProfile('proxy');

    expect(messages).toEqual([
      {
        args: ['proxy', 'bypass_cache'],
        method: 'updateProfile'
      },
      {
        args: [],
        method: 'getAll'
      }
    ]);
    expect(result.options).toBe(options);
    expect(result.results.proxy).toBeInstanceOf(Error);
    expect(result.results.proxy).toMatchObject({
      message: 'Profile download failed',
      name: 'ProfileUpdateError',
      reason: 'bad_status',
      statusCode: 500
    });
    expect(result.results.stable).toEqual({
      ok: true
    });
    expectAppliedUi('dark', 'dark', 'en', 'ltr');
  });

  it('rejects decoded background errors without applying options UI', async () => {
    installBackgroundResponses([
      {
        error: {
          _error: 'error',
          message: 'Options unavailable',
          name: 'OptionsError',
          reason: 'storage_failed'
        }
      }
    ]);

    await expect(loadOptions()).rejects.toMatchObject({
      message: 'Options unavailable',
      name: 'OptionsError',
      reason: 'storage_failed'
    });
    expect(document.documentElement.dataset.uiTheme).toBeUndefined();
    expect(document.documentElement.dataset.effectiveTheme).toBeUndefined();
  });
});
