type ActionIcon = Record<string | number, ImageData>;

type TabAction = {
  icon?: ActionIcon;
  shortTitle?: string;
  title: string;
};

type TabBadge = {
  color: string;
  text: string;
};

type TabChangeInfo = {
  status?: string;
  url?: string;
};

export function tabUrl(tab?: Pick<ChromeTab, 'pendingUrl' | 'url'> | null) {
  return tab?.pendingUrl || tab?.url;
}

function actionApi(): ChromeActionApi {
  const legacyKey = 'browser' + 'Action';
  return (chrome.action || chrome[legacyKey]) as ChromeActionApi;
}

class ChromeTabs {
  actionForUrl: (url: string) => Promise<TabAction | null | undefined>;
  private _badgeTab: Record<number, boolean> | null;
  private _defaultAction: TabAction | null;
  private _dirtyTabs: Record<number, number>;

  constructor(actionForUrl: (url: string) => Promise<TabAction | null | undefined>) {
    this.actionForUrl = actionForUrl;
    this._dirtyTabs = {};
    this._defaultAction = null;
    this._badgeTab = null;
  }

  ignoreError() {
    chrome.runtime.lastError;
  }

  watch() {
    chrome.tabs.onUpdated.addListener(this.onUpdated.bind(this));
    chrome.tabs.onActivated.addListener((info: {tabId: number}) => {
      chrome.tabs.get(info.tabId, (tab: ChromeTab) => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (tab.id != null && Object.prototype.hasOwnProperty.call(this._dirtyTabs, info.tabId)) {
          return this.onUpdated(tab.id, {}, tab);
        }
      });
    });
  }

  resetAll(action: TabAction) {
    this._defaultAction = action;
    chrome.tabs.query({}, (tabs: ChromeTab[]) => {
      this._dirtyTabs = {};
      tabs.forEach((tab) => {
        if (tab.id == null) {
          return;
        }
        this._dirtyTabs[tab.id] = tab.id;
        if (tab.active) {
          return this.onUpdated(tab.id, {}, tab);
        }
      });
    });
    if (actionApi().setPopup != null) {
      actionApi().setTitle({
        title: action.title
      });
    } else {
      actionApi().setTitle({
        title: action.shortTitle
      });
    }
    return this.setIcon(action.icon);
  }

  onUpdated(_tabId: number | undefined, changeInfo: TabChangeInfo, tab: ChromeTab) {
    if (tab.id != null && Object.prototype.hasOwnProperty.call(this._dirtyTabs, tab.id)) {
      delete this._dirtyTabs[tab.id];
    } else if (changeInfo.url == null && changeInfo.status != null && changeInfo.status !== 'loading') {
      return;
    }
    return this.processTab(tab);
  }

  processTab(tab: ChromeTab) {
    if (this._badgeTab) {
      for (const id of Object.keys(this._badgeTab)) {
        try {
          const api = actionApi();
          if (typeof api.setBadgeText === 'function') {
            api.setBadgeText({
              text: '',
              tabId: Number(id)
            });
          }
        } catch (error) {
        }
        this._badgeTab = null;
      }
    }
    const url = tabUrl(tab);
    if (url == null || url.indexOf('chrome') === 0) {
      if (this._defaultAction) {
        actionApi().setTitle({
          title: this._defaultAction.title,
          tabId: tab.id
        });
        this.clearIcon(tab.id);
      }
      return;
    }
    return this.actionForUrl(url).then((action) => {
      if (!action) {
        this.clearIcon(tab.id);
        return;
      }
      this.setIcon(action.icon, tab.id);
      if (actionApi().setPopup != null) {
        return actionApi().setTitle({
          title: action.title,
          tabId: tab.id
        });
      }
      return actionApi().setTitle({
        title: action.shortTitle,
        tabId: tab.id
      });
    });
  }

  setTabBadge(tab: ChromeTab, badge: TabBadge) {
    if (tab.id == null) {
      return;
    }
    if (this._badgeTab == null) {
      this._badgeTab = {};
    }
    this._badgeTab[tab.id] = true;
    const api = actionApi();
    if (typeof api.setBadgeText === 'function') {
      api.setBadgeText({
        text: badge.text,
        tabId: tab.id
      });
    }
    const apiForColor = actionApi();
    if (typeof apiForColor.setBadgeBackgroundColor === 'function') {
      return apiForColor.setBadgeBackgroundColor({
        color: badge.color,
        tabId: tab.id
      });
    }
  }

  setIcon(icon?: ActionIcon, tabId?: number) {
    if (icon == null) {
      return;
    }
    const params = tabId != null ? {
      imageData: icon,
      tabId
    } : {
      imageData: icon
    };
    return this._chromeSetIcon(params);
  }

  private _chromeSetIcon(params: {imageData: ActionIcon; tabId?: number}) {
    try {
      const api = actionApi();
      if (typeof api.setIcon === 'function') {
        return api.setIcon(params, this.ignoreError);
      }
    } catch (error) {
      params.imageData = {
        19: params.imageData[19],
        38: params.imageData[38]
      };
      const api = actionApi();
      if (typeof api.setIcon === 'function') {
        return api.setIcon(params, this.ignoreError);
      }
    }
  }

  clearIcon(tabId?: number) {
    if (this._defaultAction?.icon == null) {
      return;
    }
    return this._chromeSetIcon({
      imageData: this._defaultAction.icon,
      tabId
    });
  }
}

export default ChromeTabs;
