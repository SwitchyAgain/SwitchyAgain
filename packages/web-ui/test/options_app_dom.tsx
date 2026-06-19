// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {OptionsApp} from '../src/react/options_app';
import type {ExtensionChromeApi, ExtensionRuntimeApi} from '../src/react/browser_env';
import type {Options} from '../src/react/options_client_types';

type TestGlobal = typeof globalThis & {
  chrome?: ExtensionChromeApi;
};

type RuntimeSendMessage = NonNullable<ExtensionRuntimeApi['sendMessage']>;

function testGlobal() {
  return globalThis as TestGlobal;
}

function installOmegaPacMock() {
  (globalThis as any).OmegaPac = {
    Conditions: {
      getWeekdayList() {
        return [];
      }
    },
    Profiles: {
      create(spec: Record<string, unknown>) {
        return {...spec};
      },
      referencedBySet() {
        return {};
      },
      ruleListFormats: ['Switchy', 'AutoProxy'],
      updateRevision() {},
      validResultProfilesFor(_profile: unknown, options: Options) {
        return Object.keys(options)
          .filter((key) => key.charAt(0) === '+')
          .map((key) => options[key])
          .concat([
            {
              builtin: true,
              name: 'direct',
              profileType: 'DirectProfile'
            }
          ]);
      }
    }
  };
}

function optionsFixture(): Options {
  return {
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile'
    },
    '+rulelist': {
      defaultProfileName: 'direct',
      format: 'AutoProxy',
      matchProfileName: 'proxy',
      name: 'rulelist',
      profileType: 'RuleListProfile',
      sourceUrl: 'https://example.com/rules.txt'
    },
    '+auto': {
      defaultProfileName: 'direct',
      name: 'auto',
      profileType: 'SwitchProfile',
      rules: []
    },
    '+virtual': {
      defaultProfileName: 'proxy',
      name: 'virtual',
      profileType: 'VirtualProfile'
    },
    '-confirmDeletion': true,
    '-enableQuickSwitch': true,
    '-quickSwitchProfiles': ['direct', 'proxy'],
    '-showInspectMenu': true,
    '-uiLocale': 'en',
    '-uiTheme': 'light'
  };
}

function installBackground({
  getAllError,
  options = optionsFixture(),
  patchedOptions = options,
  renamedOptions,
  replacedOptions,
  resetOptions = options,
  updateProfileOptions,
  updateProfileResults = {}
}: {
  getAllError?: unknown;
  options?: Options;
  patchedOptions?: Options;
  renamedOptions?: Options;
  replacedOptions?: Options;
  resetOptions?: Options;
  updateProfileOptions?: Options;
  updateProfileResults?: Record<string, unknown>;
} = {}) {
  const requests: unknown[] = [];
  let currentOptions = options;
  const sendMessage: RuntimeSendMessage = vi.fn((request, callback) => {
    const typedRequest = request as {args?: unknown[]; method?: string};
    requests.push(request);
    if (typedRequest.method === 'getAll') {
      callback(getAllError ? {error: getAllError} : {result: currentOptions});
      return;
    }
    if (typedRequest.method === 'getState') {
      const key = typedRequest.args?.[0];
      const state: Record<string, unknown> = {
        currentProfileName: 'proxy',
        firstRun: '',
        isSystemProfile: false,
        profileScopeCapabilities: {
          container: false,
          tab: false,
          window: false
        },
        profileScopeContainers: [],
        proxyAuthCapabilities: {
          http: true,
          https: true,
          socks4: false,
          socks5: false
        },
        proxyDnsCapabilities: {
          socks5: false
        }
      };
      callback({
        result: Array.isArray(key)
          ? Object.fromEntries(key.map((stateKey) => [stateKey, state[stateKey]]))
          : typeof key === 'string'
            ? {[key]: state[key]}
            : {}
      });
      return;
    }
    if (typedRequest.method === 'patch') {
      currentOptions = patchedOptions;
      callback({result: currentOptions});
      return;
    }
    if (typedRequest.method === 'renameProfile') {
      currentOptions = renamedOptions || currentOptions;
      callback({result: currentOptions});
      return;
    }
    if (typedRequest.method === 'replaceRef') {
      currentOptions = replacedOptions || currentOptions;
      callback({result: currentOptions});
      return;
    }
    if (typedRequest.method === 'reset') {
      currentOptions = resetOptions;
      callback({result: currentOptions});
      return;
    }
    if (typedRequest.method === 'updateProfile') {
      currentOptions = updateProfileOptions || currentOptions;
      callback({result: updateProfileResults});
      return;
    }
    if (typedRequest.method === 'setState') {
      callback({result: typedRequest.args?.[0] || {}});
      return;
    }
    callback({result: undefined});
  });
  testGlobal().chrome = {
    i18n: {
      getMessage: () => '',
      getUILanguage: () => 'en'
    },
    runtime: {
      getManifest: () => ({
        manifest_version: 3,
        version: '0.0.0'
      }),
      getURL: (path) => path,
      sendMessage
    }
  };
  return {
    requests,
    sendMessage
  };
}

afterEach(() => {
  cleanup();
  window.location.hash = '';
  window.onbeforeunload = null;
  delete (globalThis as any).OmegaPac;
});

beforeEach(() => {
  installOmegaPacMock();
});

