const Heap = require('heap');

type RequestStatus = 'start' | 'ongoing' | 'timeout' | 'error' | 'timeoutAbort' | 'done';
type EventCategory = 'done' | 'error' | 'ongoing';

type RequestInfo = {
  _startTime?: number;
  error?: string;
  noTimeout?: boolean;
  redirectUrl?: string;
  requestId: string;
  tabId: number;
  timeoutCalled?: boolean;
  type?: string;
  url: string;
  [key: string]: unknown;
};

type Tab = {
  id?: number;
  [key: string]: unknown;
};

type SummaryItem = {
  errorCount: number;
};

type TabInfo = {
  doneCount: number;
  errorCount: number;
  ongoingCount: number;
  requestCount: number;
  requests: Record<string, RequestInfo>;
  requestStatus: Record<string, RequestStatus>;
  summary: Record<string, SummaryItem>;
  [key: string]: unknown;
};

type RequestCallback = (status: RequestStatus, req: RequestInfo) => unknown;
type TabCallback = (
  tabId: number,
  info: TabInfo,
  req: RequestInfo | null,
  status: RequestStatus | 'updated'
) => unknown;

class WebRequestMonitor {
  eventCategory: Record<RequestStatus, EventCategory>;
  getSummaryId?: (req: RequestInfo) => string | number | null | undefined;
  tabInfo: Record<string, TabInfo>;
  tabsWatching: boolean;
  timer: ReturnType<typeof setInterval> | null;
  watching: boolean;
  private _callbacks: RequestCallback[];
  private _recentRequests: any;
  private _requests: Record<string, RequestInfo>;
  private _tabCallbacks: TabCallback[];

  constructor(getSummaryId?: (req: RequestInfo) => string | number | null | undefined) {
    this.getSummaryId = getSummaryId;
    this._requests = {};
    this._recentRequests = new Heap((a: RequestInfo, b: RequestInfo) => {
      return (a._startTime || 0) - (b._startTime || 0);
    });
    this._callbacks = [];
    this._tabCallbacks = [];
    this.tabInfo = {};
    this.watching = false;
    this.timer = null;
    this.tabsWatching = false;
    this.eventCategory = {
      start: 'ongoing',
      ongoing: 'ongoing',
      timeout: 'error',
      error: 'error',
      timeoutAbort: 'error',
      done: 'done'
    };
  }

  watch(callback: RequestCallback) {
    this._callbacks.push(callback);
    if (this.watching) {
      return;
    }
    if (!chrome.webRequest) {
      console.log('Request monitor disabled! No webRequest permission.');
      return;
    }
    chrome.webRequest.onBeforeRequest.addListener(this._requestStart.bind(this), {
      urls: ['<all_urls>']
    });
    chrome.webRequest.onHeadersReceived.addListener(this._requestHeadersReceived.bind(this), {
      urls: ['<all_urls>']
    });
    chrome.webRequest.onBeforeRedirect.addListener(this._requestRedirected.bind(this), {
      urls: ['<all_urls>']
    });
    chrome.webRequest.onCompleted.addListener(this._requestDone.bind(this), {
      urls: ['<all_urls>']
    });
    chrome.webRequest.onErrorOccurred.addListener(this._requestError.bind(this), {
      urls: ['<all_urls>']
    });
    this.watching = true;
  }

  private _requestStart(req: RequestInfo) {
    if (req.tabId < 0) {
      return;
    }
    req._startTime = Date.now();
    this._requests[req.requestId] = req;
    this._recentRequests.push(req);
    if (this.timer == null) {
      this.timer = setInterval(this._tick.bind(this), 1000);
    }
    return this._callbacks.map((callback) => callback('start', req));
  }

  private _tick() {
    const now = Date.now();
    const results = [];
    let req: RequestInfo | undefined;
    while ((req = this._recentRequests.peek())) {
      const reqInfo = this._requests[req.requestId];
      if (reqInfo && !reqInfo.noTimeout) {
        if (now - (req._startTime || 0) < 5000) {
          break;
        }
        reqInfo.timeoutCalled = true;
        for (const callback of this._callbacks) {
          callback('timeout', reqInfo);
        }
      }
      results.push(this._recentRequests.pop());
    }
    return results;
  }

  private _requestHeadersReceived(req: RequestInfo) {
    const reqInfo = this._requests[req.requestId];
    if (!reqInfo) {
      return;
    }
    reqInfo.noTimeout = true;
    if (reqInfo.timeoutCalled) {
      return this._callbacks.map((callback) => callback('ongoing', req));
    }
  }

  private _requestRedirected(req: RequestInfo) {
    const url = req.redirectUrl;
    if (!url) {
      return;
    }
    if (url.indexOf('data:') === 0 || url.indexOf('about:') === 0) {
      return this._requestDone(req);
    }
  }

