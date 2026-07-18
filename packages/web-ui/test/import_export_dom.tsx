// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {ImportExport} from '../src/react/import_export';
import {RESTORE_URL_STATE} from '../src/react/import_export_logic';
import type {Options, WebDavSyncConfig, WebDavSyncStatus} from '../src/react/options_client_types';

const optionsClientMock = vi.hoisted(() => ({
  clearWindowTimeout: vi.fn((timeout: ReturnType<typeof globalThis.setTimeout> | undefined) => {
    if (timeout != null) {
      clearTimeout(timeout);
    }
  }),
  confirmDialog: vi.fn((messageText: string) => window.confirm(messageText)),
  downloadBlob: vi.fn(),
  extensionBrowserName: vi.fn(() => 'firefox'),
  extensionManifestVersion: vi.fn(() => '1.3.0'),
  getLocalState: vi.fn(),
  getState: vi.fn(),
  getWebDavSyncConfig: vi.fn(),
  loadOptions: vi.fn(),
  message: vi.fn((_key: string, fallback = '') => fallback),
  patchOptions: vi.fn(),
  reloadLocation: vi.fn(),
  resetOptions: vi.fn(),
  resetOptionsSync: vi.fn(),
  runWebDavSyncAction: vi.fn(),
  setLocalState: vi.fn(),
  setWindowTimeout: vi.fn((callback: () => void, delay = 0) => setTimeout(callback, delay)),
  setOptionsSync: vi.fn(),
  setWebDavOptionsSync: vi.fn(),
  setWebDavSyncConfig: vi.fn(),
  shouldAutoMount: vi.fn(() => false),
  testWebDavSync: vi.fn()
}));

vi.mock('../src/react/navigation_client', () => ({
  downloadBlob: optionsClientMock.downloadBlob,
  shouldAutoMount: optionsClientMock.shouldAutoMount
}));

vi.mock('../src/react/browser_env', () => ({
  clearWindowTimeout: optionsClientMock.clearWindowTimeout,
  confirmDialog: optionsClientMock.confirmDialog,
  extensionBrowserName: optionsClientMock.extensionBrowserName,
  extensionManifestVersion: optionsClientMock.extensionManifestVersion,
  reloadLocation: optionsClientMock.reloadLocation,
  setWindowTimeout: optionsClientMock.setWindowTimeout
}));

vi.mock('../src/react/state_client', () => ({
  getLocalState: optionsClientMock.getLocalState,
  getState: optionsClientMock.getState,
  setLocalState: optionsClientMock.setLocalState
}));

vi.mock('../src/react/options_api_client', () => ({
  getWebDavSyncConfig: optionsClientMock.getWebDavSyncConfig,
  loadOptions: optionsClientMock.loadOptions,
  patchOptions: optionsClientMock.patchOptions,
  resetOptions: optionsClientMock.resetOptions,
  resetOptionsSync: optionsClientMock.resetOptionsSync,
  runWebDavSyncAction: optionsClientMock.runWebDavSyncAction,
  setOptionsSync: optionsClientMock.setOptionsSync,
  setWebDavOptionsSync: optionsClientMock.setWebDavOptionsSync,
  setWebDavSyncConfig: optionsClientMock.setWebDavSyncConfig,
  testWebDavSync: optionsClientMock.testWebDavSync
}));

vi.mock('../src/react/i18n_client', () => ({
  message: optionsClientMock.message
}));

function optionsFixture(): Options {
  return {
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile'
    }
  };
}

function mockActiveWebDavSync(webDavSyncStatus?: WebDavSyncStatus) {
  optionsClientMock.getLocalState.mockImplementation((key: string) => {
    if (key === 'syncOptions') {
      return 'sync';
    }
    if (key === 'syncProvider') {
      return 'webdav';
    }
    if (key === 'webDavSyncStatus') {
      return webDavSyncStatus || null;
    }
    return '';
  });
  optionsClientMock.getState.mockImplementation((key: string) => {
    if (key === 'syncOptions') {
      return Promise.resolve('sync');
    }
    if (key === 'syncProvider') {
      return Promise.resolve('webdav');
    }
    if (key === 'webDavSyncStatus') {
      return Promise.resolve(webDavSyncStatus || null);
    }
    return Promise.resolve('');
  });
  optionsClientMock.getWebDavSyncConfig.mockResolvedValue({
    intervalMinutes: 5,
    remotePath: 'SwitchyAgain/options-sync.json',
    serverUrl: 'https://example.com/dav/'
  });
}

