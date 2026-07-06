// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {ImportExport} from '../src/react/import_export';
import {RESTORE_URL_STATE} from '../src/react/import_export_logic';
import type {Options} from '../src/react/options_client_types';

const optionsClientMock = vi.hoisted(() => ({
  clearWindowTimeout: vi.fn((timeout: ReturnType<typeof globalThis.setTimeout> | undefined) => {
    if (timeout != null) {
      clearTimeout(timeout);
    }
  }),
  confirmDialog: vi.fn((messageText: string) => window.confirm(messageText)),
  downloadBlob: vi.fn(),
  getLocalState: vi.fn(),
  getState: vi.fn(),
  getWebDavSyncConfig: vi.fn(),
  loadOptions: vi.fn(),
  message: vi.fn((_key: string, fallback = '') => fallback),
  patchOptions: vi.fn(),
  reloadLocation: vi.fn(),
  resetOptions: vi.fn(),
  resetOptionsSync: vi.fn(),
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
    },
    '-exportLegacyRuleList': false
  };
}

async function downloadedOptions() {
  return JSON.parse(await (optionsClientMock.downloadBlob.mock.calls[0][0] as Blob).text()) as Options;
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
  optionsClientMock.setWebDavSyncConfig.mockResolvedValue({});
  optionsClientMock.testWebDavSync.mockResolvedValue({exists: false, ok: true});
});

