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

function installChromeMock(sendMessage?: RuntimeSendMessage) {
  testGlobal().chrome = {
    runtime: {
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
  installChromeMock(sendMessage);
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

    expect(localStorage.getItem('state.web.sidebar')).toBe(JSON.stringify({open: true}));
    expect(getLocalState('web.sidebar')).toEqual({
      open: true
    });
  });

  it('reads single state values through the background API', async () => {
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

  it('maps multiple state values through the background API', async () => {
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

  it('writes state through the background API and resolves the input value', async () => {
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

  it('keeps lastUrl synchronously readable after background writes', () => {
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