async function downloadedBackup() {
  return JSON.parse(await (optionsClientMock.downloadBlob.mock.calls[0][0] as Blob).text()) as {
    metadata: {
      browser: string;
      exportedAt: string;
      extensionVersion: string;
    };
    options: Options;
    schema: string;
    version: number;
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  optionsClientMock.downloadBlob.mockReset();
  optionsClientMock.clearWindowTimeout.mockClear();
  optionsClientMock.confirmDialog.mockClear();
  optionsClientMock.getLocalState.mockReset();
  optionsClientMock.getState.mockReset();
  optionsClientMock.getWebDavSyncConfig.mockReset();
  optionsClientMock.loadOptions.mockReset();
  optionsClientMock.message.mockClear();
  optionsClientMock.patchOptions.mockReset();
  optionsClientMock.reloadLocation.mockReset();
  optionsClientMock.resetOptions.mockReset();
  optionsClientMock.resetOptionsSync.mockReset();
  optionsClientMock.runWebDavSyncAction.mockReset();
  optionsClientMock.setLocalState.mockReset();
  optionsClientMock.setWindowTimeout.mockClear();
  optionsClientMock.setOptionsSync.mockReset();
  optionsClientMock.setWebDavOptionsSync.mockReset();
  optionsClientMock.setWebDavSyncConfig.mockReset();
  optionsClientMock.shouldAutoMount.mockClear();
  optionsClientMock.testWebDavSync.mockReset();
  optionsClientMock.getLocalState.mockImplementation((key: string) => (key === 'syncOptions' ? 'disabled' : ''));
  optionsClientMock.getState.mockResolvedValue('');
  optionsClientMock.getWebDavSyncConfig.mockResolvedValue(null);
  optionsClientMock.setWebDavSyncConfig.mockImplementation((config: WebDavSyncConfig) =>
    Promise.resolve({
      ...config,
      hasPassword: Boolean(config.password || config.hasPassword),
      password: undefined
    })
  );
  optionsClientMock.runWebDavSyncAction.mockResolvedValue(undefined);
  optionsClientMock.testWebDavSync.mockResolvedValue({exists: false, ok: true});
});

