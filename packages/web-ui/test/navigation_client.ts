import {downloadBlob, manifestVersion, openManage, openOptions, openShortcutConfig, shouldAutoMount} from '../src/react/navigation_client';

type BrowserTab = {
  id?: number;
  url?: string;
};

const browserEnvMock = vi.hoisted(() => ({
  createTab: vi.fn((_url: string) => {}),
  downloadBlobFile: vi.fn((_blob: Blob, _filename: string) => {}),
  extensionBrowser: vi.fn((): unknown => undefined),
  extensionId: vi.fn(() => 'extension-id'),
  extensionManifestVersion: vi.fn(() => '1.2.3'),
  extensionUrl: vi.fn((path: string) => `moz-extension://id/${path}`),
  queryTabsByUrl: vi.fn((_url: string, callback: (tabs: BrowserTab[]) => void) => {
    callback([]);
    return true;
  }),
  setLocationHref: vi.fn((_url: string) => {}),
  shouldAutoMountScript: vi.fn((_scriptName: string) => false),
  updateTab: vi.fn((_tabId: number | undefined, _props: {active?: boolean; url?: string}) => {})
}));

vi.mock('../src/react/browser_env', () => browserEnvMock);

beforeEach(() => {
  browserEnvMock.createTab.mockClear();
  browserEnvMock.downloadBlobFile.mockClear();
  browserEnvMock.extensionBrowser.mockReset();
  browserEnvMock.extensionBrowser.mockReturnValue(undefined);
  browserEnvMock.extensionId.mockReset();
  browserEnvMock.extensionId.mockReturnValue('extension-id');
  browserEnvMock.extensionManifestVersion.mockReset();
  browserEnvMock.extensionManifestVersion.mockReturnValue('1.2.3');
  browserEnvMock.extensionUrl.mockReset();
  browserEnvMock.extensionUrl.mockImplementation((path: string) => `moz-extension://id/${path}`);
  browserEnvMock.queryTabsByUrl.mockReset();
  browserEnvMock.queryTabsByUrl.mockImplementation((_url: string, callback: (tabs: BrowserTab[]) => void) => {
    callback([]);
    return true;
  });
  browserEnvMock.setLocationHref.mockClear();
  browserEnvMock.shouldAutoMountScript.mockReset();
  browserEnvMock.shouldAutoMountScript.mockReturnValue(false);
  browserEnvMock.updateTab.mockClear();
});

describe('navigation client', () => {
  it('wraps manifest version, automount checks, and downloads', () => {
    const blob = new Blob(['backup']);
    browserEnvMock.shouldAutoMountScript.mockReturnValue(true);

    expect(manifestVersion()).toBe('1.2.3');
    expect(shouldAutoMount('options.js')).toBe(true);
    downloadBlob(blob, 'OmegaOptions.bak');

    expect(browserEnvMock.extensionManifestVersion).toHaveBeenCalled();
    expect(browserEnvMock.shouldAutoMountScript).toHaveBeenCalledWith('options.js');
    expect(browserEnvMock.downloadBlobFile).toHaveBeenCalledWith(blob, 'OmegaOptions.bak');
  });

  it('opens the extension management page for the current extension id', () => {
    browserEnvMock.extensionId.mockReturnValue('abc123');

    openManage();

    expect(browserEnvMock.createTab).toHaveBeenCalledWith('chrome://extensions/?id=abc123');
  });

  it('opens browser shortcut settings when the API is available', () => {
    const openShortcutSettings = vi.fn();
    browserEnvMock.extensionBrowser.mockReturnValue({
      commands: {
        openShortcutSettings
      }
    });

    openShortcutConfig();

    expect(openShortcutSettings).toHaveBeenCalled();
    expect(browserEnvMock.createTab).not.toHaveBeenCalled();
  });

  it('falls back to add-ons page when browser shortcut settings reject', async () => {
    const openShortcutSettings = vi.fn(() => Promise.reject(new Error('not supported')));
    browserEnvMock.extensionBrowser.mockReturnValue({
      commands: {
        openShortcutSettings
      }
    });

    openShortcutConfig();
    await Promise.resolve();
    await Promise.resolve();

    expect(browserEnvMock.createTab).toHaveBeenCalledWith('about:addons');
  });

  it('uses browser-specific shortcut fallback URLs', () => {
    browserEnvMock.extensionBrowser.mockReturnValue({});
    openShortcutConfig();
    expect(browserEnvMock.createTab).toHaveBeenCalledWith('about:addons');

    browserEnvMock.createTab.mockClear();
    browserEnvMock.extensionBrowser.mockReturnValue(undefined);
    openShortcutConfig();
    expect(browserEnvMock.createTab).toHaveBeenCalledWith('chrome://extensions/configureCommands');
  });

  it('activates an existing options tab', () => {
    browserEnvMock.queryTabsByUrl.mockImplementation((url: string, callback: (tabs: BrowserTab[]) => void) => {
      callback([
        {
          id: 7,
          url
        }
      ]);
      return true;
    });

    openOptions();

    expect(browserEnvMock.queryTabsByUrl).toHaveBeenCalledWith('moz-extension://id/options.html', expect.any(Function));
    expect(browserEnvMock.updateTab).toHaveBeenCalledWith(7, {
      active: true
    });
    expect(browserEnvMock.createTab).not.toHaveBeenCalled();
  });

  it('updates an existing options tab with a requested hash', () => {
    browserEnvMock.queryTabsByUrl.mockImplementation((_url: string, callback: (tabs: BrowserTab[]) => void) => {
      callback([
        {
          id: 7,
          url: 'moz-extension://id/options.html#!/old'
        }
      ]);
      return true;
    });

    openOptions('#!/general');

    expect(browserEnvMock.updateTab).toHaveBeenCalledWith(7, {
      active: true,
      url: 'moz-extension://id/options.html#!/general'
    });
    expect(browserEnvMock.createTab).not.toHaveBeenCalled();
  });

  it('creates an options tab when none already exists', () => {
    openOptions('#!/profile/proxy');

    expect(browserEnvMock.createTab).toHaveBeenCalledWith('moz-extension://id/options.html#!/profile/proxy');
    expect(browserEnvMock.updateTab).not.toHaveBeenCalled();
  });

  it('falls back to direct location navigation when tab query is unavailable', () => {
    browserEnvMock.queryTabsByUrl.mockReturnValue(false);

    openOptions('#!/general');

    expect(browserEnvMock.setLocationHref).toHaveBeenCalledWith('moz-extension://id/options.html#!/general');
    expect(browserEnvMock.createTab).not.toHaveBeenCalled();
    expect(browserEnvMock.updateTab).not.toHaveBeenCalled();
  });
});
