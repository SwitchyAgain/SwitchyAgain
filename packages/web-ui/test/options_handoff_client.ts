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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconnects after the runtime port disconnects and restores the latest state', async () => {
    vi.useFakeTimers();
    const firstPort = createRuntimePort();
    const secondPort = createRuntimePort();
    const connect = vi.fn().mockReturnValueOnce(firstPort.port).mockReturnValue(secondPort.port);
    testGlobal().chrome = {
      runtime: {
        connect
      }
    };
    const onMessage = vi.fn();
    const connection = connectOptionsHandoff(onMessage);

    connection?.updateState(true);
    expect(firstPort.port.postMessage).toHaveBeenCalledWith({
      dirty: true,
      type: 'optionsHandoffState'
    });

    firstPort.disconnectFromRuntime();
    connection?.updateState(false);
    await vi.advanceTimersByTimeAsync(100);

    expect(connect).toHaveBeenCalledTimes(2);
    expect(secondPort.port.postMessage).toHaveBeenCalledWith({
      dirty: false,
      type: 'optionsHandoffState'
    });

    secondPort.emit({
      handoffId: 'handoff-1',
      type: 'optionsHandoffLock'
    });
    expect(onMessage).toHaveBeenCalledWith({
      handoffId: 'handoff-1',
      type: 'optionsHandoffLock'
    });

    connection?.dispose();
    await vi.advanceTimersByTimeAsync(100);
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
