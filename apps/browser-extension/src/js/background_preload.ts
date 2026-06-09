type ContextMenuOptions = Record<string, unknown> & {
  checked?: boolean;
  contexts?: string[];
  id?: string;
  title?: string;
  type?: string;
};

type ContextMenuClickHandler = (info: unknown, tab: ChromeTab) => unknown;

(function() {
  window.UglifyJS_NoUnsafeEval = true;

  localStorage['log'] = '';

  localStorage['logLastError'] = '';

  window.OmegaContextMenuQuickSwitchHandler = () => {
    return null;
  };

  if (window.OmegaContextMenuClickHandlers == null) {
    window.OmegaContextMenuClickHandlers = {};
  }

  const actionContext = chrome.action != null ? "action" : "browser_action";

  const addContextMenu = (options: ContextMenuOptions, onclick?: ContextMenuClickHandler) => {
    if (onclick) {
      if (options.id) {
        window.OmegaContextMenuClickHandlers[options.id] = onclick;
      } else {
        options.id = 'omega-context-' + Object.keys(window.OmegaContextMenuClickHandlers).length;
        window.OmegaContextMenuClickHandlers[options.id!] = onclick;
      }
    }
    return chrome.contextMenus.create(options);
  };

  if (chrome.contextMenus?.onClicked != null) {
    chrome.contextMenus.onClicked.addListener((info: {menuItemId: string}, tab: ChromeTab) => {
      const handler = window.OmegaContextMenuClickHandlers[info.menuItemId];
      return typeof handler === "function" ? handler(info, tab) : void 0;
    });
  }

  if (chrome.contextMenus != null) {
    const createContextMenus = () => {
      if (chrome.i18n.getUILanguage != null) {
        return addContextMenu({
          id: 'enableQuickSwitch',
          title: chrome.i18n.getMessage('contextMenu_enableQuickSwitch'),
          type: 'checkbox',
          checked: false,
          contexts: [actionContext]
        }, (info: {checked: boolean}) => {
          return window.OmegaContextMenuQuickSwitchHandler(info);
        });
      }
    };
    if (chrome.contextMenus.removeAll != null) {
      chrome.contextMenus.removeAll(createContextMenus);
    } else {
      createContextMenus();
    }
  }

}).call(this);
