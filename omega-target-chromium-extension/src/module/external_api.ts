import ChromePort = require('./chrome_port');

type Profile = {
  name?: string;
};

type ExternalOptions = {
  applyProfile: (profileName: string | null) => Promise<unknown>;
  clearBadge: () => void;
  currentProfile: () => Profile | null | undefined;
  getAll: () => unknown;
  log: {
    log: (message: string, payload?: unknown) => void;
  };
  reloadQuickSwitch: () => void;
  setProxyNotControllable: (reason: string | null, badge?: {color: string; text: string}) => void;
};

type ExternalMessage = {
  action?: string;
};

type ExternalPort = {
  onDisconnect: {
    addListener: (callback: () => void) => void;
  };
  onMessage: {
    addListener: (callback: (message: ExternalMessage) => void) => void;
  };
  postMessage: (message: Record<string, unknown>) => void;
  sender: {
    id: string;
  };
};

function actionApi(): ChromeActionApi {
  const legacyKey = 'browser' + 'Action';
  return (chrome.action || chrome[legacyKey]) as ChromeActionApi;
}

class ExternalApi {
  disabled: boolean;
  knownExts: Record<string, number>;
  options: ExternalOptions;
  private _previousProfileName: string | null;

  constructor(options: ExternalOptions) {
    this.options = options;
    this.knownExts = {
      padekgcemlokbadohgkifijomclgjgif: 32
    };
    this.disabled = false;
    this._previousProfileName = null;
  }

  listen() {
    if (!chrome.runtime.onConnectExternal) {
      return;
    }
    return chrome.runtime.onConnectExternal.addListener((rawPort: unknown) => {
      const port = new ChromePort(rawPort as ChromeRuntimePort) as unknown as ExternalPort;
      port.onMessage.addListener((msg) => {
        return this.onMessage(msg, port);
      });
      return port.onDisconnect.addListener(this.reenable.bind(this));
    });
  }

  reenable() {
    if (!this.disabled) {
      return;
    }
    this.options.setProxyNotControllable(null);
    const api = actionApi();
    if (typeof api.setPopup === 'function') {
      api.setPopup({
        popup: 'popup/index.html'
      });
    }
    this.options.reloadQuickSwitch();
    this.disabled = false;
    this.options.clearBadge();
    return this.options.applyProfile(this._previousProfileName);
  }

  checkPerm(port: ExternalPort, level: number) {
    const perm = this.knownExts[port.sender.id] || 0;
    if (perm < level) {
      port.postMessage({
        action: 'error',
        error: 'permission'
      });
      return false;
    }
    return true;
  }

  onMessage(msg: ExternalMessage, port: ExternalPort) {
    this.options.log.log(`${port.sender.id} -> ${msg.action}`, msg);
    switch (msg.action) {
      case 'disable': {
        if (!this.checkPerm(port, 16)) {
          return;
        }
        if (this.disabled) {
          return;
        }
        this.disabled = true;
        this._previousProfileName = this.options.currentProfile()?.name || 'system';
        this.options.applyProfile('system').then(() => {
          let reason = 'disabled';
          if (this.knownExts[port.sender.id] >= 32) {
            reason = 'upgrade';
          }
          return this.options.setProxyNotControllable(reason, {
            text: 'X',
            color: '#5ab432'
          });
        });
        const api = actionApi();
        if (typeof api.setPopup === 'function') {
          api.setPopup({
            popup: 'popup/index.html'
          });
        }
        return port.postMessage({
          action: 'state',
          state: 'disabled'
        });
      }
      case 'enable':
        this.reenable();
        return port.postMessage({
          action: 'state',
          state: 'enabled'
        });
      case 'getOptions':
        if (!this.checkPerm(port, 8)) {
          return;
        }
        return port.postMessage({
          action: 'options',
          options: this.options.getAll()
        });
      default:
        return port.postMessage({
          action: 'error',
          error: 'noSuchAction',
          action_name: msg.action
        });
    }
  }
}

export = ExternalApi;
