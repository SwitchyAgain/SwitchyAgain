// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {ImportExport} from '../src/react/import_export';
import {RESTORE_URL_STATE} from '../src/react/import_export_logic';
import type {Options} from '../src/react/options_client_types';

const optionsClientMock = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  getLocalState: vi.fn(),
  loadOptions: vi.fn(),
  message: vi.fn((_key: string, fallback = '') => fallback),
  patchOptions: vi.fn(),
  reloadLocation: vi.fn(),
  resetOptions: vi.fn(),
  resetOptionsSync: vi.fn(),
  setLocalState: vi.fn(),
  setOptionsSync: vi.fn(),
  shouldAutoMount: vi.fn(() => false)
}));

vi.mock('../src/react/navigation_client', () => ({
  downloadBlob: optionsClientMock.downloadBlob,
  shouldAutoMount: optionsClientMock.shouldAutoMount
}));

vi.mock('../src/react/browser_env', () => ({
  reloadLocation: optionsClientMock.reloadLocation
}));

vi.mock('../src/react/state_client', () => ({
  getLocalState: optionsClientMock.getLocalState,
  setLocalState: optionsClientMock.setLocalState
}));

vi.mock('../src/react/options_api_client', () => ({
  loadOptions: optionsClientMock.loadOptions,
  patchOptions: optionsClientMock.patchOptions,
  resetOptions: optionsClientMock.resetOptions,
  resetOptionsSync: optionsClientMock.resetOptionsSync,
  setOptionsSync: optionsClientMock.setOptionsSync
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  optionsClientMock.downloadBlob.mockReset();
  optionsClientMock.getLocalState.mockReset();
  optionsClientMock.loadOptions.mockReset();
  optionsClientMock.message.mockClear();
  optionsClientMock.patchOptions.mockReset();
  optionsClientMock.reloadLocation.mockReset();
  optionsClientMock.resetOptions.mockReset();
  optionsClientMock.resetOptionsSync.mockReset();
  optionsClientMock.setLocalState.mockReset();
  optionsClientMock.setOptionsSync.mockReset();
  optionsClientMock.shouldAutoMount.mockClear();
  optionsClientMock.getLocalState.mockImplementation((key: string) => (key === 'syncOptions' ? 'disabled' : ''));
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

    fireEvent.click(screen.getByRole('button', {name: 'Enable sync'}));

    await waitFor(() => expect(optionsClientMock.setOptionsSync).toHaveBeenCalledWith(true, undefined));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Your changes to the options must be applied before you proceed.'));
    expect(onApplyOptions).toHaveBeenCalled();
    expect(onApplyOptions.mock.invocationCallOrder[0]).toBeLessThan(optionsClientMock.setOptionsSync.mock.invocationCallOrder[0]);
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
});
