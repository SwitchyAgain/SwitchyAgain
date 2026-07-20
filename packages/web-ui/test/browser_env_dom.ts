// @vitest-environment jsdom

import {
  createTab,
  extensionBrowserMajorVersion,
  extensionBrowserName,
  extensionId,
  extensionManifestVersion,
  extensionMessage,
  extensionUiLanguage,
  extensionUrl,
  getGlobalValue,
  getJsonLocalStorage,
  queryTabsByUrl,
  runtimeAvailable,
  runtimeLastErrorMessage,
  sendRuntimeMessage,
  setBodyOpacity,
  setJsonLocalStorage,
  updateTab
} from '../src/react/browser_env';

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
  delete testGlobal().PopupBridge;
});

describe('browser environment adapter', () => {
  it('reports unavailable runtime messaging without throwing', () => {
    testGlobal().chrome = {};
    const callback = vi.fn();

    expect(runtimeAvailable()).toBe(false);
    expect(sendRuntimeMessage({method: 'getAll'}, callback)).toBe(false);
    expect(callback).not.toHaveBeenCalled();
    expect(runtimeLastErrorMessage()).toBeUndefined();
  });

  it('wraps runtime manifest, URLs, messages, and lastError access', () => {
    const sendMessage = vi.fn((_message: unknown, callback: (response?: unknown) => void) => callback({result: 'ok'}));
    testGlobal().chrome = {
      i18n: {
        getMessage: vi.fn((key: string) => `message:${key}`),
        getUILanguage: vi.fn(() => 'zh-CN')
      },
      runtime: {
        getManifest: () => ({
          manifest_version: 3,
          version: '0.0.1'
        }),
        getURL: (path: string) => `moz-extension://id/${path}`,
        id: 'extension-id',
        lastError: {
          message: 'runtime failed'
        },
        sendMessage
      }
    };
    const callback = vi.fn();

    expect(runtimeAvailable()).toBe(true);
    expect(sendRuntimeMessage({method: 'getAll'}, callback)).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({method: 'getAll'}, expect.any(Function));
    expect(callback).toHaveBeenCalledWith({result: 'ok'});
    expect(runtimeLastErrorMessage()).toBe('runtime failed');
    expect(extensionManifestVersion()).toBe('0.0.1');
    expect(extensionId()).toBe('extension-id');
    expect(extensionUrl('options.html')).toBe('moz-extension://id/options.html');
    expect(extensionMessage('appName', 'fallback')).toBe('message:appName');
    expect(extensionUiLanguage()).toBe('zh-CN');
  });

  it('identifies the browser used for backup metadata', () => {
    testGlobal().browser = {
      runtime: {
        getBrowserInfo: vi.fn()
      }
    };
    expect(extensionBrowserName('Mozilla/5.0 Chrome/1.0.0.0 Safari/537.36', [{brand: 'Chromium'}, {brand: 'Google Chrome'}])).toBe(
      'firefox'
    );

    delete testGlobal().browser;
    expect(extensionBrowserName('Mozilla/5.0 Chrome/1.0.0.0 Safari/537.36', [{brand: 'Chromium'}, {brand: 'Microsoft Edge'}])).toBe('edge');
    expect(extensionBrowserName('Mozilla/5.0 Chrome/1.0.0.0 Safari/537.36', [{brand: 'Chromium'}, {brand: 'Google Chrome'}])).toBe(
      'chrome'
    );
    expect(extensionBrowserName('Mozilla/5.0 Chrome/1.0.0.0 Safari/537.36', [{brand: 'Chromium'}])).toBe('chromium');

    expect(extensionBrowserName('Mozilla/5.0 Edg/1.0.0.0')).toBe('edge');
    expect(extensionBrowserName('Mozilla/5.0 Firefox/1.0')).toBe('firefox');
    expect(extensionBrowserName('Mozilla/5.0 Chrome/1.0.0.0 Safari/537.36')).toBe('chrome');
    expect(extensionBrowserName('Mozilla/5.0 Chromium/1.0.0.0 Safari/537.36')).toBe('chromium');
    expect(extensionBrowserName('Mozilla/5.0 Chrome/1.0.0.0 Safari/537.36 Vivaldi/2.0')).toBe('chromium');
    expect(extensionBrowserName('unknown')).toBe('unknown');
  });

  it('extracts stable browser major version fixtures', () => {
    expect(extensionBrowserMajorVersion('Mozilla/5.0 Firefox/1.0')).toBe('1');
    expect(extensionBrowserMajorVersion('Mozilla/5.0 Chrome/1.0.0.0 Safari/537.36')).toBe('1');
    expect(extensionBrowserMajorVersion('Mozilla/5.0 Chromium/1.0.0.0 Safari/537.36')).toBe('1');
    expect(extensionBrowserMajorVersion('Mozilla/5.0 Chrome/1.0.0.0 Edg/2.0.0.0')).toBe('2');
    expect(extensionBrowserMajorVersion('', [{brand: 'Google Chrome', version: '1.0.0.0'}])).toBe('1');
    expect(extensionBrowserMajorVersion('unknown')).toBe('unknown');
  });

  it('wraps tab APIs and reports missing query support', () => {
    const create = vi.fn();
    const query = vi.fn((_queryInfo: unknown, callback: (tabs: Array<{id?: number; url?: string}>) => void) =>
      callback([{id: 7, url: 'options.html'}])
    );
    const update = vi.fn();
    testGlobal().chrome = {
      tabs: {
        create,
        query,
        update
      }
    };
    const callback = vi.fn();

    createTab('about:addons');
    expect(create).toHaveBeenCalledWith({url: 'about:addons'});

    expect(queryTabsByUrl('options.html', callback)).toBe(true);
    expect(query).toHaveBeenCalledWith({url: 'options.html'}, expect.any(Function));
    expect(callback).toHaveBeenCalledWith([{id: 7, url: 'options.html'}]);

    updateTab(7, {active: true});
    expect(update).toHaveBeenCalledWith(7, {active: true});

    testGlobal().chrome = {};
    expect(queryTabsByUrl('options.html', callback)).toBe(false);
  });

  it('handles JSON localStorage values and parse failures', () => {
    setJsonLocalStorage('ok', {value: 1});
    localStorage.setItem('bad', '{');

    expect(getJsonLocalStorage('ok')).toEqual({value: 1});
    expect(getJsonLocalStorage('missing')).toBeUndefined();
    expect(getJsonLocalStorage('bad')).toBeUndefined();
  });

  it('wraps simple global and document helpers', () => {
    testGlobal().PopupBridge = {ready: true};

    expect(getGlobalValue<{ready: boolean}>('PopupBridge')).toEqual({ready: true});

    setBodyOpacity('0.5');
    expect(document.body.style.opacity).toBe('0.5');
  });
});
