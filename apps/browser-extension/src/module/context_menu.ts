type ContextMenuOptions = Record<string, unknown> & {
  checked?: boolean;
  contexts?: string[];
  id?: string;
  title?: string;
  type?: string;
};

type ContextMenuClickHandler = (info: ChromeContextMenuClickInfo, tab: ChromeTab) => unknown;

const clickHandlers: Record<string, ContextMenuClickHandler> = {};
let quickSwitchHandler: (info: {checked: boolean}) => unknown = () => null;

export function setContextMenuQuickSwitchHandler(handler: (info: {checked: boolean}) => unknown) {
  quickSwitchHandler = handler;
}

function addContextMenu(options: ContextMenuOptions, onclick?: ContextMenuClickHandler) {
  const contextMenus = chrome.contextMenus;
  if (contextMenus == null) {
    return;
  }
  if (onclick) {
    if (!options.id) {
      options.id = 'context-menu-' + Object.keys(clickHandlers).length;
    }
    clickHandlers[options.id] = onclick;
  }
  return contextMenus.create(options);
}

export function initializeBackgroundContextMenu() {
  if (chrome.contextMenus?.onClicked != null) {
    chrome.contextMenus.onClicked.addListener((info: ChromeContextMenuClickInfo, tab: ChromeTab) => {
      const handler = clickHandlers[info.menuItemId];
      return typeof handler === 'function' ? handler(info, tab) : undefined;
    });
  }

  if (chrome.contextMenus == null) {
    return;
  }
  const createContextMenus = () => {
    if (chrome.i18n.getUILanguage == null) {
      return;
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
  if (chrome.contextMenus.removeAll != null) {
    chrome.contextMenus.removeAll(createContextMenus);
  } else {
    createContextMenus();
  }
}
