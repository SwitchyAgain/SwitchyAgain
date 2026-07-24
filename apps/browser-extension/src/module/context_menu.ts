type ContextMenuOptions = Record<string, unknown> & {
  checked?: boolean;
  contexts?: string[];
  id?: string;
  title?: string;
  type?: string;
};

type ContextMenuClickHandler = (info: ChromeContextMenuClickInfo, tab: ChromeTab) => unknown;
type ContextMenuRefreshTask = () => Promise<void> | void;

const clickHandlers: Record<string, ContextMenuClickHandler> = {};
let quickSwitchHandler: (info: {checked: boolean}) => unknown = () => null;
let backgroundContextMenuInitialization: Promise<void> | null = null;

export class ContextMenuRefreshQueue {
  private onError: (error: unknown) => void;
  private pendingTask: ContextMenuRefreshTask | null = null;
  private running: Promise<void> | null = null;

  constructor(onError: (error: unknown) => void = () => undefined) {
    this.onError = onError;
  }

  request(task: ContextMenuRefreshTask) {
    this.pendingTask = task;
    if (this.running == null) {
      this.running = this.drain();
    }
    return this.running;
  }

  private async drain() {
    while (this.pendingTask != null) {
      const task = this.pendingTask;
      this.pendingTask = null;
      try {
        await task();
      } catch (error) {
        this.onError(error);
      }
    }
    this.running = null;
  }
}

export function setContextMenuQuickSwitchHandler(handler: (info: {checked: boolean}) => unknown) {
  quickSwitchHandler = handler;
}

function addContextMenu(options: ContextMenuOptions, onclick?: ContextMenuClickHandler) {
  const contextMenus = chrome.contextMenus;
  if (contextMenus == null) {
    return Promise.resolve();
  }
  if (onclick) {
    if (!options.id) {
      options.id = 'context-menu-' + Object.keys(clickHandlers).length;
    }
    clickHandlers[options.id] = onclick;
  }
  return new Promise<void>((resolve) => {
    try {
      contextMenus.create(options, () => {
        chrome.runtime.lastError;
        resolve();
      });
    } catch (_error) {
      resolve();
    }
  });
}

export function initializeBackgroundContextMenu() {
  if (backgroundContextMenuInitialization != null) {
    return backgroundContextMenuInitialization;
  }
  if (chrome.contextMenus?.onClicked != null) {
    chrome.contextMenus.onClicked.addListener((info: ChromeContextMenuClickInfo, tab: ChromeTab) => {
      const handler = clickHandlers[info.menuItemId];
      return typeof handler === 'function' ? handler(info, tab) : undefined;
    });
  }

  if (chrome.contextMenus == null) {
    backgroundContextMenuInitialization = Promise.resolve();
    return backgroundContextMenuInitialization;
  }
  const createContextMenus = () => {
    if (chrome.i18n.getUILanguage == null) {
      return Promise.resolve();
    }
    return addContextMenu(
      {
        id: 'enableQuickSwitch',
        title: chrome.i18n.getMessage('contextMenu_enableQuickSwitch'),
        type: 'checkbox',
        checked: false,
        contexts: ['action']
      },
      (info: ChromeContextMenuClickInfo) => quickSwitchHandler({checked: info.checked === true})
    );
  };
  backgroundContextMenuInitialization = new Promise<void>((resolve) => {
    const createAfterRemoval = () => {
      chrome.runtime.lastError;
      createContextMenus().then(resolve);
    };
    if (chrome.contextMenus?.removeAll != null) {
      try {
        chrome.contextMenus.removeAll(createAfterRemoval);
      } catch (_error) {
        createAfterRemoval();
      }
      return;
    }
    createAfterRemoval();
  });
  return backgroundContextMenuInitialization;
}