describe('options app', () => {
  it('loads options and navigates between shell routes', async () => {
    const {requests} = installBackground();
    window.location.hash = '#/about';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'About'});
    expect(screen.getByRole('link', {name: /proxy/})).toBeTruthy();
    expect(requests).toContainEqual({
      args: [
        [
          'currentProfileName',
          'isSystemProfile',
          'profileScopeCapabilities',
          'proxyAuthCapabilities',
          'proxyDnsCapabilities',
          'profileScopeContainers',
          'firstRun'
        ]
      ],
      method: 'getState'
    });

    fireEvent.click(screen.getByRole('link', {name: 'General'}));

    await screen.findByRole('heading', {name: 'General'});
    expect(window.location.hash).toBe('#/general');
    expect(requests).toContainEqual({
      args: [
        {
          'web.last_url': '/general'
        }
      ],
      method: 'setState'
    });
  });

  it('shows a top-level alert when initial options loading fails', async () => {
    installBackground({
      getAllError: {
        _error: 'error',
        message: 'Options failed to load',
        name: 'OptionsError'
      }
    });
    window.location.hash = '#/about';

    render(<OptionsApp />);

    await waitFor(() => expect(screen.getByText('Options failed to load')).toBeTruthy());
  });

  it('tracks dirty embedded page updates and applies option patches', async () => {
    const loadedOptions = optionsFixture();
    const patchedOptions = {
      ...loadedOptions,
      '-confirmDeletion': false
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    expect(requests.filter((request) => (request as {method?: string}).method === 'getState')).toHaveLength(1);

    fireEvent.click(screen.getByLabelText('Confirm before deleting profiles and rules.'));
    expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.');

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(requests).toContainEqual({
      args: [
        {
          '-confirmDeletion': [true, false]
        }
      ],
      method: 'patch'
    });
  });

  it('resets all options from the about maintenance flow', async () => {
    const loadedOptions = optionsFixture();
    const resetOptions = {
      ...optionsFixture(),
      '-confirmDeletion': false
    };
    const {requests} = installBackground({
      options: loadedOptions,
      resetOptions
    });
    window.location.hash = '#/about';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'About'});

    fireEvent.click(screen.getByRole('button', {name: 'Reset'}));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Reset Options'})).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', {name: 'Reset'}));

    await waitFor(() =>
      expect(requests).toContainEqual({
        args: [undefined],
        method: 'reset'
      })
    );
    await waitFor(() => expect(screen.getByText('options_resetSuccess')).toBeTruthy());
    expect(window.location.hash).toBe('#/about');
  });

  it('renames profiles using the returned options without reloading all options', async () => {
    const loadedOptions = optionsFixture();
    const renamedOptions: Options = {
      ...loadedOptions,
      '+renamed': {
        ...(loadedOptions['+proxy'] as Record<string, unknown>),
        name: 'renamed'
      },
      '-quickSwitchProfiles': ['direct', 'renamed']
    };
    delete (renamedOptions as Record<string, unknown>)['+proxy'];
    const {requests} = installBackground({
      options: loadedOptions,
      renamedOptions
    });
    window.location.hash = '#/profile/proxy';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: proxy/});
    fireEvent.click(screen.getByRole('button', {name: 'Rename'}));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('New profile name'), {
      target: {
        value: 'renamed'
      }
    });
    fireEvent.click(within(dialog).getByRole('button', {name: 'Rename'}));

    await screen.findByRole('heading', {name: /Profile :: renamed/});
    expect(window.location.hash).toBe('#/profile/renamed');
    expect(requests).toContainEqual({
      args: ['proxy', 'renamed'],
      method: 'renameProfile'
    });
    expect(requests.filter((request) => (request as {method?: string}).method === 'getAll')).toHaveLength(1);
  });

  it('replaces profile references using the returned options without reloading all options', async () => {
    const loadedOptions = optionsFixture();
    const replacedOptions: Options = {
      ...loadedOptions,
      '+auto': {
        ...(loadedOptions['+auto'] as Record<string, unknown>),
        defaultProfileName: 'virtual'
      },
      '-quickSwitchProfiles': ['direct', 'virtual']
    };
    const {requests} = installBackground({
      options: loadedOptions,
      replacedOptions
    });
    window.location.hash = '#/profile/virtual';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: virtual/});
    fireEvent.click(screen.getByRole('button', {name: 'Replace target profile'}));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Replace Profile'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Replace Profile'}));

    await waitFor(() =>
      expect(requests).toContainEqual({
        args: ['proxy', 'virtual'],
        method: 'replaceRef'
      })
    );
    expect(requests.filter((request) => (request as {method?: string}).method === 'getAll')).toHaveLength(1);
  });

  it('downloads profile updates with only the required options reload', async () => {
    const loadedOptions = optionsFixture();
    const updatedOptions: Options = {
      ...loadedOptions,
      '+rulelist': {
        ...(loadedOptions['+rulelist'] as Record<string, unknown>),
        lastUpdate: '2026-06-19T00:00:00.000Z',
        ruleList: '||example.com'
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      updateProfileOptions: updatedOptions,
      updateProfileResults: {
        '+rulelist': updatedOptions['+rulelist']
      }
    });
    window.location.hash = '#/profile/rulelist';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: rulelist/});
    fireEvent.click(screen.getByRole('button', {name: 'Download Profile Now'}));

    await waitFor(() =>
      expect(requests).toContainEqual({
        args: ['rulelist', 'bypass_cache'],
        method: 'updateProfile'
      })
    );
    await waitFor(() => expect(screen.getByText('options_profileDownloadSuccess')).toBeTruthy());
    expect(requests.filter((request) => (request as {method?: string}).method === 'getAll')).toHaveLength(2);
  });
});
