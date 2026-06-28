import {connectOptionsHandoff} from '../src/react/options_handoff_client';
import type {ExtensionChromeApi, ExtensionRuntimePort} from '../src/react/browser_env';

type TestGlobal = typeof globalThis & {
  chrome?: ExtensionChromeApi;
};

function testGlobal() {
  return globalThis as TestGlobal;
}

function createRuntimePort() {
  let connected = true;
  const messageListeners: Array<(message: unknown) => void> = [];
  const disconnectListeners: Array<() => void> = [];
  const port: ExtensionRuntimePort = {
    disconnect: vi.fn(() => {
      if (!connected) {
        throw new Error('Attempting to use a disconnected port object');
      }
      connected = false;
      disconnectListeners.forEach((listener) => listener());
    }),
    onDisconnect: {
      addListener: vi.fn((callback) => {
        disconnectListeners.push(callback);
      }),
      removeListener: vi.fn((callback) => {
        const index = disconnectListeners.indexOf(callback);
        if (index >= 0) {
          disconnectListeners.splice(index, 1);
        }
      })
    },
    onMessage: {
      addListener: vi.fn((callback) => {
        messageListeners.push(callback);
      }),
      removeListener: vi.fn((callback) => {
        const index = messageListeners.indexOf(callback);
        if (index >= 0) {
          messageListeners.splice(index, 1);
        }
      })
    },
    postMessage: vi.fn(() => {
      if (!connected) {
        throw new Error('Attempting to use a disconnected port object');
      }
    })
  };

  return {
    disconnectFromRuntime() {
      connected = false;
      disconnectListeners.forEach((listener) => listener());
    },
    emit(message: unknown) {
      messageListeners.forEach((listener) => listener(message));
    },
    port
  };
}

describe('options handoff client', () => {
  it('stops sending messages after the runtime port disconnects', () => {
    const runtimePort = createRuntimePort();
    testGlobal().chrome = {
      runtime: {
        connect: vi.fn(() => runtimePort.port)
      }
    };
    const onMessage = vi.fn();
    const connection = connectOptionsHandoff(onMessage);

    connection?.updateState(true);
    expect(runtimePort.port.postMessage).toHaveBeenCalledWith({
      dirty: true,
      type: 'optionsHandoffState'
    });

    runtimePort.disconnectFromRuntime();

    expect(() => connection?.updateState(false)).not.toThrow();
    expect(() => connection?.claim('handoff-1')).not.toThrow();
    expect(() => connection?.resolved('handoff-1', 'apply', true)).not.toThrow();
    expect(() => connection?.dispose()).not.toThrow();
    expect(runtimePort.port.postMessage).toHaveBeenCalledTimes(1);

    runtimePort.emit({
      handoffId: 'handoff-1',
      type: 'optionsHandoffLock'
    });
    expect(onMessage).not.toHaveBeenCalled();
  });
});
