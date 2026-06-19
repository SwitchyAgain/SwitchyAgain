// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
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

function optionsFixture(): Options {
  return {
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile'
    },
    '+auto': {
      defaultProfileName: 'direct',
      name: 'auto',
      profileType: 'SwitchProfile',
      rules: []
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
  patchedOptions = options
}: {
  getAllError?: unknown;
  options?: Options;
  patchedOptions?: Options;
} = {}) {
  const requests: unknown[] = [];
  const sendMessage: RuntimeSendMessage = vi.fn((request, callback) => {
    const typedRequest = request as {args?: unknown[]; method?: string};
    requests.push(request);
    if (typedRequest.method === 'getAll') {
      callback(getAllError ? {error: getAllError} : {result: options});
      return;
    }
    if (typedRequest.method === 'getState') {
      const key = typedRequest.args?.[0];
      const state: Record<string, unknown> = {
        firstRun: '',
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
        result: typeof key === 'string' ? {[key]: state[key]} : {}
      });
      return;
    }
    if (typedRequest.method === 'patch') {
      callback({result: patchedOptions});
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
});

describe('options app', () => {
  it('loads options and navigates between shell routes', async () => {
    const {requests} = installBackground();
    window.location.hash = '#/about';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'About'});
    expect(screen.getByRole('link', {name: /proxy/})).toBeTruthy();

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
});
