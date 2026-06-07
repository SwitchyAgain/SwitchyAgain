type HeapQueue<T> = {
  peek(): T | undefined;
  pop(): T | undefined;
  push(item: T): void;
};

type HeapConstructor = new <T>(compare: (a: T, b: T) => number) => HeapQueue<T>;

import HeapModule = require('heap');

const Heap = HeapModule as unknown as HeapConstructor;

type RequestStatus = 'start' | 'ongoing' | 'timeout' | 'error' | 'timeoutAbort' | 'done';
type EventCategory = 'done' | 'error' | 'ongoing';
type EventCountKey = `${EventCategory}Count`;

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

type RequestTab = Pick<ChromeTab, 'id'>;

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
  tabInfo: Record<number, TabInfo>;
  tabsWatching: boolean;
  timer: ReturnType<typeof setInterval> | null;
  watching: boolean;
  private _callbacks: RequestCallback[];
  private _recentRequests: HeapQueue<RequestInfo>;
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
    chrome.tabs.onCreated.addListener((tab: RequestTab) => {
      if (!tab.id) {
        return;
      }
      this.tabInfo[tab.id] = this._newTabInfo();
    });
    chrome.tabs.onRemoved.addListener((tabId: number) => {
      return delete this.tabInfo[tabId];
    });
    chrome.tabs.onReplaced?.addListener((added: number, removed: number) => {
      if (this.tabInfo[added] == null) {
        this.tabInfo[added] = this._newTabInfo();
      }
      return delete this.tabInfo[removed];
    });
    chrome.tabs.onUpdated.addListener((_tabId: number, _changeInfo: Record<string, unknown>, tab: RequestTab) => {
      if (tab.id == null) {
        return;
      }
      const info = this.tabInfo[tab.id] != null
        ? this.tabInfo[tab.id]
        : this.tabInfo[tab.id] = this._newTabInfo();
      return this._tabCallbacks.map((tabCallback) => {
        return tabCallback(tab.id, info, null, 'updated');
      });
    });
    return chrome.tabs.query({}, (tabs: RequestTab[]) => {
      return tabs.map((tab) => {
        if (tab.id == null) {
          return undefined;
        }
        return this.tabInfo[tab.id] != null
          ? this.tabInfo[tab.id]
          : this.tabInfo[tab.id] = this._newTabInfo();
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
        this.resetTabInfo(info, freshInfo);
      }
    }
    if (info.requestCount > 1000) {
      return;
    }
    info.requests[req.requestId] = req;
    const oldStatus = info.requestStatus[req.requestId];
    if (oldStatus) {
      this.incrementCategoryCount(info, oldStatus, -1);
    } else {
      if (status === 'timeoutAbort') {
        return;
      }
      info.requestCount++;
    }
    info.requestStatus[req.requestId] = status;
    this.incrementCategoryCount(info, status, 1);
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

  private countKey(status: RequestStatus): EventCountKey {
    return `${this.eventCategory[status]}Count`;
  }

  private incrementCategoryCount(info: TabInfo, status: RequestStatus, delta: number) {
    const key = this.countKey(status);
    info[key] += delta;
  }

  private resetTabInfo(info: TabInfo, freshInfo: TabInfo) {
    info.requests = freshInfo.requests;
    info.requestCount = freshInfo.requestCount;
    info.requestStatus = freshInfo.requestStatus;
    info.ongoingCount = freshInfo.ongoingCount;
    info.errorCount = freshInfo.errorCount;
    info.doneCount = freshInfo.doneCount;
    info.summary = freshInfo.summary;
  }
}

export = WebRequestMonitor;
