// @vitest-environment jsdom

import {getLocalState, getState, lastUrl, lastUrlAsync, setLocalState, setState} from '../src/react/state_client';
import type {ExtensionChromeApi, ExtensionRuntimeApi} from '../src/react/browser_env';

type TestGlobal = typeof globalThis & {
  chrome?: ExtensionChromeApi;
};

type RuntimeResponse = unknown | ((message: unknown) => unknown);
type RuntimeSendMessage = NonNullable<ExtensionRuntimeApi['sendMessage']>;

function testGlobal() {
  return globalThis as TestGlobal;
}

function installChromeMock(manifestVersion: number, sendMessage?: RuntimeSendMessage) {
  testGlobal().chrome = {
    runtime: {
      getManifest: () => ({
        manifest_version: manifestVersion,
        version: '0.0.0'
      }),
      sendMessage
    }
  };
}

function installBackgroundResponses(responses: RuntimeResponse[]) {
  const messages: unknown[] = [];
  const sendMessage: RuntimeSendMessage = vi.fn((message, callback) => {
    messages.push(message);
    const response = responses.shift();
    callback(typeof response === 'function' ? response(message) : response);
  });
  installChromeMock(3, sendMessage);
  return {
    messages,
    sendMessage
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('state client', () => {
  it('stores local state using extension-compatible localStorage keys', () => {
    setLocalState('web.sidebar', {
      open: true
    });

    expect(localStorage.getItem('omega.local.web.sidebar')).toBe(JSON.stringify({open: true}));
    expect(getLocalState('web.sidebar')).toEqual({
      open: true
    });
  });

  it('reads state from localStorage for legacy manifest versions', async () => {
    installChromeMock(2);
    setLocalState('currentProfileName', 'proxy');
    setLocalState('isSystemProfile', false);

    await expect(getState('currentProfileName')).resolves.toBe('proxy');
    await expect(getState(['currentProfileName', 'isSystemProfile', 'missing'])).resolves.toEqual(['proxy', false, undefined]);
  });

  it('writes state to localStorage for legacy manifest versions', async () => {
    installChromeMock(2);
    const value = {
      expanded: ['proxy', 'auto']
    };

    await expect(setState('web.expandedProfiles', value)).resolves.toBe(value);

    expect(getLocalState('web.expandedProfiles')).toEqual(value);
  });

  it('reads single state values through the background API for manifest v3', async () => {
    const {messages} = installBackgroundResponses([
      {
        result: {
          currentProfileName: 'proxy'
        }
      }
    ]);

    await expect(getState('currentProfileName')).resolves.toBe('proxy');

    expect(messages).toEqual([
      {
        args: ['currentProfileName'],
        method: 'getState'
      }
    ]);
  });

  it('maps multiple state values through the background API for manifest v3', async () => {
    const {messages} = installBackgroundResponses([
      {
        result: {
          currentProfileName: 'proxy',
          isSystemProfile: false
        }
      }
    ]);

    await expect(getState(['currentProfileName', 'isSystemProfile', 'missing'])).resolves.toEqual(['proxy', false, undefined]);

    expect(messages).toEqual([
      {
        args: [['currentProfileName', 'isSystemProfile', 'missing']],
        method: 'getState'
      }
    ]);
  });

  it('writes state through the background API for manifest v3 and resolves the input value', async () => {
    const value = {
      containers: {
        firefox: 'proxy'
      }
    };
    const {messages} = installBackgroundResponses([
      {
        result: {
          ignored: true
        }
      }
    ]);

    await expect(setState('profileScopeAssignments', value)).resolves.toBe(value);

    expect(messages).toEqual([
      {
        args: [
          {
            profileScopeAssignments: value
          }
        ],
        method: 'setState'
      }
    ]);
  });

  it('keeps lastUrl compatible with local state storage', async () => {
    installChromeMock(2);

    expect(lastUrl('https://example.com/options')).toBe('https://example.com/options');
    await expect(getState('web.last_url')).resolves.toBe('https://example.com/options');
    expect(lastUrl()).toBe('https://example.com/options');
  });

  it('keeps lastUrl synchronously readable after manifest v3 writes', () => {
    const {messages} = installBackgroundResponses([
      {
        result: {}
      }
    ]);

    expect(lastUrl('/profile/proxy')).toBe('/profile/proxy');
    expect(lastUrl()).toBe('/profile/proxy');
    expect(messages).toEqual([
      {
        args: [
          {
            'web.last_url': '/profile/proxy'
          }
        ],
        method: 'setState'
      }
    ]);
  });

  it('restores lastUrl from background state when local cache is empty', async () => {
    installBackgroundResponses([
      {
        result: {
          'web.last_url': '/profile/proxy'
        }
      }
    ]);

    await expect(lastUrlAsync()).resolves.toBe('/profile/proxy');
    expect(lastUrl()).toBe('/profile/proxy');
  });
});
