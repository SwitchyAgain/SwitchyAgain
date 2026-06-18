// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {GeneralSettings} from '../src/react/general_settings';
import type {Options} from '../src/react/options_client_types';

function optionsFixture(): Options {
  return {
    '-downloadInterval': 60,
    '-monitorWebRequests': false,
    '-showExternalProfile': false,
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile'
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

    fireEvent.click(screen.getByLabelText('Show count of failed web requests for resources in the current tab.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-monitorWebRequests': true
      })
    );

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
    (globalThis as any).chrome = {
      i18n: {
        getMessage: () => '',
        getUILanguage: () => 'en'
      },
      runtime: {
        getManifest: () => ({manifest_version: 3}),
        sendMessage
      }
    };

    render(<GeneralSettings embedded options={options} />);

    expect(screen.getByRole('heading', {name: 'Current Profile'})).toBeTruthy();

    fireEvent.click(screen.getByRole('listbox', {name: 'Active Profile'}));
    fireEvent.click(screen.getByText('proxy'));

    await waitFor(() => expect(screen.getByText('Applied.')).toBeTruthy());
    expect(sendMessage).toHaveBeenCalledWith(
      {
        args: ['proxy'],
        method: 'applyProfile',
        refreshActivePage: true
      },
      expect.any(Function)
    );
  });

  it('hides current profile controls unless enabled', () => {
    render(<GeneralSettings embedded options={optionsFixture()} />);

    expect(screen.queryByRole('heading', {name: 'Current Profile'})).toBeNull();
    expect(screen.queryByRole('listbox', {name: 'Active Profile'})).toBeNull();
  });
});
