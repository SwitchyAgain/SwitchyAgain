// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {UiSettings} from '../src/react/ui_settings';
import type {Options} from '../src/react/options_client_types';

function optionsFixture(): Options {
  return {
    '+pac': {
      name: 'pac',
      profileType: 'PacProfile'
    },
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile'
    },
    '-addConditionsToBottom': false,
    '-confirmDeletion': true,
    '-enableQuickSwitch': true,
    '-quickSwitchProfiles': ['direct', 'proxy'],
    '-refreshOnProfileChange': false,
    '-showConditionTypes': 0,
    '-startupProfileName': '',
    '-uiLocale': 'en',
    '-uiTheme': 'light'
  };
}

function createDataTransfer() {
  let data = '';
  return {
    getData: vi.fn(() => data),
    setData: vi.fn((_type: string, value: string) => {
      data = value;
    })
  } as unknown as DataTransfer;
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
  document.documentElement.classList.remove('theme-dark', 'theme-light');
  delete document.documentElement.dataset.effectiveTheme;
  delete document.documentElement.dataset.uiTheme;
});

describe('ui settings component', () => {
  it('edits embedded UI options and opens shortcut settings', () => {
    const onOpenShortcutConfig = vi.fn();
    const onOptionsChange = vi.fn();

    const {container} = render(
      <UiSettings embedded onOpenShortcutConfig={onOpenShortcutConfig} onOptionsChange={onOptionsChange} options={optionsFixture()} />
    );

    fireEvent.click(screen.getByRole('button', {name: /Configure shortcut/}));
    expect(onOpenShortcutConfig).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Confirm before deleting profiles and rules.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-confirmDeletion': false
      })
    );

    fireEvent.click(
      screen.getByLabelText(
        'Show Profile Options on profile pages for hiding profiles from the popup menu, context menu, and options sidebar.'
      )
    );
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-showProfileOptions': true
      })
    );

    expect((screen.getByLabelText('Keep Settings expanded in the sidebar.') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('Keep Settings expanded in the sidebar.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-keepSettingsExpanded': false
      })
    );

    fireEvent.click(screen.getByLabelText('Show Current Profile on the General settings page.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-showCurrentProfileInGeneral': true
      })
    );

    fireEvent.click(screen.getByLabelText('Show Route Lens in the settings sidebar.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-showRouteLens': false
      })
    );

    expect((screen.getByLabelText('Show profile color in sidebar profile action menus.') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Show profile color in profile browser action menus.') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Show export actions in sidebar profile action menus.') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Show export actions in profile browser action menus.') as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByLabelText('Show profile color in sidebar profile action menus.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-profileActionMenuOptions': {
          browserColor: false,
          browserExport: true,
          sidebarColor: true,
          sidebarExport: true
        }
      })
    );

    fireEvent.click(screen.getByLabelText('Show profile color in profile browser action menus.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-profileActionMenuOptions': {
          browserColor: true,
          browserExport: true,
          sidebarColor: true,
          sidebarExport: true
        }
      })
    );

    fireEvent.click(screen.getByLabelText('Show export actions in sidebar profile action menus.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-profileActionMenuOptions': {
          browserColor: true,
          browserExport: true,
          sidebarColor: true,
          sidebarExport: false
        }
      })
    );

    fireEvent.click(screen.getByLabelText('Show export actions in profile browser action menus.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-profileActionMenuOptions': {
          browserColor: true,
          browserExport: false,
          sidebarColor: true,
          sidebarExport: false
        }
      })
    );

    expect((screen.getByLabelText('Show SOCKS5 local DNS option. Firefox only.') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Show HTTP/HTTPS proxy overrides in proxy profiles.') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Show WebSocket (ws/wss) proxy overrides in proxy profiles.') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Show bypass list groups in proxy profiles.') as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByLabelText('Show HTTP/HTTPS proxy overrides in proxy profiles.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-showHttpProxyOverrideRows': false
      })
    );

    fireEvent.click(screen.getByLabelText('Show WebSocket (ws/wss) proxy overrides in proxy profiles.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-showWebSocketProxyOverrideRows': true
      })
    );

    fireEvent.click(screen.getByLabelText('Show bypass list groups in proxy profiles.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-showBypassListGroups': true
      })
    );

    fireEvent.click(container.querySelector('#react-ui-locale') as HTMLButtonElement);
    fireEvent.click(screen.getByRole('option', {name: /Espa/}).querySelector('a') as HTMLAnchorElement);
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-uiLocale': 'es'
      })
    );

    fireEvent.click(container.querySelector('#react-ui-theme') as HTMLButtonElement);
    expect(container.querySelector('#react-ui-theme .glyphicon-eye-open')).toBeTruthy();
    expect(container.querySelector('.ui-theme-select .dropdown-menu .glyphicon')).toBeNull();
    fireEvent.click(screen.getByRole('option', {name: 'Dark'}).querySelector('a') as HTMLAnchorElement);
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-uiTheme': 'dark'
      })
    );
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);

    fireEvent.click(container.querySelector('.profile-select:not(.ui-locale-select):not(.ui-theme-select) button') as HTMLButtonElement);
    fireEvent.click(screen.getByRole('option', {name: 'proxy'}).querySelector('a') as HTMLAnchorElement);
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-startupProfileName': 'proxy'
      })
    );
  });

  it('moves quick switch profiles through the rendered drag targets', () => {
    const onOptionsChange = vi.fn();
    const {container} = render(<UiSettings embedded onOptionsChange={onOptionsChange} options={optionsFixture()} />);
    const enabledList = container.querySelector('.cycle-profile-container.cycle-enabled') as HTMLUListElement;
    const disabledList = container.querySelector('.cycle-profile-container:not(.cycle-enabled)') as HTMLUListElement;
    const proxyItem = Array.from(enabledList.querySelectorAll('li')).find((item) => item.textContent?.includes('proxy')) as HTMLLIElement;
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(proxyItem, {dataTransfer});
    fireEvent.drop(disabledList, {dataTransfer});

    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-quickSwitchProfiles': ['direct']
      })
    );
  });

  it('loads standalone options, capability state, and saves UI patches', async () => {
    const loadedOptions = optionsFixture();
    const savedOptions = {
      ...loadedOptions,
      '-profileScopes': {
        container: false,
        tab: true,
        window: false
      },
      '-showSocks5LocalDnsOption': true
    };
    const requests: any[] = [];
    const sendMessage = vi.fn((request, callback) => {
      requests.push(request);
      if (request.method === 'getAll') {
        callback({result: loadedOptions});
        return;
      }
      if (request.method === 'getState') {
        const stateName = request.args[0];
        const stateValues = {
          profileScopeCapabilities: {
            container: true,
            tab: true,
            window: false
          },
          proxyDnsCapabilities: {
            socks5: true
          }
        };
        callback({
          result: Array.isArray(stateName)
            ? Object.fromEntries(stateName.map((key) => [key, stateValues[key as keyof typeof stateValues]]))
            : {
                [stateName]: stateValues[stateName as keyof typeof stateValues]
              }
        });
        return;
      }
      if (request.method === 'patch') {
        callback({result: savedOptions});
      }
    });
    installBackground(sendMessage);

    render(<UiSettings />);

    await screen.findByRole('heading', {name: 'Interface'});
    expect(requests).toContainEqual({
      args: [['profileScopeCapabilities', 'proxyDnsCapabilities']],
      method: 'getState'
    });

    const tabProfiles = screen.getByLabelText('Tab profiles') as HTMLInputElement;
    const windowProfiles = screen.getByLabelText('Normal/private defaults') as HTMLInputElement;
    const socks5LocalDns = screen.getByLabelText('Show SOCKS5 local DNS option. Firefox only.') as HTMLInputElement;
    const websocketProxyRows = screen.getByLabelText('Show WebSocket (ws/wss) proxy overrides in proxy profiles.') as HTMLInputElement;
    const bypassListGroups = screen.getByLabelText('Show bypass list groups in proxy profiles.') as HTMLInputElement;
    expect(tabProfiles.disabled).toBe(false);
    expect(windowProfiles.disabled).toBe(true);
    expect(socks5LocalDns.disabled).toBe(false);
    expect(websocketProxyRows.checked).toBe(false);
    expect(bypassListGroups.checked).toBe(false);

    fireEvent.click(tabProfiles);
    fireEvent.click(socks5LocalDns);
    fireEvent.click(websocketProxyRows);
    fireEvent.click(bypassListGroups);
    fireEvent.click(screen.getByRole('button', {name: /Apply changes/}));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Options saved.'));
    expect(requests).toContainEqual({
      args: [
        {
          '-profileScopes': [
            undefined,
            {
              container: false,
              group: false,
              tab: true,
              window: false
            }
          ],
          '-showBypassListGroups': [undefined, true],
          '-showSocks5LocalDnsOption': [undefined, true],
          '-showWebSocketProxyOverrideRows': [undefined, true]
        }
      ],
      method: 'patch'
    });
  });

  it('hides unsupported context menu options', async () => {
    const sendMessage = vi.fn((request, callback) => {
      if (request.method === 'getAll') {
        callback({result: optionsFixture()});
        return;
      }
      if (request.method === 'getState') {
        callback({
          result: {
            profileScopeCapabilities: {
              window: true
            },
            proxyDnsCapabilities: {}
          }
        });
      }
    });
    installBackground(sendMessage);

    render(<UiSettings />);

    await screen.findByRole('heading', {name: 'Context Menu'});
    expect(screen.getByLabelText('Show Switch Profile')).toBeTruthy();
    expect(screen.getByLabelText('Show normal/private default switching')).toBeTruthy();
    expect(screen.queryByLabelText('Show tab profile switching')).toBeNull();
    expect(screen.queryByLabelText('Show tab group profile switching')).toBeNull();
    expect(screen.queryByLabelText('Show container profile switching')).toBeNull();
    expect(screen.queryByLabelText('Show Open Link in New Tab with Profile')).toBeNull();
    expect(screen.queryByLabelText('Show Open Link in New Window with Profile')).toBeNull();
    expect(screen.queryByLabelText('Show Open Link in New Private Window with Profile')).toBeNull();
  });

  it('shows standalone load errors instead of staying on the loading state', async () => {
    const sendMessage = vi.fn((request, callback) => {
      if (request.method === 'getAll') {
        callback({
          error: {
            _error: 'error',
            message: 'UI options unavailable',
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

    render(<UiSettings />);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('UI options unavailable'));
    expect(screen.queryByText('Loading options...')).toBeNull();
  });
});
