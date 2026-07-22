// @vitest-environment jsdom

import {applyPopupProfile, getPopupPageInfo, openPopupOptions, setPopupState} from '../src/react/popup_bridge';

type RuntimeMessageCallback = (response?: unknown) => void;

type TestGlobal = typeof globalThis & {
  browser?: any;
  chrome?: any;
  PopupBridge?: unknown;
};

function testGlobal() {
  return globalThis as TestGlobal;
}

afterEach(() => {
  localStorage.clear();
  delete testGlobal().browser;
  delete testGlobal().chrome;
  delete testGlobal().PopupBridge;
});

describe('popup bridge module', () => {
  it('waits for the background response before resolving profile changes', async () => {
    let callback: RuntimeMessageCallback | undefined;
    const sendMessage = vi.fn((_message: unknown, nextCallback: RuntimeMessageCallback) => {
      callback = nextCallback;
    });
    testGlobal().chrome = {
      runtime: {
        lastError: null,
        sendMessage
      }
    };

    let settled = false;
    const result = applyPopupProfile('direct').then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(sendMessage).toHaveBeenCalledWith(
      {
        args: ['direct'],
        method: 'applyProfile',
        refreshActivePage: true
      },
      expect.any(Function)
    );

    callback?.({result: undefined});
    await result;
    expect(settled).toBe(true);
    expect(testGlobal().PopupBridge).toBeUndefined();
  });

  it('queries and caches active page information through the background client', async () => {
    const sendMessage = vi.fn((message: any, callback: RuntimeMessageCallback) => {
      callback({
        result: {
          domain: 'example.com',
          url: message.args[0].url
        }
      });
    });
    testGlobal().chrome = {
      runtime: {
        lastError: null,
        sendMessage
      },
      tabs: {
        query(_queryInfo: unknown, callback: (tabs: unknown[]) => void) {
          callback([{id: 7, incognito: false, url: 'https://example.com/', windowId: 3}]);
        }
      }
    };

    const info = await getPopupPageInfo({includeExplanations: true});

    expect(info).toEqual({domain: 'example.com', url: 'https://example.com/'});
    expect(sendMessage).toHaveBeenCalledWith(
      {
        args: [
          {
            cookieStoreId: undefined,
            groupId: undefined,
            includeExplanations: true,
            incognito: false,
            tabId: 7,
            url: 'https://example.com/',
            windowId: 3
          }
        ],
        method: 'getPageInfo'
      },
      expect.any(Function)
    );
    expect(JSON.parse(localStorage.getItem('state.web.last_page_info') || '{}')).toEqual(info);
  });

  it('uses object state updates and opens an existing options tab', async () => {
    const sendMessage = vi.fn((_message: unknown, callback: RuntimeMessageCallback) => callback({result: {}}));
    const update = vi.fn((_tabId: number, _props: unknown, callback: () => void) => callback());
    testGlobal().chrome = {
      runtime: {
        getURL: (path: string) => `chrome-extension://switchyagain/${path}`,
        lastError: null,
        sendMessage
      },
      tabs: {
        query(queryInfo: {active?: boolean}, callback: (tabs: unknown[]) => void) {
          callback(queryInfo.active ? [{id: 1, incognito: false}] : [{id: 2, incognito: false}]);
        },
        update
      }
    };

    await setPopupState('lastProfileNameForCondition', 'direct');
    await openPopupOptions('#/general');

    expect(sendMessage).toHaveBeenCalledWith(
      {
        args: [{lastProfileNameForCondition: 'direct'}],
        method: 'setState'
      },
      expect.any(Function)
    );
    expect(update).toHaveBeenCalledWith(
      2,
      {
        active: true,
        url: 'chrome-extension://switchyagain/options.html#/general'
      },
      expect.any(Function)
    );
  });

  it('focuses an existing Chrome options tab and restores its minimized window', async () => {
    const sendMessage = vi.fn((_message: unknown, callback: RuntimeMessageCallback) => callback({result: {}}));
    const updateTab = vi.fn((_tabId: number, _props: unknown, callback: () => void) => callback());
    const getWindow = vi.fn((_windowId: number, callback: (window: unknown) => void) => callback({state: 'minimized'}));
    const updateWindow = vi.fn((_windowId: number, _props: unknown, callback: () => void) => callback());
    testGlobal().chrome = {
      runtime: {
        getURL: (path: string) => `chrome-extension://switchyagain/${path}`,
        lastError: null,
        sendMessage
      },
      tabs: {
        query(queryInfo: {active?: boolean}, callback: (tabs: unknown[]) => void) {
          callback(
            queryInfo.active
              ? [{id: 1, incognito: true, windowId: 10}]
              : [{id: 2, incognito: false, url: 'chrome-extension://switchyagain/options.html', windowId: 20}]
          );
        },
        update: updateTab
      },
      windows: {
        get: getWindow,
        update: updateWindow
      }
    };

    await openPopupOptions();

    expect(updateTab).toHaveBeenCalledWith(2, {active: true}, expect.any(Function));
    expect(getWindow).toHaveBeenCalledWith(20, expect.any(Function));
    expect(updateWindow).toHaveBeenNthCalledWith(1, 20, {state: 'normal'}, expect.any(Function));
    expect(updateWindow).toHaveBeenNthCalledWith(2, 20, {focused: true}, expect.any(Function));
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('keeps Firefox cross-mode options handoff behavior', async () => {
    testGlobal().browser = {
      runtime: {
        getBrowserInfo: vi.fn()
      }
    };
    const sendMessage = vi.fn((message: any, callback: RuntimeMessageCallback) => {
      if (message.method === 'getOptionsPageState') {
        callback({result: {dirty: false, registered: true}});
      }
    });
    const create = vi.fn((_props: unknown, callback: (tab: unknown) => void) => callback({id: 3, incognito: true, windowId: 10}));
    const remove = vi.fn((_tabId: number, callback: () => void) => callback());
    const updateWindow = vi.fn((_windowId: number, _props: unknown, callback: () => void) => callback());
    testGlobal().chrome = {
      runtime: {
        getURL: (path: string) => `moz-extension://switchyagain/${path}`,
        lastError: null,
        sendMessage
      },
      tabs: {
        create,
        query(queryInfo: {active?: boolean}, callback: (tabs: unknown[]) => void) {
          callback(
            queryInfo.active
              ? [{id: 1, incognito: true, windowId: 10}]
              : [{id: 2, incognito: false, url: 'moz-extension://switchyagain/options.html', windowId: 20}]
          );
        },
        remove
      },
      windows: {
        get: vi.fn((_windowId: number, callback: (window: unknown) => void) => callback({state: 'normal'})),
        update: updateWindow
      }
    };

    await openPopupOptions();

    expect(sendMessage).toHaveBeenCalledWith(
      {
        args: [2],
        method: 'getOptionsPageState'
      },
      expect.any(Function)
    );
    expect(remove).toHaveBeenCalledWith(2, expect.any(Function));
    expect(create).toHaveBeenCalledWith({url: 'moz-extension://switchyagain/options.html'}, expect.any(Function));
    expect(updateWindow).toHaveBeenCalledWith(10, {focused: true}, expect.any(Function));
  });
});
