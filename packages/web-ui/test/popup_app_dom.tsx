// @vitest-environment jsdom

import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import type {PageInfo, PopupState} from '../src/react/popup_bridge';

const popupBridgeMock = vi.hoisted(() => ({
  addPopupCondition: vi.fn(),
  addPopupProfile: vi.fn(),
  addPopupTempRule: vi.fn(),
  applyPopupProfile: vi.fn(),
  closePopup: vi.fn(),
  getPopupPageInfo: vi.fn(),
  getPopupState: vi.fn(),
  openPopupOptions: vi.fn(),
  patchPopupOptions: vi.fn(),
  setPopupDefaultProfile: vi.fn(),
  setPopupProfileScope: vi.fn(),
  setPopupState: vi.fn()
}));

vi.mock('../src/react/popup_bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/react/popup_bridge')>()),
  ...popupBridgeMock
}));

import {PopupApp} from '../src/react/popup_app';

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
    failedRequestDetectionEnabled: true,
    networkRequestIgnoreList: [],
    routeInfoEnabled: true,
    routeInfoRequestDetailsEnabled: true,
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
    failedRequestDetectionEnabled: true,
    networkRequestIgnoreListEnabled: true,
    networkRequestIgnoreList: ['*.tracker.example'],
    routeInfoEnabled: true,
    routeInfoRequestDetailsEnabled: true,
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

