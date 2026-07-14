// @vitest-environment jsdom

import {
  applyProfile,
  explainRequest,
  loadOptions,
  patchAndLoadOptions,
  patchOptions,
  renameProfile,
  replaceRef,
  resetOptions,
  resetOptionsSync,
  setOptionsSync,
  updateProfile
} from '../src/react/options_api_client';
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

function expectAppliedUi(theme: string, effectiveTheme: string, locale: string) {
  expect(document.documentElement.dataset.uiTheme).toBe(theme);
  expect(document.documentElement.dataset.effectiveTheme).toBe(effectiveTheme);
  expect(document.documentElement.lang).toBe(locale);
  expect(document.documentElement.hasAttribute('dir')).toBe(false);
}

beforeEach(() => {
  document.documentElement.className = '';
  delete document.documentElement.dataset.uiTheme;
  delete document.documentElement.dataset.effectiveTheme;
  document.documentElement.lang = '';
  document.documentElement.dir = 'rtl';
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
    expectAppliedUi('dark', 'dark', 'fa');
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
    expectAppliedUi('dark', 'dark', 'en');
  });

  it('patches options and reloads options afterwards', async () => {
    const patch = optionsWithUi('dark', 'fa');
    const patchedOptions = optionsWithUi('dark', 'fa');
    const loadedOptions = optionsWithUi('light', 'en');
    const {messages} = installBackgroundResponses([
      {
        result: patchedOptions
      },
      {
        result: loadedOptions
      }
    ]);

    await expect(patchAndLoadOptions(patch)).resolves.toBe(loadedOptions);

    expect(messages).toEqual([
      {
        args: [patch],
        method: 'patch'
      },
      {
        args: [],
        method: 'getAll'
      }
    ]);
    expectAppliedUi('light', 'light', 'en');
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
    expectAppliedUi('light', 'light', 'zh-Hans');
  });

  it('applies a profile with active-page refresh enabled', async () => {
    const result = {
      applied: true
    };
    const {messages} = installBackgroundResponses([
      {
        result
      }
    ]);

    await expect(applyProfile('proxy')).resolves.toBe(result);

    expect(messages).toEqual([
      {
        args: ['proxy'],
        method: 'applyProfile',
        refreshActivePage: true
      }
    ]);
  });

  it('wraps options sync background calls', async () => {
    const {messages} = installBackgroundResponses([
      {
        result: undefined
      },
      {
        result: undefined
      }
    ]);

    await expect(setOptionsSync(true, {remote: 'sync'})).resolves.toBeUndefined();
    await expect(resetOptionsSync()).resolves.toBeUndefined();

    expect(messages).toEqual([
      {
        args: [true, {remote: 'sync'}],
        method: 'setOptionsSync'
      },
      {
        args: [],
        method: 'resetOptionsSync'
      }
    ]);
  });

  it('requests background explanations for matching requests', async () => {
    const explanation = {
      final: {
        kind: 'profile',
        profile: {
          name: 'proxy'
        }
      },
      request: {
        host: 'example.com',
        url: 'https://example.com/'
      },
      steps: [
        {
          kind: 'profile',
          profile: {
            name: 'proxy'
          }
        }
      ],
      tempRulesActive: false,
      warnings: []
    };
    const args = {
      includeTempRules: true,
      profileName: 'auto switch',
      url: 'https://example.com/'
    };
    const {messages} = installBackgroundResponses([
      {
        result: explanation
      }
    ]);

    await expect(explainRequest(args)).resolves.toBe(explanation);

    expect(messages).toEqual([
      {
        args: [args],
        method: 'explainRequest'
      }
    ]);
  });

  it('renames profiles and applies the returned options', async () => {
    const renamedOptions = optionsWithUi('dark', 'fa');
    const {messages} = installBackgroundResponses([
      {
        result: renamedOptions
      }
    ]);

    await expect(renameProfile('old', 'new')).resolves.toBe(renamedOptions);

    expect(messages).toEqual([
      {
        args: ['old', 'new'],
        method: 'renameProfile'
      }
    ]);
    expectAppliedUi('dark', 'dark', 'fa');
  });

  it('replaces profile references and applies the returned options', async () => {
    const replacedOptions = optionsWithUi('light', 'zh-Hans');
    const {messages} = installBackgroundResponses([
      {
        result: replacedOptions
      }
    ]);

    await expect(replaceRef('old', 'new')).resolves.toBe(replacedOptions);

    expect(messages).toEqual([
      {
        args: ['old', 'new'],
        method: 'replaceRef'
      }
    ]);
    expectAppliedUi('light', 'light', 'zh-Hans');
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
    expectAppliedUi('dark', 'dark', 'en');
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
