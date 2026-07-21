type ContextMenuOptions = Record<string, unknown> & {
  checked?: boolean;
  contexts?: string[];
  id?: string;
  title?: string;
  type?: string;
};

type ContextMenuClickHandler = (info: ChromeContextMenuClickInfo, tab: ChromeTab) => unknown;

(function () {
  localStorage['log'] = '';

  localStorage['logLastError'] = '';

  window.ContextMenuQuickSwitchHandler = () => {
    return null;
  };

  if (window.ContextMenuClickHandlers == null) {
    window.ContextMenuClickHandlers = {};
  }

  const addContextMenu = (options: ContextMenuOptions, onclick?: ContextMenuClickHandler) => {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null) {
      return;
    }
    if (onclick) {
      if (options.id) {
        window.ContextMenuClickHandlers[options.id] = onclick;
      } else {
        options.id = 'context-menu-' + Object.keys(window.ContextMenuClickHandlers).length;
        window.ContextMenuClickHandlers[options.id!] = onclick;
      }
    }
    return contextMenus.create(options);
  };

  if (chrome.contextMenus?.onClicked != null) {
    chrome.contextMenus.onClicked.addListener((info: ChromeContextMenuClickInfo, tab: ChromeTab) => {
      const handler = window.ContextMenuClickHandlers[info.menuItemId];
      return typeof handler === 'function' ? handler(info, tab) : void 0;
    });
  }

  if (chrome.contextMenus != null) {
    const createContextMenus = () => {
      if (chrome.i18n.getUILanguage != null) {
        return addContextMenu(
          {
            id: 'enableQuickSwitch',
            title: chrome.i18n.getMessage('contextMenu_enableQuickSwitch'),
            type: 'checkbox',
            checked: false,
            contexts: ['action']
          },
          (info: ChromeContextMenuClickInfo) => {
            return window.ContextMenuQuickSwitchHandler({checked: info.checked === true});
          }
        );
      }
    };
    if (chrome.contextMenus.removeAll != null) {
      chrome.contextMenus.removeAll(createContextMenus);
    } else {
      createContextMenus();
    }
  }
}).call(this);