describe('import export component', () => {
  it('applies dirty options before exporting a full backup', async () => {
    const appliedOptions = {
      ...optionsFixture(),
      '+applied': {
        name: 'applied',
        profileType: 'FixedProfile'
      }
    };
    const onApplyOptions = vi.fn().mockResolvedValue(appliedOptions);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ImportExport embedded onApplyOptions={onApplyOptions} options={optionsFixture()} optionsDirty />);

    fireEvent.click(screen.getByRole('button', {name: /Make backup/}));

    await waitFor(() => expect(optionsClientMock.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'SwitchyAgainBackup.json'));
    expect(window.confirm).toHaveBeenCalled();
    expect(onApplyOptions).toHaveBeenCalled();
    const backup = await downloadedBackup();
    expect(backup).toEqual({
      schema: 'SwitchyAgainBackup',
      version: 1,
      metadata: {
        browser: 'firefox',
        exportedAt: expect.any(String),
        extensionVersion: '1.3.0'
      },
      options: appliedOptions
    });
    expect(new Date(backup.metadata.exportedAt).toISOString()).toBe(backup.metadata.exportedAt);
  });

  it('restores options from an online backup URL', async () => {
    const restoredOptions = {
      ...optionsFixture(),
      '+restored': {
        name: 'restored',
        profileType: 'FixedProfile'
      }
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('backup-content')
    });
    const onOptionsReplace = vi.fn();
    optionsClientMock.resetOptions.mockResolvedValue(restoredOptions);
    vi.stubGlobal('fetch', fetchMock);

    render(<ImportExport embedded onOptionsReplace={onOptionsReplace} options={optionsFixture()} />);

    fireEvent.change(screen.getByLabelText('Restore from online'), {
      target: {
        value: 'https://example.com/options.bak'
      }
    });
    expect(optionsClientMock.setLocalState).toHaveBeenCalledWith(RESTORE_URL_STATE, 'https://example.com/options.bak');

    fireEvent.click(screen.getByRole('button', {name: 'Restore'}));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/options.bak',
        expect.objectContaining({
          cache: 'no-store',
          signal: expect.any(AbortSignal)
        })
      );
    });
    await waitFor(() => {
      expect(optionsClientMock.resetOptions).toHaveBeenCalledWith('backup-content');
    });
    expect(onOptionsReplace).toHaveBeenCalledWith(restoredOptions, {dirty: false});
    expect(screen.getByText('Options imported.')).toBeTruthy();
  });

  it('shows restore download errors and leaves existing options unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Unavailable'
    });
    const onOptionsReplace = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ImportExport embedded onOptionsReplace={onOptionsReplace} options={optionsFixture()} />);

    fireEvent.change(screen.getByLabelText('Restore from online'), {
      target: {
        value: 'https://example.com/missing.bak'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Restore'}));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('503 Unavailable'));
    expect(optionsClientMock.resetOptions).not.toHaveBeenCalled();
    expect(onOptionsReplace).not.toHaveBeenCalled();
    expect((screen.getByRole('button', {name: 'Restore'}) as HTMLButtonElement).disabled).toBe(false);
  });

  it('confirms and applies dirty options before enabling sync', async () => {
    const onApplyOptions = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    optionsClientMock.setOptionsSync.mockResolvedValue(undefined);

    render(<ImportExport embedded onApplyOptions={onApplyOptions} options={optionsFixture()} optionsDirty />);

    const browserSyncProvider = screen.getByLabelText('Browser Sync').closest('.sync-provider') as HTMLElement;
    const enableBrowserSync = within(browserSyncProvider).getByRole('button', {name: 'Enable Browser Sync'}) as HTMLButtonElement;
    expect(enableBrowserSync.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Browser Sync'));
    expect(enableBrowserSync.disabled).toBe(false);

    fireEvent.click(enableBrowserSync);

    await waitFor(() => expect(optionsClientMock.setOptionsSync).toHaveBeenCalledWith(true, undefined));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Your changes to the options must be applied before you proceed.'));
    expect(onApplyOptions).toHaveBeenCalled();
    expect(onApplyOptions.mock.invocationCallOrder[0]).toBeLessThan(optionsClientMock.setOptionsSync.mock.invocationCallOrder[0]);
    await waitFor(() => expect(optionsClientMock.reloadLocation).toHaveBeenCalled());
  });

  it('opens WebDAV settings only after choosing WebDAV sync and disables spellcheck', async () => {
    render(<ImportExport embedded options={optionsFixture()} />);

    expect(screen.queryByLabelText('Server URL')).toBeNull();

    const webDavProvider = screen.getByLabelText('WebDAV Sync').closest('.sync-provider') as HTMLElement;
    const enableWebDavSync = within(webDavProvider).getByRole('button', {name: 'Enable WebDAV Sync'}) as HTMLButtonElement;
    expect(enableWebDavSync.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('WebDAV Sync'));
    expect(enableWebDavSync.disabled).toBe(false);

    fireEvent.click(enableWebDavSync);

    expect(screen.getByLabelText('Server URL')).toBeTruthy();
    for (const label of ['Server URL', 'Remote path', 'Username', 'Password or app token']) {
      expect(screen.getByLabelText(label).getAttribute('spellcheck')).toBe('false');
    }
  });

  it('requires a successful WebDAV test and save before enabling upload', async () => {
    render(<ImportExport embedded options={optionsFixture()} />);

    fireEvent.click(screen.getByLabelText('WebDAV Sync'));
    fireEvent.click(screen.getByRole('button', {name: 'Enable WebDAV Sync'}));
    fireEvent.change(screen.getByLabelText('Server URL'), {
      target: {
        value: 'https://example.com/dav/'
      }
    });

    const testButton = screen.getByRole('button', {name: 'Test & Save'}) as HTMLButtonElement;
    const uploadButton = screen.getByRole('button', {name: 'Upload & Enable'}) as HTMLButtonElement;
    const downloadButton = screen.getByRole('button', {name: 'Download & Enable'}) as HTMLButtonElement;

    expect(testButton.disabled).toBe(false);
    expect(uploadButton.disabled).toBe(true);
    expect(downloadButton.disabled).toBe(true);

    fireEvent.click(testButton);

    await waitFor(() => expect(optionsClientMock.testWebDavSync).toHaveBeenCalled());
    await waitFor(() => expect(optionsClientMock.setWebDavSyncConfig).toHaveBeenCalled());
    await waitFor(() => expect(uploadButton.disabled).toBe(false));
    expect(downloadButton.disabled).toBe(true);
    expect(
      await screen.findByText('Connection successful. No remote sync file was found. Upload & Enable to enable WebDAV Sync.')
    ).toBeTruthy();
  });

  it('enables WebDAV download after testing and saving an existing remote sync file', async () => {
    optionsClientMock.testWebDavSync.mockResolvedValue({exists: true, ok: true});

    render(<ImportExport embedded options={optionsFixture()} />);

    fireEvent.click(screen.getByLabelText('WebDAV Sync'));
    fireEvent.click(screen.getByRole('button', {name: 'Enable WebDAV Sync'}));
    fireEvent.change(screen.getByLabelText('Server URL'), {
      target: {
        value: 'https://example.com/dav/'
      }
    });

    fireEvent.click(screen.getByRole('button', {name: 'Test & Save'}));

    const uploadButton = screen.getByRole('button', {name: 'Upload & Enable'}) as HTMLButtonElement;
    const downloadButton = screen.getByRole('button', {name: 'Download & Enable'}) as HTMLButtonElement;

    await waitFor(() => expect(optionsClientMock.setWebDavSyncConfig).toHaveBeenCalled());
    await waitFor(() => expect(uploadButton.disabled).toBe(false));
    expect(downloadButton.disabled).toBe(false);
    expect(
      await screen.findByText(
        'Connection successful. A remote sync file was found. Choose Upload & Enable or Download & Enable to enable WebDAV Sync.'
      )
    ).toBeTruthy();
  });

  it('requires WebDAV connection changes to be tested and saved again before enabling', async () => {
    render(<ImportExport embedded options={optionsFixture()} />);

    fireEvent.click(screen.getByLabelText('WebDAV Sync'));
    fireEvent.click(screen.getByRole('button', {name: 'Enable WebDAV Sync'}));
    fireEvent.change(screen.getByLabelText('Server URL'), {
      target: {
        value: 'https://example.com/dav/'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Test & Save'}));

    const uploadButton = screen.getByRole('button', {name: 'Upload & Enable'}) as HTMLButtonElement;
    const downloadButton = screen.getByRole('button', {name: 'Download & Enable'}) as HTMLButtonElement;
    await waitFor(() => expect(uploadButton.disabled).toBe(false));

    fireEvent.change(screen.getByLabelText('Remote path'), {
      target: {
        value: 'SwitchyAgain/other-options-sync.json'
      }
    });

    expect(uploadButton.disabled).toBe(true);
    expect(downloadButton.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', {name: 'Test & Save'}));

    await waitFor(() => expect(optionsClientMock.setWebDavSyncConfig).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(uploadButton.disabled).toBe(false));
  });

  it('does not save WebDAV interval changes before WebDAV sync is enabled', async () => {
    render(<ImportExport embedded options={optionsFixture()} />);

    fireEvent.click(screen.getByLabelText('WebDAV Sync'));
    fireEvent.click(screen.getByRole('button', {name: 'Enable WebDAV Sync'}));
    fireEvent.change(screen.getByLabelText('Server URL'), {
      target: {
        value: 'https://example.com/dav/'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Test & Save'}));

    await waitFor(() => expect(optionsClientMock.setWebDavSyncConfig).toHaveBeenCalledTimes(1));
    optionsClientMock.setWebDavSyncConfig.mockClear();

    fireEvent.change(screen.getByLabelText('Sync interval'), {
      target: {
        value: '15'
      }
    });

    expect(optionsClientMock.setWebDavSyncConfig).not.toHaveBeenCalled();
    expect((screen.getByRole('button', {name: 'Upload & Enable'}) as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables active WebDAV sync and reloads', async () => {
    mockActiveWebDavSync();
    optionsClientMock.setWebDavOptionsSync.mockResolvedValue(undefined);

    render(<ImportExport embedded options={optionsFixture()} />);

    expect(screen.getByText('WebDAV Sync is enabled.')).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('button', {name: 'Test & Save'}) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole('button', {name: 'Upload'})).toBeNull();
    expect(screen.queryByRole('button', {name: 'Download'})).toBeNull();
    expect(screen.queryByRole('button', {name: 'Sync'})).toBeNull();
    expect(screen.getByRole('button', {name: 'Upload Now'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Download Now'})).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'More...'})).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: 'Disable WebDAV Sync'}));

    await waitFor(() => expect(optionsClientMock.setWebDavOptionsSync).toHaveBeenCalledWith(false));
    await waitFor(() => expect(optionsClientMock.reloadLocation).toHaveBeenCalled());
  });

  it('tests and saves active WebDAV connection changes together', async () => {
    mockActiveWebDavSync();
    optionsClientMock.setWebDavSyncConfig.mockResolvedValue({
      intervalMinutes: 5,
      remotePath: 'SwitchyAgain/other-options-sync.json',
      serverUrl: 'https://example.com/dav/'
    });

    render(<ImportExport embedded options={optionsFixture()} />);

    expect(screen.queryByRole('button', {name: 'Save'})).toBeNull();
    const testAndSaveButton = await screen.findByRole('button', {name: 'Test & Save'});

    fireEvent.change(screen.getByLabelText('Remote path'), {
      target: {
        value: 'SwitchyAgain/other-options-sync.json'
      }
    });
    fireEvent.click(testAndSaveButton);

    await waitFor(() =>
      expect(optionsClientMock.testWebDavSync).toHaveBeenCalledWith(
        expect.objectContaining({remotePath: 'SwitchyAgain/other-options-sync.json'})
      )
    );
    await waitFor(() =>
      expect(optionsClientMock.setWebDavSyncConfig).toHaveBeenCalledWith(
        expect.objectContaining({remotePath: 'SwitchyAgain/other-options-sync.json'})
      )
    );
    expect(
      await screen.findByText('Connection successful. No remote sync file was found. Upload Now to apply WebDAV Sync to this location.')
    ).toBeTruthy();
  });

  it('guides active WebDAV target changes with an existing remote sync file', async () => {
    mockActiveWebDavSync();
    optionsClientMock.testWebDavSync.mockResolvedValue({exists: true, ok: true});
    optionsClientMock.setWebDavSyncConfig.mockResolvedValue({
      intervalMinutes: 5,
      remotePath: 'SwitchyAgain/other-options-sync.json',
      serverUrl: 'https://example.com/dav/'
    });

    render(<ImportExport embedded options={optionsFixture()} />);

    await screen.findByDisplayValue('https://example.com/dav/');
    fireEvent.change(screen.getByLabelText('Remote path'), {
      target: {
        value: 'SwitchyAgain/other-options-sync.json'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Test & Save'}));

    expect(
      await screen.findByText(
        'Connection successful. A remote sync file was found. Choose Upload Now or Download Now to apply WebDAV Sync to this location.'
      )
    ).toBeTruthy();
  });

  it('tests and saves active WebDAV credential changes without requiring upload or download', async () => {
    mockActiveWebDavSync();

    render(<ImportExport embedded options={optionsFixture()} />);

    await screen.findByDisplayValue('https://example.com/dav/');
    fireEvent.change(screen.getByLabelText('Username'), {
      target: {
        value: 'alice'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Test & Save'}));

    await waitFor(() => expect(optionsClientMock.testWebDavSync).toHaveBeenCalledWith(expect.objectContaining({username: 'alice'})));
    await waitFor(() => expect(optionsClientMock.setWebDavSyncConfig).toHaveBeenCalledWith(expect.objectContaining({username: 'alice'})));
    expect(await screen.findByText('Connection successful. WebDAV Sync settings saved.')).toBeTruthy();
  });

  it('saves active WebDAV interval changes without testing the connection', async () => {
    mockActiveWebDavSync();

    render(<ImportExport embedded options={optionsFixture()} />);

    await screen.findByRole('button', {name: 'Test & Save'});
    optionsClientMock.setWebDavSyncConfig.mockClear();

    fireEvent.change(screen.getByLabelText('Sync interval'), {
      target: {
        value: '15'
      }
    });

    await waitFor(() => expect(optionsClientMock.setWebDavSyncConfig).toHaveBeenCalledWith(expect.objectContaining({intervalMinutes: 15})));
    expect(optionsClientMock.testWebDavSync).not.toHaveBeenCalled();
    expect(await screen.findByText('WebDAV Sync settings saved.')).toBeTruthy();
  });

  it('disables active WebDAV remote actions while connection changes are unsaved', async () => {
    mockActiveWebDavSync();

    render(<ImportExport embedded options={optionsFixture()} />);

    await screen.findByDisplayValue('https://example.com/dav/');

    const uploadNowButton = screen.getByRole('button', {name: 'Upload Now'}) as HTMLButtonElement;
    const downloadNowButton = screen.getByRole('button', {name: 'Download Now'}) as HTMLButtonElement;

    expect(uploadNowButton.disabled).toBe(false);
    expect(downloadNowButton.disabled).toBe(false);

    fireEvent.change(screen.getByLabelText('Remote path'), {
      target: {
        value: 'SwitchyAgain/other-options-sync.json'
      }
    });

    expect(uploadNowButton.disabled).toBe(true);
    expect(downloadNowButton.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', {name: 'Test & Save'}));

    await waitFor(() => expect(optionsClientMock.setWebDavSyncConfig).toHaveBeenCalled());
    await waitFor(() => expect(uploadNowButton.disabled).toBe(false));
    expect(downloadNowButton.disabled).toBe(false);
  });

  it('runs active WebDAV upload now after modal confirmation', async () => {
    mockActiveWebDavSync();

    render(<ImportExport embedded options={optionsFixture()} />);

    fireEvent.click(screen.getByRole('button', {name: 'Upload Now'}));

    expect(optionsClientMock.runWebDavSyncAction).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Upload local options to WebDAV now? This will overwrite the remote sync config.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Upload Now'}));

    await waitFor(() => expect(optionsClientMock.runWebDavSyncAction).toHaveBeenCalledWith('uploadNow'));
    expect(optionsClientMock.confirmDialog).not.toHaveBeenCalled();
    expect(optionsClientMock.reloadLocation).not.toHaveBeenCalled();
    expect(await screen.findByText('Upload complete.')).toBeTruthy();
  });

  it('runs active WebDAV download now after modal confirmation and reloads', async () => {
    mockActiveWebDavSync();

    render(<ImportExport embedded options={optionsFixture()} />);

    fireEvent.click(screen.getByRole('button', {name: 'Download Now'}));

    expect(optionsClientMock.runWebDavSyncAction).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Download remote WebDAV options now? This will overwrite your local options.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Download Now'}));

    await waitFor(() => expect(optionsClientMock.runWebDavSyncAction).toHaveBeenCalledWith('downloadNow'));
    expect(optionsClientMock.confirmDialog).not.toHaveBeenCalled();
    await waitFor(() => expect(optionsClientMock.reloadLocation).toHaveBeenCalled());
  });

  it('shows active WebDAV sync success status with the last synced time', async () => {
    mockActiveWebDavSync({
      lastSuccessAt: '2026-01-02T03:04:05Z',
      state: 'success'
    });

    render(<ImportExport embedded options={optionsFixture()} />);

    const alertText = await screen.findByText(/WebDAV Sync is enabled\. Last synced:/);
    const alert = alertText.closest('.alert');

    expect(alert?.classList.contains('alert-success')).toBe(true);
    expect(alert?.textContent).toContain('2026');
  });

  it('shows active WebDAV sync retry status with the last attempt time', async () => {
    mockActiveWebDavSync({
      failureCount: 2,
      lastAttemptAt: '2026-01-02T03:04:05Z',
      state: 'retrying'
    });

    render(<ImportExport embedded options={optionsFixture()} />);

    const alertText = await screen.findByText(/WebDAV sync is retrying\. Last attempt:/);
    const alert = alertText.closest('.alert');

    expect(alert?.classList.contains('alert-info')).toBe(true);
    expect(alert?.textContent).toContain('2026');
  });

  it('shows active WebDAV sync waiting-for-direction status', async () => {
    mockActiveWebDavSync({
      needsDirection: true,
      state: 'success'
    });

    render(<ImportExport embedded options={optionsFixture()} />);

    const alertText = await screen.findByText(
      'WebDAV Sync is waiting. Choose Upload Now or Download Now to apply the saved WebDAV location.'
    );
    const alert = alertText.closest('.alert');

    expect(alert?.classList.contains('alert-info')).toBe(true);
  });

  it('shows active WebDAV sync failure status with the error message', async () => {
    mockActiveWebDavSync({
      failureCount: 3,
      lastErrorAt: '2026-01-02T03:04:05Z',
      message: 'Service unavailable (503)',
      state: 'error'
    });

    render(<ImportExport embedded options={optionsFixture()} />);

    const alertText = await screen.findByText(/WebDAV sync failed\. Last failed:/);
    const alert = alertText.closest('.alert');

    expect(alert?.classList.contains('alert-danger')).toBe(true);
    expect(alert?.textContent).toContain('Service unavailable (503)');
  });

  it('shows active WebDAV sync failure retry time and pending upload state', async () => {
    mockActiveWebDavSync({
      failureCount: 4,
      lastErrorAt: '2026-01-02T03:04:05Z',
      nextRetryAt: '2026-01-02T09:04:05Z',
      pendingUpload: true,
      state: 'error'
    });

    render(<ImportExport embedded options={optionsFixture()} />);

    const alertText = await screen.findByText(/WebDAV sync failed\. Last failed:/);
    const alert = alertText.closest('.alert');

    expect(alert?.classList.contains('alert-danger')).toBe(true);
    expect(alert?.textContent).toContain('Next automatic retry:');
    expect(alert?.textContent).toContain('Local changes are waiting to sync.');
  });

  it('resets conflicted synced options and reloads after confirming current options', async () => {
    const onApplyOptions = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    optionsClientMock.getLocalState.mockImplementation((key: string) => (key === 'syncOptions' ? 'conflict' : ''));
    optionsClientMock.resetOptionsSync.mockResolvedValue(undefined);

    render(<ImportExport embedded onApplyOptions={onApplyOptions} options={optionsFixture()} optionsDirty />);

    fireEvent.click(screen.getByRole('button', {name: 'Clear remote copy'}));

    await waitFor(() => expect(optionsClientMock.resetOptionsSync).toHaveBeenCalled());
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Your changes to the options must be applied before you proceed.'));
    expect(onApplyOptions).toHaveBeenCalled();
    expect(onApplyOptions.mock.invocationCallOrder[0]).toBeLessThan(optionsClientMock.resetOptionsSync.mock.invocationCallOrder[0]);
    await waitFor(() => expect(optionsClientMock.reloadLocation).toHaveBeenCalled());
  });

  it('shows settings and sync without a profile export section', () => {
    render(<ImportExport embedded options={optionsFixture()} />);

    expect(screen.getByRole('heading', {name: 'Backup'})).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'Sync'})).toBeTruthy();
    expect(screen.queryByRole('heading', {name: 'Profile'})).toBeNull();
  });
});
