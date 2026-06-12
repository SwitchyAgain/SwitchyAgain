// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {GeneralSettings} from '../src/react/general_settings';
import type {Options} from '../src/react/options_client';

function installChromeMock() {
  (globalThis as any).chrome = {
    i18n: {
      getMessage: () => '',
      getUILanguage: () => 'en'
    }
  };
}

function optionsFixture(): Options {
  return {
    '-downloadInterval': 60,
    '-monitorWebRequests': false,
    '-showExternalProfile': false
  };
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  installChromeMock();
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
});
