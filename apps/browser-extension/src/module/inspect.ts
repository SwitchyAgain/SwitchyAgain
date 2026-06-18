type InspectMenuId = 'inspectElement' | 'inspectFrame' | 'inspectLink' | 'inspectPage';

type InspectInfo = {
  frameUrl?: string;
  linkUrl?: string;
  menuItemId?: InspectMenuId | string;
  pageUrl?: string;
  srcUrl?: string;
  [key: string]: unknown;
};

type InspectTab = Pick<ChromeTab, 'id' | 'url'> & Record<string, unknown>;

const WEB_RESOURCE_PATTERNS = ['http://*/*', 'https://*/*'];

class Inspect {
  onInspect: (url: string, tab: InspectTab) => unknown;
  propForMenuItem: Record<InspectMenuId, keyof InspectInfo>;
  private _enabled: boolean;

  constructor(onInspect: (url: string, tab: InspectTab) => unknown) {
    this.onInspect = onInspect;
    this._enabled = false;
    this._onContextMenuClicked = this._onContextMenuClicked.bind(this);
    this.propForMenuItem = {
      inspectPage: 'pageUrl',
      inspectFrame: 'frameUrl',
      inspectLink: 'linkUrl',
      inspectElement: 'srcUrl'
    };
  }

  enable() {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null || chrome.i18n.getUILanguage == null || this._enabled) {
      return;
    }
    contextMenus.onClicked.addListener(this._onContextMenuClicked);
    contextMenus.create({
      id: 'inspectFrame',
      title: chrome.i18n.getMessage('contextMenu_inspectFrame'),
      contexts: ['frame'],
      documentUrlPatterns: WEB_RESOURCE_PATTERNS
    });
    contextMenus.create({
      id: 'inspectLink',
      title: chrome.i18n.getMessage('contextMenu_inspectLink'),
      contexts: ['link'],
      targetUrlPatterns: WEB_RESOURCE_PATTERNS
    });
    contextMenus.create({
      id: 'inspectElement',
      title: chrome.i18n.getMessage('contextMenu_inspectElement'),
      contexts: ['image', 'video', 'audio'],
      targetUrlPatterns: WEB_RESOURCE_PATTERNS
    });
    this._enabled = true;
  }

  disable() {
    const contextMenus = chrome.contextMenus;
    if (!this._enabled || contextMenus == null) {
      return;
    }
    for (const menuId of Object.keys(this.propForMenuItem)) {
      if (menuId === 'inspectPage') {
        continue;
      }
      try {
        contextMenus.remove(menuId, () => {
          chrome.runtime.lastError;
        });
      } catch (error) {
      }
    }
    contextMenus.onClicked.removeListener(this._onContextMenuClicked);
    this._enabled = false;
  }

  private _onContextMenuClicked(info: InspectInfo, tab: InspectTab) {
    if (!this.isInspectMenuId(info.menuItemId)) {
      return;
    }
    return this.inspect(info, tab);
  }

  inspect(info: InspectInfo, tab: InspectTab) {
    if (!this.isInspectMenuId(info.menuItemId)) {
      return;
    }
    const prop = this.propForMenuItem[info.menuItemId];
    let url = prop ? info[prop] : undefined;
    if (!url && info.menuItemId === 'inspectPage') {
      url = tab.url;
    }
    if (typeof url !== 'string' || !url) {
      return;
    }
    return this.onInspect(url, tab);
  }

  private isInspectMenuId(menuItemId: string | undefined): menuItemId is InspectMenuId {
    return Boolean(menuItemId && Object.prototype.hasOwnProperty.call(this.propForMenuItem, menuItemId));
  }
}

export default Inspect;