describe('popup app', () => {
  beforeEach(() => {
    for (const mock of Object.values(popupBridgeMock)) {
      mock.mockReset();
      mock.mockResolvedValue(undefined);
    }
    window.location.hash = '#!routeInfo';
    document.body.style.opacity = '';
    currentPageInfo = failedPageInfo();
    popupBridgeMock.getPopupPageInfo.mockImplementation(() => Promise.resolve(currentPageInfo));
    popupBridgeMock.getPopupState.mockResolvedValue(popupState());
    popupBridgeMock.patchPopupOptions.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
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
    popupBridgeMock.getPopupState.mockResolvedValue(nonSwitchPopupState());

    render(<PopupApp />);

    const configureButton = await screen.findByRole('button', {name: 'Configure network requests'});
    expect(screen.queryByLabelText('Add to')).toBeNull();
    expect(screen.queryByText('Ignore list')).toBeNull();

    fireEvent.click(configureButton);
    expect(popupBridgeMock.openPopupOptions).toHaveBeenCalledWith('#/requestLens');
  });

  it('shows a request details notice while keeping failed request actions available', async () => {
    currentPageInfo = {
      ...failedPageInfo(),
      requestExplanations: undefined,
      requestLimitExceeded: undefined,
      requests: undefined,
      routeInfoRequestDetailsEnabled: false
    };

    render(<PopupApp />);

    expect(await screen.findByText('Request details are disabled.')).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'Failed Requests'})).toBeTruthy();
    expect(screen.getByRole('checkbox', {name: /api\.example\.com/})).toBeTruthy();
  });

  it('links to Request Lens when failed request detection is disabled', async () => {
    currentPageInfo = {
      ...failedPageInfo(),
      errorCount: 0,
      failedRequestDetectionEnabled: false,
      requestExplanations: undefined,
      requestLimitExceeded: undefined,
      requests: undefined,
      routeInfoRequestDetailsEnabled: false,
      summary: {}
    };
    render(<PopupApp />);

    expect(await screen.findByText('Request details are disabled.')).toBeTruthy();
    const configureButton = screen.getByRole('button', {name: 'Configure network requests'});

    fireEvent.click(configureButton);
    expect(popupBridgeMock.openPopupOptions).toHaveBeenCalledWith('#/requestLens');
  });

  it('links to Request Lens when no failed requests are available', async () => {
    currentPageInfo = {
      ...failedPageInfo(),
      errorCount: 0,
      requestExplanations: undefined,
      requestLimitExceeded: undefined,
      requests: undefined,
      routeInfoRequestDetailsEnabled: false,
      summary: {}
    };
    render(<PopupApp />);

    expect(await screen.findByText('Request details are disabled.')).toBeTruthy();
    const configureButton = screen.getByRole('button', {name: 'Configure network requests'});

    fireEvent.click(configureButton);
    expect(popupBridgeMock.openPopupOptions).toHaveBeenCalledWith('#/requestLens');
  });

  it('hides route info without hiding other page-domain popup actions', async () => {
    currentPageInfo = {
      ...failedPageInfo(),
      errorCount: 0,
      failedRequestDetectionEnabled: false,
      requests: undefined,
      routeInfoEnabled: false,
      routeInfoRequestDetailsEnabled: false,
      summary: {}
    };

    render(<PopupApp />);

    expect(await screen.findByText('Add Condition')).toBeTruthy();
    expect(screen.getByText('example.com')).toBeTruthy();
    expect(screen.queryByText('Route Info')).toBeNull();
  });

  it('shows only the window profile scope menu for Chromium state', async () => {
    window.location.hash = '';
    currentPageInfo = {
      profileScope: {
        enabled: {
          container: false,
          group: false,
          site: false,
          tab: false,
          window: true
        },
        incognito: false,
        tabId: 1,
        windowId: 1
      },
      url: 'https://www.example.com/'
    };
    popupBridgeMock.getPopupState.mockResolvedValue({
      ...popupState(),
      currentProfileCanAddRule: false,
      scopeAssignableProfiles: ['direct']
    });

    const {container} = render(<PopupApp />);

    await waitFor(() => expect(container.querySelector('[data-profile-scope="normal"]')).toBeTruthy());
    for (const scope of ['tab', 'group', 'page', 'site', 'container']) {
      expect(container.querySelector(`[data-profile-scope="${scope}"]`)).toBeNull();
    }
  });

  it('shows all enabled profile scope menus for Firefox state', async () => {
    window.location.hash = '';
    currentPageInfo = {
      profileScope: {
        cookieStoreId: 'firefox-container-1',
        enabled: {
          container: true,
          group: true,
          site: true,
          tab: true,
          window: true
        },
        groupId: 2,
        incognito: false,
        isContainer: true,
        tabId: 1,
        windowId: 1
      },
      url: 'https://www.example.com/'
    };
    popupBridgeMock.getPopupState.mockResolvedValue({
      ...popupState(),
      currentProfileCanAddRule: false,
      scopeAssignableProfiles: ['direct']
    });

    const {container} = render(<PopupApp />);

    await waitFor(() => expect(container.querySelector('[data-profile-scope="tab"]')).toBeTruthy());
    for (const scope of ['group', 'page', 'site', 'container', 'normal']) {
      expect(container.querySelector(`[data-profile-scope="${scope}"]`)).toBeTruthy();
    }
  });

  it('keeps profile groups in scope menus while the global profile is system', async () => {
    window.location.hash = '';
    currentPageInfo = {
      profileScope: {
        enabled: {tab: true},
        tabId: 1
      }
    };
    popupBridgeMock.getPopupState.mockResolvedValue({
      ...popupState(),
      availableProfiles: {
        ...popupState().availableProfiles,
        '+grouped': {
          name: 'grouped',
          profileGroupEnabled: true,
          profileGroupId: 'work',
          profileType: 'FixedProfile'
        },
        '+plain': {
          name: 'plain',
          profileType: 'FixedProfile'
        }
      },
      currentProfileCanAddRule: false,
      currentProfileName: 'system',
      isSystemProfile: true,
      profileGroups: [{id: 'work', name: 'Work'}],
      profileGroupsEnabled: true,
      scopeAssignableProfiles: ['plain', 'grouped'],
      validResultProfiles: []
    });

    const {container} = render(<PopupApp />);
    await screen.findByText('This Tab');
    const scopeMenu = container.querySelector<HTMLElement>('[data-profile-scope="tab"]');

    expect(scopeMenu).toBeTruthy();
    fireEvent.click(within(scopeMenu!).getByRole('button', {name: 'This Tab'}));
    expect(within(scopeMenu!).getByText('plain')).toBeTruthy();
    expect(within(scopeMenu!).queryByText('grouped')).toBeNull();

    fireEvent.click(within(scopeMenu!).getByRole('button', {name: 'Work'}));
    expect(within(scopeMenu!).getByText('grouped')).toBeTruthy();
  });
});
