type ContextMenuOptions = Record<string, unknown> & {
  checked?: boolean;
  contexts?: string[];
  id?: string;
  title?: string;
  type?: string;
};

type ContextMenuClickHandler = (info: unknown, tab: ChromeTab) => unknown;

(function() {
  var actionContext: string;
  var addContextMenu: (options: ContextMenuOptions, onclick?: ContextMenuClickHandler) => unknown;
  var createContextMenus: (() => unknown) | undefined;
  var ref;

  window.UglifyJS_NoUnsafeEval = true;

  localStorage['log'] = '';

  localStorage['logLastError'] = '';

  window.OmegaContextMenuQuickSwitchHandler = function() {
    return null;
  };

  if (window.OmegaContextMenuClickHandlers == null) {
    window.OmegaContextMenuClickHandlers = {};
  }

  actionContext = chrome.action != null ? "action" : "browser_action";

  addContextMenu = function(options: ContextMenuOptions, onclick?: ContextMenuClickHandler) {
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

  if (((ref = chrome.contextMenus) != null ? ref.onClicked : void 0) != null) {
    chrome.contextMenus.onClicked.addListener(function(info: {menuItemId: string}, tab: ChromeTab) {
      var base, name;
      return typeof (base = window.OmegaContextMenuClickHandlers)[name = info.menuItemId] === "function" ? base[name](info, tab) : void 0;
    });
  }

  if (chrome.contextMenus != null) {
    createContextMenus = function() {
      if (chrome.i18n.getUILanguage != null) {
        return addContextMenu({
          id: 'enableQuickSwitch',
          title: chrome.i18n.getMessage('contextMenu_enableQuickSwitch'),
          type: 'checkbox',
          checked: false,
          contexts: [actionContext]
        }, function(info: {checked: boolean}) {
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
