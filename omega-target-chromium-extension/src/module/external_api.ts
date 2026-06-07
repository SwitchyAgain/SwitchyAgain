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

type ExternalAction = 'disable' | 'enable' | 'getOptions';

type ExternalMessage = {
  action?: ExternalAction | string;
};

type ExternalResponse =
  | {
    action: 'error';
    action_name?: string;
    error: 'noSuchAction' | 'permission';
  }
  | {
    action: 'options';
    options: unknown;
  }
  | {
    action: 'state';
    state: 'disabled' | 'enabled';
  };

type ExternalPort = ChromePort & {
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
    return chrome.runtime.onConnectExternal.addListener((rawPort: ChromeRuntimePort) => {
      const port = new ChromePort(rawPort) as ExternalPort;
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
      this.post(port, {
        action: 'error',
        error: 'permission'
      });
      return false;
    }
    return true;
  }

  onMessage(message: unknown, port: ExternalPort) {
    const msg = this.parseMessage(message);
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
        return this.post(port, {
          action: 'state',
          state: 'disabled'
        });
      }
      case 'enable':
        this.reenable();
        return this.post(port, {
          action: 'state',
          state: 'enabled'
        });
      case 'getOptions':
        if (!this.checkPerm(port, 8)) {
          return;
        }
        return this.post(port, {
          action: 'options',
          options: this.options.getAll()
        });
      default:
        return this.post(port, {
          action: 'error',
          error: 'noSuchAction',
          action_name: msg.action
        });
    }
  }

  private parseMessage(message: unknown): ExternalMessage {
    if (!message || typeof message !== 'object') {
      return {};
    }
    return message as ExternalMessage;
  }

  private post(port: ExternalPort, message: ExternalResponse) {
    return port.postMessage(message);
  }
}

export = ExternalApi;
