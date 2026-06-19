import {
  callBackground,
  callBackgroundNoReply,
  callBackgroundWithRefresh,
  decodeBackgroundError,
  runtimeAvailable
} from '../src/react/background_client';
import type {ExtensionChromeApi, ExtensionRuntimeApi} from '../src/react/browser_env';

type TestGlobal = typeof globalThis & {
  chrome?: ExtensionChromeApi;
};

type RuntimeSendMessage = NonNullable<ExtensionRuntimeApi['sendMessage']>;

function testGlobal() {
  return globalThis as TestGlobal;
}

function installRuntime(sendMessage?: RuntimeSendMessage) {
  const runtime: ExtensionRuntimeApi = {
    sendMessage
  };
  testGlobal().chrome = {
    runtime
  };
  return runtime;
}

describe('background client', () => {
  it('reports runtime message availability', () => {
    installRuntime(vi.fn());
    expect(runtimeAvailable()).toBe(true);

    installRuntime();
    expect(runtimeAvailable()).toBe(false);
  });

  it('calls background methods and resolves result payloads', async () => {
    const sendMessage: RuntimeSendMessage = vi.fn((message, callback) => {
      callback({
        result: {
          activeProfileName: 'proxy'
        }
      });
    });
    installRuntime(sendMessage);

    await expect(callBackground('getState', 'web.currentProfile')).resolves.toEqual({
      activeProfileName: 'proxy'
    });
    expect(sendMessage).toHaveBeenCalledWith(
      {
        args: ['web.currentProfile'],
        method: 'getState'
      },
      expect.any(Function)
    );
  });

  it('marks calls that should refresh the active page', async () => {
    const sendMessage: RuntimeSendMessage = vi.fn((_message, callback) => {
      callback({
        result: true
      });
    });
    installRuntime(sendMessage);

    await expect(callBackgroundWithRefresh('applyProfile', 'proxy')).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledWith(
      {
        args: ['proxy'],
        method: 'applyProfile',
        refreshActivePage: true
      },
      expect.any(Function)
    );
  });

  it('rejects when runtime messaging is unavailable', async () => {
    installRuntime();

    await expect(callBackground('getAll')).rejects.toThrow('Extension runtime is unavailable.');
  });

  it('rejects runtime lastError messages before reading the response', async () => {
    let runtime: ExtensionRuntimeApi;
    const sendMessage: RuntimeSendMessage = vi.fn((_message, callback) => {
      runtime.lastError = {
        message: 'Receiving end does not exist.'
      };
      callback({
        result: {
          ignored: true
        }
      });
    });
    runtime = installRuntime(sendMessage);

    await expect(callBackground('getAll')).rejects.toThrow('Receiving end does not exist.');
  });

  it('rejects decoded background errors from response payloads', async () => {
    const sendMessage: RuntimeSendMessage = vi.fn((_message, callback) => {
      callback({
        error: {
          _error: 'error',
          message: 'Download failed',
          name: 'NetworkError',
          original: {
            statusCode: 502
          },
          reason: 'bad_gateway',
          stack: 'remote stack',
          statusCode: 502
        }
      });
    });
    installRuntime(sendMessage);

    await expect(callBackground('getAll')).rejects.toMatchObject({
      message: 'Download failed',
      name: 'NetworkError',
      original: {
        statusCode: 502
      },
      reason: 'bad_gateway',
      stack: 'remote stack',
      statusCode: 502
    });
  });

  it('sends no-reply messages and drains runtime lastError', () => {
    let runtime: ExtensionRuntimeApi;
    const sendMessage: RuntimeSendMessage = vi.fn((_message, callback) => {
      runtime.lastError = {
        message: 'No receiver.'
      };
      callback();
    });
    runtime = installRuntime(sendMessage);

    expect(() => callBackgroundNoReply('refreshProfileScopeContainerNames')).not.toThrow();
    expect(sendMessage).toHaveBeenCalledWith(
      {
        args: [],
        method: 'refreshProfileScopeContainerNames',
        noReply: true
      },
      expect.any(Function)
    );
  });

  it('decodes serialized background errors and leaves other values unchanged', () => {
    const decoded = decodeBackgroundError({
      _error: 'error',
      message: '',
      name: 'RemoteError'
    });
    const raw = {
      message: 'plain object'
    };

    expect(decoded).toBeInstanceOf(Error);
    expect((decoded as Error).message).toBe('RemoteError');
    expect((decoded as Error).name).toBe('RemoteError');
    expect(decodeBackgroundError(raw)).toBe(raw);
  });
});
