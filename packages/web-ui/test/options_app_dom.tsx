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
    '+pac': {
      name: 'pac',
      pacScript: '',
      profileType: 'PacProfile'
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

function patchRequests(requests: unknown[]) {
  return requests.filter((request) => (request as {method?: string}).method === 'patch') as Array<{args?: unknown[]; method: string}>;
}

function requestMethods(requests: unknown[]) {
  return requests.map((request) => (request as {method?: string}).method);
}

function firstPatch(requests: unknown[]) {
  return patchRequests(requests)[0]?.args?.[0] as Record<string, unknown> | undefined;
}

function profilePatchValue(patch: Record<string, unknown> | undefined, key: string) {
  return (patch?.[key] as unknown[] | undefined)?.[1] as Record<string, unknown> | undefined;
}

function changeProfileSelect(label: string, name: string) {
  const group = screen.getByText(label).closest('.form-group') as HTMLElement;
  fireEvent.click(within(group).getByRole('listbox'));
  fireEvent.click(within(group).getByRole('option', {name}).querySelector('a') as HTMLAnchorElement);
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

  it('saves fixed profile proxy edits through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const patchedOptions: Options = {
      ...loadedOptions,
      '+proxy': {
        ...(loadedOptions['+proxy'] as Record<string, unknown>),
        fallbackProxy: {
          host: 'proxy.example.com',
          port: 8080,
          scheme: 'http'
        }
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/proxy';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: proxy/});
    const proxyServers = screen.getByRole('heading', {name: 'Proxy Servers'}).closest('section') as HTMLElement;

    fireEvent.change(within(proxyServers).getAllByRole('combobox')[0], {
      target: {
        value: 'http'
      }
    });
    fireEvent.change(within(proxyServers).getByDisplayValue('example.com'), {
      target: {
        value: 'proxy.example.com'
      }
    });
    fireEvent.change(within(proxyServers).getByDisplayValue('80'), {
      target: {
        value: '8080'
      }
    });
    expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.');

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+proxy')).toMatchObject({
      fallbackProxy: {
        host: 'proxy.example.com',
        port: 8080,
        scheme: 'http'
      }
    });
  });

  it('saves PAC profile script edits through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const pacScript = 'function FindProxyForURL() { return "DIRECT"; }';
    const patchedOptions: Options = {
      ...loadedOptions,
      '+pac': {
        ...(loadedOptions['+pac'] as Record<string, unknown>),
        pacScript
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/pac';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: pac/});
    fireEvent.change(document.querySelector('textarea') as HTMLTextAreaElement, {
      target: {
        value: pacScript
      }
    });

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+pac')).toMatchObject({
      pacScript
    });
  });

  it('saves rule list source edits through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const nextSourceUrl = 'https://cdn.example.com/rules.txt';
    const patchedOptions: Options = {
      ...loadedOptions,
      '+rulelist': {
        ...(loadedOptions['+rulelist'] as Record<string, unknown>),
        sourceUrl: nextSourceUrl
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/rulelist';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: rulelist/});
    fireEvent.change(screen.getByDisplayValue('https://example.com/rules.txt'), {
      target: {
        value: nextSourceUrl
      }
    });

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+rulelist')).toMatchObject({
      sourceUrl: nextSourceUrl
    });
  });

  it('saves virtual profile target edits through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const patchedOptions: Options = {
      ...loadedOptions,
      '+virtual': {
        ...(loadedOptions['+virtual'] as Record<string, unknown>),
        defaultProfileName: 'direct'
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/virtual';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: virtual/});
    changeProfileSelect('Target', 'direct');

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+virtual')).toMatchObject({
      defaultProfileName: 'direct'
    });
  });

  it('applies dirty profile edits before opening profile rename actions', async () => {
    const loadedOptions = optionsFixture();
    const pacScript = 'function FindProxyForURL() { return "PROXY 127.0.0.1:8080"; }';
    const patchedOptions: Options = {
      ...loadedOptions,
      '+pac': {
        ...(loadedOptions['+pac'] as Record<string, unknown>),
        pacScript
      }
    };
    const renamedOptions: Options = {
      ...patchedOptions,
      '+pac2': {
        ...(patchedOptions['+pac'] as Record<string, unknown>),
        name: 'pac2'
      }
    };
    delete (renamedOptions as Record<string, unknown>)['+pac'];
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions,
      renamedOptions
    });
    window.location.hash = '#/profile/pac';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: pac/});
    fireEvent.change(document.querySelector('textarea') as HTMLTextAreaElement, {
      target: {
        value: pacScript
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Rename'}));

    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Rename Profile'})).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('New profile name'), {
      target: {
        value: 'pac2'
      }
    });
    fireEvent.click(within(dialog).getByRole('button', {name: 'Rename'}));

    await screen.findByRole('heading', {name: /Profile :: pac2/});
    const methods = requestMethods(requests);
    expect(methods.indexOf('patch')).toBeGreaterThan(-1);
    expect(methods.indexOf('renameProfile')).toBeGreaterThan(methods.indexOf('patch'));
    expect(profilePatchValue(firstPatch(requests), '+pac')).toMatchObject({
      pacScript
    });
    expect(requests).toContainEqual({
      args: ['pac', 'pac2'],
      method: 'renameProfile'
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
