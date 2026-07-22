import {callBackground} from './background_client';
import {connectRuntimePort, runtimeLastErrorMessage} from './browser_env';

export type OptionsHandoffAction = 'apply' | 'discard';

export type OptionsHandoffPortMessage =
  | {
      handoffId: string;
      type: 'optionsHandoffLock';
    }
  | {
      handoffId?: string;
      type: 'optionsHandoffUnlock';
    }
  | {
      action: OptionsHandoffAction;
      handoffId: string;
      type: 'optionsHandoffResolve';
    }
  | {
      handoffId: string;
      type: 'optionsHandoffClaim';
    };

type OptionsHandoffStateMessage = {
  dirty: boolean;
  type: 'optionsHandoffState';
};

type OptionsHandoffResolvedMessage = {
  action: OptionsHandoffAction;
  error?: string;
  handoffId: string;
  ok: boolean;
  type: 'optionsHandoffResolved';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOptionsHandoffPortMessage(message: unknown): message is OptionsHandoffPortMessage {
  if (!isRecord(message) || typeof message.type !== 'string') {
    return false;
  }
  switch (message.type) {
    case 'optionsHandoffLock':
    case 'optionsHandoffClaim':
      return typeof message.handoffId === 'string';
    case 'optionsHandoffResolve':
      return typeof message.handoffId === 'string' && (message.action === 'apply' || message.action === 'discard');
    case 'optionsHandoffUnlock':
      return typeof message.handoffId === 'undefined' || typeof message.handoffId === 'string';
    default:
      return false;
  }
}

export function optionsHandoffIdFromLocation() {
  try {
    return new URL(globalThis.location.href).searchParams.get('handoff') || '';
  } catch (_err) {
    return '';
  }
}

export function clearOptionsHandoffFromLocation() {
  try {
    const url = new URL(globalThis.location.href);
    if (!url.searchParams.has('handoff')) {
      return;
    }
    url.searchParams.delete('handoff');
    globalThis.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch (_err) {}
}

export function connectOptionsHandoff(onMessage: (message: OptionsHandoffPortMessage) => void) {
  let connected = false;
  let dirty = false;
  let disposed = false;
  let hasState = false;
  let port: ReturnType<typeof connectRuntimePort> = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const handleMessage = (message: unknown) => {
    if (!connected || disposed) {
      return;
    }
    if (isOptionsHandoffPortMessage(message)) {
      onMessage(message);
    }
  };
  const handleDisconnect = () => {
    runtimeLastErrorMessage();
    connected = false;
    port = null;
    if (!disposed && reconnectTimer == null) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 100);
    }
  };
  const postMessage = (message: unknown) => {
    if (!connected || disposed) {
      return;
    }
    try {
      port?.postMessage?.(message);
    } catch (_err) {
      handleDisconnect();
    }
  };
  const connect = () => {
    if (disposed) {
      return;
    }
    port = connectRuntimePort('optionsHandoff');
    if (!port) {
      handleDisconnect();
      return;
    }
    connected = true;
    port.onMessage?.addListener?.(handleMessage);
    port.onDisconnect?.addListener?.(handleDisconnect);
    if (hasState) {
      postMessage({
        dirty,
        type: 'optionsHandoffState'
      });
    }
  };
  connect();
  return {
    dispose() {
      disposed = true;
      connected = false;
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      port?.onMessage?.removeListener?.(handleMessage);
      port?.onDisconnect?.removeListener?.(handleDisconnect);
      try {
        port?.disconnect?.();
      } catch (_err) {}
    },
    claim(handoffId: string) {
      postMessage({
        handoffId,
        type: 'optionsHandoffClaim'
      });
    },
    resolved(handoffId: string, action: OptionsHandoffAction, ok: boolean, error?: string) {
      const message: OptionsHandoffResolvedMessage = {
        action,
        error,
        handoffId,
        ok,
        type: 'optionsHandoffResolved'
      };
      postMessage(message);
    },
    updateState(nextDirty: boolean) {
      dirty = nextDirty;
      hasState = true;
      const message: OptionsHandoffStateMessage = {
        dirty,
        type: 'optionsHandoffState'
      };
      postMessage(message);
    }
  };
}

export function resolveOptionsHandoff(handoffId: string, action: OptionsHandoffAction) {
  return callBackground('resolveOptionsHandoff', handoffId, action);
}

export function cancelOptionsHandoff(handoffId: string) {
  return callBackground('cancelOptionsHandoff', handoffId);
}