describe('import export component', () => {
  it('confirms dirty options before exporting a backup', async () => {
    const onApplyOptions = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ImportExport embedded onApplyOptions={onApplyOptions} options={optionsFixture()} optionsDirty />);

    fireEvent.click(screen.getByRole('button', {name: /Make backup/}));

    await waitFor(() => {
      expect(optionsClientMock.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'OmegaOptions.bak');
    });
    expect(window.confirm).toHaveBeenCalled();
    expect(onApplyOptions).toHaveBeenCalled();
    expect(await (optionsClientMock.downloadBlob.mock.calls[0][0] as Blob).text()).toBe(JSON.stringify(optionsFixture()));
  });

  it('exports full backups from applied dirty options', async () => {
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

    await waitFor(() => expect(optionsClientMock.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'OmegaOptions.bak'));
    expect(await downloadedOptions()).toEqual(appliedOptions);
  });

  it('restores options from an online backup URL', async () => {
    const restoredOptions = {
      ...optionsFixture(),
      '-exportLegacyRuleList': true
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

  it('opens WebDAV settings only after choosing WebDAV sync', async () => {
    render(<ImportExport embedded options={optionsFixture()} />);

    expect(screen.queryByLabelText('Server URL')).toBeNull();

    const webDavProvider = screen.getByLabelText('WebDAV Sync').closest('.sync-provider') as HTMLElement;
    const enableWebDavSync = within(webDavProvider).getByRole('button', {name: 'Enable WebDAV Sync'}) as HTMLButtonElement;
    expect(enableWebDavSync.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('WebDAV Sync'));
    expect(enableWebDavSync.disabled).toBe(false);

    fireEvent.click(enableWebDavSync);

    expect(screen.getByLabelText('Server URL')).toBeTruthy();
  });

  it('requires a successful WebDAV test before enabling upload', async () => {
    render(<ImportExport embedded options={optionsFixture()} />);

    fireEvent.click(screen.getByLabelText('WebDAV Sync'));
    fireEvent.click(screen.getByRole('button', {name: 'Enable WebDAV Sync'}));
    fireEvent.change(screen.getByLabelText('Server URL'), {
      target: {
        value: 'https://example.com/dav/'
      }
    });

    const testButton = screen.getByRole('button', {name: 'Test'}) as HTMLButtonElement;
    const uploadButton = screen.getByRole('button', {name: 'Upload'}) as HTMLButtonElement;
    const downloadButton = screen.getByRole('button', {name: 'Download'}) as HTMLButtonElement;

    expect(testButton.disabled).toBe(false);
    expect(uploadButton.disabled).toBe(true);
    expect(downloadButton.disabled).toBe(true);

    fireEvent.click(testButton);

    await waitFor(() => expect(optionsClientMock.testWebDavSync).toHaveBeenCalled());
    await waitFor(() => expect(uploadButton.disabled).toBe(false));
    expect(downloadButton.disabled).toBe(true);
  });

  it('enables WebDAV download after testing an existing remote sync file', async () => {
    optionsClientMock.testWebDavSync.mockResolvedValue({exists: true, ok: true});

    render(<ImportExport embedded options={optionsFixture()} />);

    fireEvent.click(screen.getByLabelText('WebDAV Sync'));
    fireEvent.click(screen.getByRole('button', {name: 'Enable WebDAV Sync'}));
    fireEvent.change(screen.getByLabelText('Server URL'), {
      target: {
        value: 'https://example.com/dav/'
      }
    });

    fireEvent.click(screen.getByRole('button', {name: 'Test'}));

    const uploadButton = screen.getByRole('button', {name: 'Upload'}) as HTMLButtonElement;
    const downloadButton = screen.getByRole('button', {name: 'Download'}) as HTMLButtonElement;

    await waitFor(() => expect(uploadButton.disabled).toBe(false));
    expect(downloadButton.disabled).toBe(false);
  });

  it('disables active WebDAV sync and reloads', async () => {
    optionsClientMock.getLocalState.mockImplementation((key: string) => {
      if (key === 'syncOptions') {
        return 'sync';
      }
      if (key === 'syncProvider') {
        return 'webdav';
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
      return Promise.resolve('');
    });
    optionsClientMock.setWebDavOptionsSync.mockResolvedValue(undefined);
    optionsClientMock.getWebDavSyncConfig.mockResolvedValue({
      intervalMinutes: 5,
      remotePath: 'SwitchyAgain/options-sync.json',
      serverUrl: 'https://example.com/dav/'
    });

    render(<ImportExport embedded options={optionsFixture()} />);

    expect(screen.getByText('WebDAV sync is enabled.')).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('button', {name: 'Test'}) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole('button', {name: 'Upload'})).toBeNull();
    expect(screen.queryByRole('button', {name: 'Download'})).toBeNull();
    expect(screen.queryByRole('button', {name: 'Sync'})).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: 'Disable WebDAV Sync'}));

    await waitFor(() => expect(optionsClientMock.setWebDavOptionsSync).toHaveBeenCalledWith(false));
    await waitFor(() => expect(optionsClientMock.reloadLocation).toHaveBeenCalled());
  });

  it('resets conflicted synced options and reloads after confirming current options', async () => {
    const onApplyOptions = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    optionsClientMock.getLocalState.mockImplementation((key: string) => (key === 'syncOptions' ? 'conflict' : ''));
    optionsClientMock.resetOptionsSync.mockResolvedValue(undefined);

    render(<ImportExport embedded onApplyOptions={onApplyOptions} options={optionsFixture()} optionsDirty />);

    fireEvent.click(screen.getByRole('button', {name: 'Reset sync'}));

    await waitFor(() => expect(optionsClientMock.resetOptionsSync).toHaveBeenCalled());
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Your changes to the options must be applied before you proceed.'));
    expect(onApplyOptions).toHaveBeenCalled();
    expect(onApplyOptions.mock.invocationCallOrder[0]).toBeLessThan(optionsClientMock.resetOptionsSync.mock.invocationCallOrder[0]);
    await waitFor(() => expect(optionsClientMock.reloadLocation).toHaveBeenCalled());
  });

  it('saves legacy rule list export preference through an options patch', async () => {
    const updatedOptions = {
      ...optionsFixture(),
      '-exportLegacyRuleList': true
    };
    const onOptionsReplace = vi.fn();
    optionsClientMock.patchOptions.mockResolvedValue(updatedOptions);

    render(<ImportExport embedded onOptionsReplace={onOptionsReplace} options={optionsFixture()} />);

    fireEvent.click(screen.getByLabelText('Export legacy rule lists'));

    await waitFor(() =>
      expect(optionsClientMock.patchOptions).toHaveBeenCalledWith({
        '-exportLegacyRuleList': [false, true]
      })
    );
    await waitFor(() => {
      expect(onOptionsReplace).toHaveBeenCalledWith(updatedOptions, {dirty: false});
    });
  });

  it('saves legacy rule list export preference from applied dirty options', async () => {
    const currentOptions = {
      ...optionsFixture(),
      '-exportLegacyRuleList': true
    };
    const patchedOptions = {
      ...currentOptions,
      '-exportLegacyRuleList': false
    };
    const onApplyOptions = vi.fn().mockResolvedValue(currentOptions);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    optionsClientMock.patchOptions.mockResolvedValue(patchedOptions);

    render(<ImportExport embedded onApplyOptions={onApplyOptions} options={currentOptions} optionsDirty />);

    fireEvent.click(screen.getByLabelText('Export legacy rule lists'));

    await waitFor(() =>
      expect(optionsClientMock.patchOptions).toHaveBeenCalledWith({
        '-exportLegacyRuleList': [true, false]
      })
    );
    expect(onApplyOptions).toHaveBeenCalled();
  });
});
