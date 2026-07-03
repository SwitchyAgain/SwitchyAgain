import {NETWORK_REQUEST_URLS} from './network_request_urls';

type HeapQueue<T> = {
  peek(): T | undefined;
  pop(): T | undefined;
  push(item: T): void;
};

class MinHeap<T> implements HeapQueue<T> {
  private readonly compare: (a: T, b: T) => number;
  private readonly nodes: T[];

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
    this.nodes = [];
  }

  peek() {
    return this.nodes[0];
  }

  pop() {
    if (this.nodes.length === 0) {
      return undefined;
    }
    const root = this.nodes[0];
    const last = this.nodes.pop();
    if (this.nodes.length > 0) {
      this.nodes[0] = last as T;
      this.siftDown(0);
    }
    return root;
  }

  push(item: T) {
    this.nodes.push(item);
    this.siftUp(this.nodes.length - 1);
  }

  private siftDown(index: number) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;

      if (left < this.nodes.length && this.compare(this.nodes[left], this.nodes[smallest]) < 0) {
        smallest = left;
      }
      if (right < this.nodes.length && this.compare(this.nodes[right], this.nodes[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === index) {
        return;
      }
      this.swap(index, smallest);
      index = smallest;
    }
  }

  private siftUp(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.nodes[index], this.nodes[parent]) >= 0) {
        return;
      }
      this.swap(index, parent);
      index = parent;
    }
  }

  private swap(a: number, b: number) {
    const item = this.nodes[a];
    this.nodes[a] = this.nodes[b];
    this.nodes[b] = item;
  }
}

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
type TabChangeInfo = {
  url?: string;
  [key: string]: unknown;
};

type SummaryItem = {
  errorCount: number;
};

type TabInfo = {
  doneCount: number;
  errorCount: number;
  mainFrameRequestId?: string;
  mainFrameStartTime?: number;
  mainFrameUrl?: string;
  ongoingCount: number;
  requestCount: number;
  requests: Record<string, RequestInfo>;
  requestStatus: Record<string, RequestStatus>;
  summary: Record<string, SummaryItem>;
};

type RequestCallback = (status: RequestStatus, req: RequestInfo) => unknown;
type TabCallback = (tabId: number, info: TabInfo, req: RequestInfo | null, status: RequestStatus | 'updated') => unknown;

function shouldResetTabInfoForUpdatedUrl(url?: string) {
  if (!url) {
    return false;
  }
  if (url.indexOf('chrome://errorpage/') === 0) {
    return false;
  }
  if (url.indexOf('about:neterror') === 0 || url.indexOf('about:certerror') === 0) {
    return false;
  }
  return url.indexOf('chrome') === 0 || url.indexOf('about:') === 0 || url.indexOf('moz-') === 0;
}

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
    this._recentRequests = new MinHeap((a: RequestInfo, b: RequestInfo) => {
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
      urls: NETWORK_REQUEST_URLS
    });
    chrome.webRequest.onHeadersReceived.addListener(this._requestHeadersReceived.bind(this), {
      urls: NETWORK_REQUEST_URLS
    });
    chrome.webRequest.onBeforeRedirect.addListener(this._requestRedirected.bind(this), {
      urls: NETWORK_REQUEST_URLS
    });
    chrome.webRequest.onCompleted.addListener(this._requestDone.bind(this), {
      urls: NETWORK_REQUEST_URLS
    });
    chrome.webRequest.onErrorOccurred.addListener(this._requestError.bind(this), {
      urls: NETWORK_REQUEST_URLS
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
    if (req.error === 'net::ERR_CACHE_MISS') {
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
    chrome.tabs.onUpdated.addListener((_tabId: number, changeInfo: TabChangeInfo, tab: RequestTab) => {
      const tabId = tab.id;
      if (tabId == null) {
        return;
      }
      const info = this.tabInfo[tabId] != null ? this.tabInfo[tabId] : (this.tabInfo[tabId] = this._newTabInfo());
      if (shouldResetTabInfoForUpdatedUrl(changeInfo.url)) {
        this.resetTabInfo(info, this._newTabInfo());
      }
      return this._tabCallbacks.map((tabCallback) => {
        return tabCallback(tabId, info, null, 'updated');
      });
    });
    return chrome.tabs.query({}, (tabs: RequestTab[]) => {
      return tabs.map((tab) => {
        if (tab.id == null) {
          return undefined;
        }
        return this.tabInfo[tab.id] != null ? this.tabInfo[tab.id] : (this.tabInfo[tab.id] = this._newTabInfo());
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
        info.mainFrameRequestId = req.requestId;
        info.mainFrameStartTime = req._startTime;
        info.mainFrameUrl = req.url;
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
    info.mainFrameRequestId = freshInfo.mainFrameRequestId;
    info.mainFrameStartTime = freshInfo.mainFrameStartTime;
    info.mainFrameUrl = freshInfo.mainFrameUrl;
    info.ongoingCount = freshInfo.ongoingCount;
    info.errorCount = freshInfo.errorCount;
    info.doneCount = freshInfo.doneCount;
    info.summary = freshInfo.summary;
  }
}

export default WebRequestMonitor;