  private _requestError(req: RequestInfo) {
    const reqInfo = this._requests[req.requestId];
    delete this._requests[req.requestId];
    if (req.tabId < 0) {
      return;
    }
    if (req.error === 'net::ERR_INCOMPLETE_CHUNKED_ENCODING') {
      return;
    }
    if ((req.error || '').indexOf('BLOCKED') >= 0) {
      return;
    }
    if ((req.error || '').indexOf('net::ERR_FILE_') === 0) {
      return;
    }
    if ((req.error || '').indexOf('NS_ERROR_ABORT') === 0) {
      return;
    }
    if (req.url.indexOf('file:') === 0) {
      return;
    }
    if (req.url.indexOf('chrome') === 0) {
      return;
    }
    if (req.url.indexOf('about:') === 0) {
      return;
    }
    if (req.url.indexOf('moz-') === 0) {
      return;
    }
    if (req.url.indexOf('://127.0.0.1') > 0) {
      return;
    }
    if (!reqInfo) {
      return;
    }
    if (req.error === 'net::ERR_ABORTED') {
      if (reqInfo.timeoutCalled && !reqInfo.noTimeout) {
        for (const callback of this._callbacks) {
          callback('timeoutAbort', req);
        }
      }
      return;
    }
    return this._callbacks.map((callback) => callback('error', req));
  }

  private _requestDone(req: RequestInfo) {
    for (const callback of this._callbacks) {
      callback('done', req);
    }
    return delete this._requests[req.requestId];
  }

  watchTabs(callback: TabCallback) {
    this._tabCallbacks.push(callback);
    if (this.tabsWatching) {
      return;
    }
    this.watch(this.setTabRequestInfo.bind(this));
    this.tabsWatching = true;
    chrome.tabs.onCreated.addListener((tab: Tab) => {
      if (!tab.id) {
        return;
      }
      this.tabInfo[tab.id] = this._newTabInfo();
    });
    chrome.tabs.onRemoved.addListener((tab: Tab) => {
      return delete this.tabInfo[tab.id as number];
    });
    chrome.tabs.onReplaced?.addListener((added: number, removed: number) => {
      if (this.tabInfo[added] == null) {
        this.tabInfo[added] = this._newTabInfo();
      }
      return delete this.tabInfo[removed];
    });
    chrome.tabs.onUpdated.addListener((_tabId: number, _changeInfo: unknown, tab: Tab) => {
      const info = this.tabInfo[tab.id as number] != null
        ? this.tabInfo[tab.id as number]
        : this.tabInfo[tab.id as number] = this._newTabInfo();
      if (!info) {
        return;
      }
      return this._tabCallbacks.map((tabCallback) => {
        return tabCallback(tab.id as number, info, null, 'updated');
      });
    });
    return chrome.tabs.query({}, (tabs: Tab[]) => {
      return tabs.map((tab) => {
        return this.tabInfo[tab.id as number] != null
          ? this.tabInfo[tab.id as number]
          : this.tabInfo[tab.id as number] = this._newTabInfo();
      });
    });
  }

  private _newTabInfo(): TabInfo {
    return {
      requests: {},
      requestCount: 0,
      requestStatus: {},
      ongoingCount: 0,
      errorCount: 0,
      doneCount: 0,
      summary: {}
    };
  }

  setTabRequestInfo(status: RequestStatus, req: RequestInfo) {
    const info = this.tabInfo[req.tabId];
    if (!info) {
      return;
    }
    if (status === 'start' && req.type === 'main_frame') {
      if (req.url.indexOf('chrome://errorpage/') !== 0) {
        const freshInfo = this._newTabInfo();
        for (const key of Object.keys(freshInfo)) {
          info[key] = freshInfo[key];
        }
      }
    }
    if (info.requestCount > 1000) {
      return;
    }
    info.requests[req.requestId] = req;
    const oldStatus = info.requestStatus[req.requestId];
    if (oldStatus) {
      info[`${this.eventCategory[oldStatus]}Count`] = (info[`${this.eventCategory[oldStatus]}Count`] as number) - 1;
    } else {
      if (status === 'timeoutAbort') {
        return;
      }
      info.requestCount++;
    }
    info.requestStatus[req.requestId] = status;
    info[`${this.eventCategory[status]}Count`] = (info[`${this.eventCategory[status]}Count`] as number) + 1;
    const id = typeof this.getSummaryId === 'function' ? this.getSummaryId(req) : undefined;
    if (id != null) {
      const summaryKey = id as string;
      if (this.eventCategory[status] === 'error') {
        if (this.eventCategory[oldStatus] !== 'error') {
          let summaryItem = info.summary[summaryKey];
          if (summaryItem == null) {
            summaryItem = info.summary[summaryKey] = {
              errorCount: 0
            };
          }
          summaryItem.errorCount++;
        }
      } else if (this.eventCategory[oldStatus] === 'error') {
        const summaryItem = info.summary[summaryKey];
        if (summaryItem != null) {
          summaryItem.errorCount--;
        }
      }
    }
    return this._tabCallbacks.map((callback) => {
      return callback(req.tabId, info, req, status);
    });
  }
}

export = WebRequestMonitor;
