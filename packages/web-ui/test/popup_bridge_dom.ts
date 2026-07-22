// @vitest-environment jsdom

import {applyPopupProfile, getPopupPageInfo, openPopupOptions, setPopupState} from '../src/react/popup_bridge';

type RuntimeMessageCallback = (response?: unknown) => void;

type TestGlobal = typeof globalThis & {
  chrome?: any;
  PopupBridge?: unknown;
};

function testGlobal() {
  return globalThis as TestGlobal;
}

afterEach(() => {
  localStorage.clear();
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
});
