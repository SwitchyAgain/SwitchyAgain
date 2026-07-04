// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {PopupApp} from '../src/react/popup_app';
import type {PageInfo, PopupBridgeClient, PopupState} from '../src/react/popup_bridge_client';

type TestGlobal = typeof globalThis & {
  PopupBridge?: PopupBridgeClient;
};

function testGlobal() {
  return globalThis as TestGlobal;
}

function popupState(): PopupState {
  return {
    availableProfiles: {
      '+direct': {
        builtin: true,
        name: 'direct',
        profileType: 'DirectProfile'
      }
    },
    currentProfileCanAddRule: true,
    currentProfileName: 'direct',
    validResultProfiles: ['direct']
  };
}

function nonSwitchPopupState(): PopupState {
  return {
    ...popupState(),
    currentProfileCanAddRule: false
  };
}

function failedPageInfo(): PageInfo {
  return {
    domain: 'example.com',
    errorCount: 1,
    networkRequestIgnoreList: [],
    requests: [
      {
        error: 'net::ERR_FAILED',
        id: '1',
        status: 'error',
        type: 'xmlhttprequest',
        url: 'https://api.example.com/resource'
      }
    ],
    summary: {
      'api.example.com': {
        errorCount: 1
      }
    },
    url: 'https://example.com'
  };
}

function ignoredOnlyPageInfo(): PageInfo {
  return {
    domain: 'example.com',
    errorCount: 0,
    networkRequestIgnoreListEnabled: true,
    networkRequestIgnoreList: ['*.tracker.example'],
    requests: [
      {
        id: '1',
        ignored: true,
        ignoreMatches: ['*.tracker.example'],
        status: 'ok',
        type: 'xmlhttprequest',
        url: 'https://cdn.tracker.example/pixel.gif'
      }
    ],
    summary: {},
    url: 'https://example.com'
  };
}

let currentPageInfo: PageInfo;

function getActivePageInfo(callback: (error?: unknown, result?: PageInfo) => void): void;
function getActivePageInfo(_options: unknown, callback: (error?: unknown, result?: PageInfo) => void): void;
function getActivePageInfo(callbackOrOptions: unknown, callback?: (error?: unknown, result?: PageInfo) => void) {
  const cb = typeof callbackOrOptions === 'function' ? callbackOrOptions : callback;
  cb?.(undefined, currentPageInfo);
}

describe('popup app', () => {
  beforeEach(() => {
    window.location.hash = '#!routeInfo';
    document.body.style.opacity = '';
    currentPageInfo = failedPageInfo();
    testGlobal().PopupBridge = {
      getActivePageInfo,
      getMessage() {
        return '';
      },
      getState(_keys, callback) {
        callback(undefined, popupState());
      },
      patchOptions(_patch, callback) {
        callback?.(undefined, {});
      }
    };
  });

  afterEach(() => {
    cleanup();
    delete testGlobal().PopupBridge;
  });

  it('allows unchecked failed request domains without closing the popup', async () => {
    render(<PopupApp />);

    const checkbox = (await screen.findByRole('checkbox', {name: /api\.example\.com/})) as HTMLInputElement;
    await waitFor(() => expect(checkbox.checked).toBe(true));

    fireEvent.click(checkbox);

    expect(checkbox.checked).toBe(false);
    expect(document.body.style.opacity).toBe('');
  });

  it('keeps ignored-only actions in one control row', async () => {
    currentPageInfo = ignoredOnlyPageInfo();

    const {container} = render(<PopupApp />);

    await screen.findByText('*.tracker.example');
    const cancelButtons = await screen.findAllByRole('button', {name: 'Cancel'});
    const removeButton = screen.getByRole('button', {name: 'Remove from Ignore List'});
    const controls = removeButton.closest('.condition-controls');

    expect(cancelButtons).toHaveLength(1);
    expect(controls).toBeTruthy();
    expect(controls?.contains(cancelButtons[0])).toBe(true);
    expect(container.querySelector('.sa-popup-route-info-section-warning')).toBeNull();
  });

  it('shows network request configuration when ignore list is disabled and rules cannot be added', async () => {
    const openOptions = vi.fn();
    testGlobal().PopupBridge = {
      ...testGlobal().PopupBridge,
      getState(_keys, callback) {
        callback(undefined, nonSwitchPopupState());
      },
      openOptions
    };

    render(<PopupApp />);

    const configureButton = await screen.findByRole('button', {name: 'Configure network requests'});
    expect(screen.queryByLabelText('Add to')).toBeNull();
    expect(screen.queryByText('Ignore list')).toBeNull();

    fireEvent.click(configureButton);
    expect(openOptions).toHaveBeenCalledWith('#/requestLens', expect.any(Function));
  });
});
