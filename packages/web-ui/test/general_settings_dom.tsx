// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {GeneralSettings} from '../src/react/general_settings';
import type {Options} from '../src/react/options_client_types';

function optionsFixture(): Options {
  return {
    '-downloadInterval': 60,
    '-showExternalProfile': false,
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile'
    }
  };
}

function installBackground(sendMessage: (request: any, callback: (response?: unknown) => void) => void) {
  (globalThis as any).chrome = {
    i18n: {
      getMessage: () => '',
      getUILanguage: () => 'en'
    },
    runtime: {
      getManifest: () => ({manifest_version: 3}),
      getURL: (path: string) => path,
      sendMessage
    }
  };
}

afterEach(() => {
  cleanup();
});

describe('general settings component', () => {
  it('edits embedded general options without background calls', () => {
    const onOptionsChange = vi.fn();

    render(<GeneralSettings embedded onOptionsChange={onOptionsChange} options={optionsFixture()} />);

    expect(screen.getByRole('heading', {name: 'General'})).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Download Interval'), {
      target: {
        value: '180'
      }
    });
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-downloadInterval': 180
      })
    );

    fireEvent.click(screen.getByLabelText('Show popup menu item to import proxy settings from other apps.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-showExternalProfile': true
      })
    );
  });

  it('applies the selected active profile from general settings', async () => {
    const options = optionsFixture();
    options['-showCurrentProfileInGeneral'] = true;
    let currentProfileName = 'direct';
    const sendMessage = vi.fn((request, callback) => {
      if (request.method === 'getState') {
        callback({
          result: {
            currentProfileName,
            isSystemProfile: currentProfileName === 'system'
          }
        });
        return;
      }
      if (request.method === 'getAll') {
        callback({result: options});
        return;
      }
      if (request.method === 'applyProfile') {
        currentProfileName = request.args[0];
        callback({result: null});
      }
    });
    installBackground(sendMessage);

    render(<GeneralSettings embedded options={options} />);

    expect(screen.getByRole('heading', {name: 'Current Profile'})).toBeTruthy();

    fireEvent.click(screen.getByRole('listbox', {name: 'Active Profile'}));
    fireEvent.click(screen.getByText('proxy'));

    await waitFor(() => expect(screen.getByText('Applied.')).toBeTruthy());
    expect(sendMessage).toHaveBeenCalledWith(
      {
        args: [['currentProfileName', 'isSystemProfile']],
        method: 'getState'
      },
      expect.any(Function)
    );
    expect(sendMessage).toHaveBeenCalledWith(
      {
        args: ['proxy'],
        method: 'applyProfile',
        refreshActivePage: true
      },
      expect.any(Function)
    );
    expect(sendMessage.mock.calls.map(([request]) => request.method)).not.toContain('getAll');
  });

  it('hides current profile controls unless enabled', () => {
    render(<GeneralSettings embedded options={optionsFixture()} />);

    expect(screen.queryByRole('heading', {name: 'Current Profile'})).toBeNull();
    expect(screen.queryByRole('listbox', {name: 'Active Profile'})).toBeNull();
  });

  it('loads standalone options and saves general option patches', async () => {
    const loadedOptions = {
      ...optionsFixture(),
      '-showCurrentProfileInGeneral': true
    };
    const savedOptions = {
      ...loadedOptions,
      '-downloadInterval': 180
    };
    const requests: any[] = [];
    const sendMessage = vi.fn((request, callback) => {
      requests.push(request);
      if (request.method === 'getAll') {
        callback({result: loadedOptions});
        return;
      }
      if (request.method === 'getState') {
        callback({
          result: {
            currentProfileName: 'direct',
            isSystemProfile: false
          }
        });
        return;
      }
      if (request.method === 'patch') {
        callback({result: savedOptions});
      }
    });
    installBackground(sendMessage);

    render(<GeneralSettings />);

    await screen.findByRole('heading', {name: 'General'});
    await waitFor(() =>
      expect(requests).toContainEqual({
        args: [['currentProfileName', 'isSystemProfile']],
        method: 'getState'
      })
    );

    fireEvent.change(screen.getByLabelText('Download Interval'), {
      target: {
        value: '180'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: /Apply changes/}));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Options saved.'));
    expect(requests).toContainEqual({
      args: [
        {
          '-downloadInterval': [60, 180]
        }
      ],
      method: 'patch'
    });
  });

  it('shows standalone load errors without crashing state fallback', async () => {
    const sendMessage = vi.fn((request, callback) => {
      if (request.method === 'getAll') {
        callback({
          error: {
            _error: 'error',
            message: 'Options unavailable',
            name: 'OptionsError'
          }
        });
        return;
      }
      if (request.method === 'getState') {
        callback({result: {}});
      }
    });
    installBackground(sendMessage);

    render(<GeneralSettings />);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Options unavailable'));
  });
});
