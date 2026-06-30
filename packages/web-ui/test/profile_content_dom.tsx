// @vitest-environment jsdom

import React from 'react';
import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {
  FixedProfileContent,
  PacProfile,
  ProfileShell,
  RuleListProfile,
  SwitchAttachedProfile,
  SwitchProfileStatefulContent
} from '../src/react/profile_content';
import type {NamedFixedProfileModel, NamedPacProfileModel, NamedRuleListProfileModel} from '../src/react/profile_types';

function installProxyEngineMock() {
  (globalThis as any).ProxyEngine = {
    Conditions: {
      getWeekdayList() {
        return [];
      }
    },
    Profiles: {
      ruleListFormats: ['Switchy', 'AutoProxy'],
      validResultProfilesFor() {
        return [];
      }
    }
  };
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  installProxyEngineMock();
});

const CHROMIUM_HTTPS_URL_LIMITATION_INTRO =
  'Chromium-based browsers do not expose the path or query of HTTPS and WSS requests to URL conditions.';
const CHROMIUM_HTTPS_URL_LIMITATION_DETAIL =
  'URL wildcard or URL regex rules that depend on the full HTTPS or WSS URL may not match; host conditions are unaffected.';
const CHROMIUM_HTTPS_URL_LIMITATION_TOOLTIP =
  'Chromium-based browsers cannot match the path or query of HTTPS or WSS URLs with URL wildcard or URL regex rules. Host conditions are unaffected.';

describe('profile content components', () => {
  it('toggles profile visibility from profile options', () => {
    const onContextMenuHiddenChange = vi.fn();
    const onOptionsSidebarHiddenChange = vi.fn();
    const onPopupHiddenChange = vi.fn();

    render(
      <ProfileShell
        onContextMenuHiddenChange={onContextMenuHiddenChange}
        onOptionsSidebarHiddenChange={onOptionsSidebarHiddenChange}
        onPopupHiddenChange={onPopupHiddenChange}
        profile={{
          name: 'proxy',
          profileType: 'FixedProfile'
        }}
        showProfileOptions
      />
    );

    expect(screen.getByRole('heading', {name: 'Profile Options'})).toBeTruthy();
    expect(screen.getByText('When enabled, this profile is moved to the hidden profiles section in the popup menu.')).toBeTruthy();
    expect(screen.getByText('When enabled, this profile is moved to the hidden profiles section in profile context menus.')).toBeTruthy();
    expect(screen.getByText('When enabled, this profile is moved to the hidden profiles section in the options sidebar.')).toBeTruthy();

    const popupSwitch = screen.getByRole('switch', {name: 'Hide from popup menu'}) as HTMLInputElement;
    expect(popupSwitch.checked).toBe(false);

    fireEvent.click(popupSwitch);
    expect(onPopupHiddenChange).toHaveBeenCalledWith(true);

    const contextMenuSwitch = screen.getByRole('switch', {name: 'Hide from context menu'}) as HTMLInputElement;
    expect(contextMenuSwitch.checked).toBe(false);

    fireEvent.click(contextMenuSwitch);
    expect(onContextMenuHiddenChange).toHaveBeenCalledWith(true);

    const optionsSidebarSwitch = screen.getByRole('switch', {name: 'Hide from options sidebar'}) as HTMLInputElement;
    expect(optionsSidebarSwitch.checked).toBe(false);

    fireEvent.click(optionsSidebarSwitch);
    expect(onOptionsSidebarHiddenChange).toHaveBeenCalledWith(true);
  });

  it('hides profile options when profile options are disabled', () => {
    render(
      <ProfileShell
        profile={{
          name: 'proxy',
          profileType: 'FixedProfile'
        }}
      />
    );

    expect(screen.queryByRole('heading', {name: 'Profile Options'})).toBeNull();
  });

  it('updates PAC URLs and exposes download/auth actions', () => {
    const onDownload = vi.fn();
    const onEditProxyAuth = vi.fn();
    const onProfileChange = vi.fn();
    const profile: NamedPacProfileModel = {
      auth: {
        all: {
          username: 'user'
        }
      },
      name: 'pac',
      pacScript: 'function FindProxyForURL() {}',
      pacUrl: 'https://example.com/proxy.pac',
      profileType: 'PacProfile'
    };

    const {container} = render(
      <PacProfile onDownload={onDownload} onEditProxyAuth={onEditProxyAuth} onProfileChange={onProfileChange} profile={profile} />
    );

    expect(screen.getByText('Proxy authentication will be applied to all proxies returned by this PAC profile.')).toBeTruthy();
    expect((container.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', {name: 'Download Profile Now'}));
    expect(onDownload).toHaveBeenCalledWith('pac');

    fireEvent.click(screen.getByTitle('Proxy Authentication'));
    expect(onEditProxyAuth).toHaveBeenCalled();

    fireEvent.change(screen.getByDisplayValue('https://example.com/proxy.pac'), {
      target: {
        value: 'https://cdn.example.com/proxy.pac'
      }
    });
    expect(onProfileChange).toHaveBeenCalledWith('pacUrl', 'https://cdn.example.com/proxy.pac');
  });

  it('warns when referenced PAC profiles use file URLs', () => {
    const profile: NamedPacProfileModel = {
      name: 'pac',
      pacUrl: 'file:///tmp/proxy.pac',
      profileType: 'PacProfile'
    };

    render(<PacProfile profile={profile} referenced />);

    expect(screen.getByText('File URLs are disabled for referenced PAC profiles.')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'Download Profile Now'})).toBeNull();
  });

  it('updates rule-list export cache preference', () => {
    const onProfileChange = vi.fn();
    const profile: NamedRuleListProfileModel = {
      defaultProfileName: 'direct',
      format: 'Switchy',
      matchProfileName: 'proxy',
      name: 'rules',
      profileType: 'RuleListProfile',
      ruleList: '*.example.com',
      sourceUrl: 'https://example.com/rules.txt'
    };

    render(<RuleListProfile onProfileChange={onProfileChange} profile={profile} />);

    expect(
      screen.getByText('This can significantly reduce exported config size for large rule lists. Download the rules again after import.')
    ).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'Rule List Content'})).toBeTruthy();
    expect(screen.queryByDisplayValue('*.example.com')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Show downloaded rule list content'}));
    expect(screen.getByDisplayValue('*.example.com')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Hide downloaded rule list content'}));
    expect(screen.queryByDisplayValue('*.example.com')).toBeNull();

    const switchInput = screen.getByRole('switch', {
      name: 'Exclude downloaded rule list content from exported config.'
    }) as HTMLInputElement;
    expect(switchInput.checked).toBe(false);

    fireEvent.click(switchInput);
    expect(onProfileChange).toHaveBeenCalledWith('omitRuleListFromExport', true);
  });

  it('updates attached rule-list export cache preference', () => {
    const onAttachedChange = vi.fn();
    const attached: NamedRuleListProfileModel = {
      format: 'Switchy',
      name: '__ruleListOf_auto',
      profileType: 'RuleListProfile',
      ruleList: '*.example.com',
      sourceUrl: 'https://example.com/rules.txt'
    };

    render(<SwitchAttachedProfile attached={attached} onAttachedChange={onAttachedChange} />);

    expect(screen.queryByDisplayValue('*.example.com')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Show downloaded rule list content'}));
    expect(screen.getByDisplayValue('*.example.com')).toBeTruthy();

    const switchInput = screen.getByRole('switch', {
      name: 'Exclude downloaded rule list content from exported config.'
    }) as HTMLInputElement;
    expect(switchInput.checked).toBe(false);

    fireEvent.click(switchInput);
    expect(onAttachedChange).toHaveBeenCalledWith('omitRuleListFromExport', true);
  });

  it('keeps manual attached rule-list content visible', () => {
    const attached: NamedRuleListProfileModel = {
      format: 'Switchy',
      name: '__ruleListOf_auto',
      profileType: 'RuleListProfile',
      ruleList: '*.manual.example'
    };

    render(<SwitchAttachedProfile attached={attached} />);

    expect(screen.queryByRole('button', {name: 'Show downloaded rule list content'})).toBeNull();
    expect(screen.getByDisplayValue('*.manual.example')).toBeTruthy();
  });

  it('commits fixed proxy edits and bypass list changes', () => {
    const onBypassListChange = vi.fn();
    const onEditProxyAuth = vi.fn();
    const onProxyChange = vi.fn();
    const profile: NamedFixedProfileModel = {
      bypassList: [
        {
          conditionType: 'BypassCondition',
          pattern: 'localhost'
        }
      ],
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    const {container} = render(
      <FixedProfileContent
        onBypassListChange={onBypassListChange}
        onEditProxyAuth={onEditProxyAuth}
        onProxyChange={onProxyChange}
        profile={profile}
      />
    );

    fireEvent.change(container.querySelector('select') as HTMLSelectElement, {
      target: {
        value: 'https'
      }
    });
    expect(onProxyChange).toHaveBeenCalledWith(
      'fallbackProxy',
      {
        host: 'example.com',
        port: 443,
        scheme: 'https'
      },
      {
        clearAuth: false
      }
    );

    fireEvent.click(screen.getByTitle('Proxy Authentication'));
    expect(onEditProxyAuth).toHaveBeenCalledWith('');

    const bypassList = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(bypassList, {
      target: {
        value: 'localhost\n*.internal'
      }
    });
    fireEvent.blur(bypassList);

    expect(onBypassListChange).toHaveBeenCalledWith([
      {
        conditionType: 'BypassCondition',
        pattern: 'localhost'
      },
      {
        conditionType: 'BypassCondition',
        pattern: '*.internal'
      }
    ]);
  });

  it('shows the SOCKS5 local DNS protocol only when enabled', () => {
    const onProxyChange = vi.fn();
    const profile: NamedFixedProfileModel = {
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    const {container, rerender} = render(<FixedProfileContent onProxyChange={onProxyChange} profile={profile} />);

    expect(screen.queryByRole('option', {name: 'SOCKS5 LOCAL DNS'})).toBeNull();

    rerender(
      <FixedProfileContent
        onProxyChange={onProxyChange}
        profile={profile}
        proxyAuthCapabilities={{
          http: true,
          https: true,
          socks4: false,
          socks5: true
        }}
        showSocks5LocalDnsOption
      />
    );
    expect(screen.getByRole('option', {name: 'SOCKS5 LOCAL DNS'})).toBeTruthy();

    fireEvent.change(container.querySelector('select') as HTMLSelectElement, {
      target: {
        value: 'socks5-local'
      }
    });

    expect(onProxyChange).toHaveBeenLastCalledWith(
      'fallbackProxy',
      {
        host: 'example.com',
        port: 1080,
        scheme: 'socks5-local'
      },
      {
        clearAuth: false
      }
    );
  });

  it('commits explicit direct settings for advanced fixed proxy schemes', () => {
    const onProxyChange = vi.fn();
    const profile: NamedFixedProfileModel = {
      fallbackProxy: {
        host: 'proxy.example',
        port: 8080,
        scheme: 'http'
      },
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    const {container} = render(<FixedProfileContent onProxyChange={onProxyChange} profile={profile} />);
    fireEvent.click(screen.getByRole('button', {name: /Show Advanced/}));

    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[1] as HTMLSelectElement, {
      target: {
        value: 'direct'
      }
    });

    expect(onProxyChange).toHaveBeenLastCalledWith(
      'proxyForHttp',
      {
        scheme: 'direct'
      },
      {
        clearAuth: true
      }
    );

    const httpRow = selects[1].closest('tr') as HTMLTableRowElement;
    const inputs = httpRow.querySelectorAll('input');
    expect(inputs[0].disabled).toBe(true);
    expect(inputs[0].placeholder).toBe('');
    expect(inputs[1].disabled).toBe(true);
    expect(inputs[1].placeholder).toBe('');
    expect(httpRow.querySelector('button')?.disabled).toBe(true);
  });

  it('hides websocket proxy override rows by default', () => {
    const profile: NamedFixedProfileModel = {
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    render(<FixedProfileContent profile={profile} />);
    fireEvent.click(screen.getByRole('button', {name: /Show Advanced/}));

    expect(screen.getByText('http://')).toBeTruthy();
    expect(screen.getByText('https://')).toBeTruthy();
    expect(screen.queryByText('ws://')).toBeNull();
    expect(screen.queryByText('wss://')).toBeNull();
  });

  it('hides the advanced fixed proxy expander when no override rows are enabled', () => {
    const profile: NamedFixedProfileModel = {
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    render(<FixedProfileContent profile={profile} showHttpProxyOverrideRows={false} showWebSocketProxyOverrideRows={false} />);

    expect(screen.queryByRole('button', {name: /Show Advanced/})).toBeNull();
    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.queryByText('http://')).toBeNull();
    expect(screen.queryByText('ws://')).toBeNull();
  });

  it('keeps configured fixed proxy override rows visible when their display option is disabled', () => {
    const profile: NamedFixedProfileModel = {
      name: 'proxy',
      profileType: 'FixedProfile',
      proxyForWss: {
        scheme: 'direct'
      }
    };

    render(<FixedProfileContent profile={profile} showHttpProxyOverrideRows={false} showWebSocketProxyOverrideRows={false} />);

    expect(screen.getByText('wss://')).toBeTruthy();
    expect(screen.queryByText('http://')).toBeNull();
    expect(screen.queryByText('ws://')).toBeNull();
  });

  it('keeps a configured fixed proxy override row visible after changing it to use default', () => {
    const onProxyChange = vi.fn();
    const profile: NamedFixedProfileModel = {
      name: 'proxy',
      profileType: 'FixedProfile',
      proxyForWss: {
        scheme: 'direct'
      }
    };

    render(
      <FixedProfileContent
        onProxyChange={onProxyChange}
        profile={profile}
        showHttpProxyOverrideRows={false}
        showWebSocketProxyOverrideRows={false}
      />
    );

    const wssRow = screen.getByText('wss://').closest('tr') as HTMLTableRowElement;
    const select = wssRow.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, {
      target: {
        value: ''
      }
    });

    expect(onProxyChange).toHaveBeenLastCalledWith('proxyForWss', undefined, {clearAuth: true});
    expect(screen.getByText('wss://')).toBeTruthy();
  });

  it('recomputes pinned fixed proxy override rows after switching profiles', () => {
    const firstProfile: NamedFixedProfileModel = {
      name: 'proxy',
      profileType: 'FixedProfile',
      proxyForWss: {
        scheme: 'direct'
      }
    };
    const secondProfile: NamedFixedProfileModel = {
      name: 'proxy2',
      profileType: 'FixedProfile'
    };

    const {rerender} = render(
      <FixedProfileContent profile={firstProfile} showHttpProxyOverrideRows={false} showWebSocketProxyOverrideRows={false} />
    );
    expect(screen.getByText('wss://')).toBeTruthy();

    rerender(<FixedProfileContent profile={secondProfile} showHttpProxyOverrideRows={false} showWebSocketProxyOverrideRows={false} />);

    expect(screen.queryByText('wss://')).toBeNull();
    expect(screen.queryByText('http://')).toBeNull();
  });

  it('keeps an existing SOCKS5 local DNS protocol visible', () => {
    const profile: NamedFixedProfileModel = {
      fallbackProxy: {
        host: '127.0.0.1',
        port: 1080,
        scheme: 'socks5-local'
      },
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    render(<FixedProfileContent profile={profile} />);

    expect((screen.getByRole('option', {name: 'SOCKS5 LOCAL DNS'}) as HTMLOptionElement).selected).toBe(true);
  });

  it('disables fixed proxy authentication controls for unsupported protocols', () => {
    const onEditProxyAuth = vi.fn();
    const socks4Profile: NamedFixedProfileModel = {
      fallbackProxy: {
        host: '127.0.0.1',
        port: 1080,
        scheme: 'socks4'
      },
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    const {rerender} = render(<FixedProfileContent onEditProxyAuth={onEditProxyAuth} profile={socks4Profile} />);
    const socks4Tooltip = screen.getByTitle('SOCKS4 does not support username/password authentication.');
    expect(socks4Tooltip.querySelector('button')?.disabled).toBe(true);
    fireEvent.click(socks4Tooltip);
    expect(onEditProxyAuth).not.toHaveBeenCalled();

    const socks5Profile: NamedFixedProfileModel = {
      fallbackProxy: {
        host: '127.0.0.1',
        port: 1080,
        scheme: 'socks5'
      },
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    rerender(<FixedProfileContent onEditProxyAuth={onEditProxyAuth} profile={socks5Profile} />);
    const socks5Tooltip = screen.getByTitle('Chromium-based browsers do not expose SOCKS5 username/password authentication to extensions.');
    expect(socks5Tooltip.querySelector('button')?.disabled).toBe(true);
    fireEvent.click(socks5Tooltip);
    expect(onEditProxyAuth).not.toHaveBeenCalled();

    rerender(
      <FixedProfileContent
        onEditProxyAuth={onEditProxyAuth}
        profile={socks5Profile}
        proxyAuthCapabilities={{
          http: true,
          https: true,
          socks4: false,
          socks5: true
        }}
      />
    );
    fireEvent.click(screen.getByTitle('Proxy Authentication'));
    expect(onEditProxyAuth).toHaveBeenCalledWith('');
  });

  it('does not commit unchanged fixed proxy bypass list on blur', () => {
    const onBypassListChange = vi.fn();
    const profile: NamedFixedProfileModel = {
      bypassList: [
        {
          conditionType: 'BypassCondition',
          pattern: 'localhost'
        }
      ],
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    const {container} = render(<FixedProfileContent onBypassListChange={onBypassListChange} profile={profile} />);

    const bypassList = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.focus(bypassList);
    fireEvent.blur(bypassList);
    expect(onBypassListChange).not.toHaveBeenCalled();

    fireEvent.change(bypassList, {
      target: {
        value: 'localhost\n'
      }
    });
    fireEvent.blur(bypassList);
    expect(onBypassListChange).not.toHaveBeenCalled();
  });

  it('hides fixed proxy bypass list group controls by default', () => {
    const profile: NamedFixedProfileModel = {
      bypassGroups: [
        {
          name: 'Internal',
          bypassList: [
            {
              conditionType: 'BypassCondition',
              pattern: '*.internal'
            }
          ]
        }
      ],
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    const {container, rerender} = render(<FixedProfileContent profile={profile} />);

    expect(screen.queryByRole('button', {name: 'Add a new list group'})).toBeNull();
    expect(screen.queryByLabelText('Group name')).toBeNull();
    expect(container.querySelectorAll('textarea')).toHaveLength(1);

    rerender(<FixedProfileContent profile={profile} showBypassListGroups />);

    expect(screen.getByRole('button', {name: 'Add a new list group'})).toBeTruthy();
    expect(screen.getByLabelText('Group name')).toBeTruthy();
    expect(container.querySelectorAll('textarea')).toHaveLength(2);
  });

  it('adds and edits fixed proxy bypass list groups', () => {
    const onBypassGroupsChange = vi.fn();
    const profile: NamedFixedProfileModel = {
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    const {container} = render(<FixedProfileContent onBypassGroupsChange={onBypassGroupsChange} profile={profile} showBypassListGroups />);

    fireEvent.click(screen.getByRole('button', {name: 'Add a new list group'}));
    expect(onBypassGroupsChange).toHaveBeenLastCalledWith([
      {
        bypassList: []
      }
    ]);

    fireEvent.change(screen.getByLabelText('Group name'), {
      target: {
        value: 'Internal'
      }
    });
    expect(onBypassGroupsChange).toHaveBeenLastCalledWith([
      {
        bypassList: [],
        name: 'Internal'
      }
    ]);

    fireEvent.click(screen.getByRole('switch', {name: 'Enable this list group'}));
    expect(onBypassGroupsChange).toHaveBeenLastCalledWith([
      {
        bypassList: [],
        enabled: false,
        name: 'Internal'
      }
    ]);

    const groupBypassList = container.querySelectorAll('textarea')[1] as HTMLTextAreaElement;
    fireEvent.change(groupBypassList, {
      target: {
        value: '*.internal\nlocalhost'
      }
    });
    expect(onBypassGroupsChange).toHaveBeenLastCalledWith([
      {
        bypassList: [
          {
            conditionType: 'BypassCondition',
            pattern: '*.internal'
          },
          {
            conditionType: 'BypassCondition',
            pattern: 'localhost'
          }
        ],
        enabled: false,
        name: 'Internal'
      }
    ]);
  });

  it('keeps fixed proxy bypass group textarea drafts while focused', () => {
    function ControlledFixedProfileContent() {
      const [profile, setProfile] = React.useState<NamedFixedProfileModel>({
        bypassGroups: [
          {
            name: 'Internal',
            bypassList: [
              {
                conditionType: 'BypassCondition',
                pattern: '*.internal'
              },
              {
                conditionType: 'BypassCondition',
                pattern: 'localhost'
              }
            ]
          }
        ],
        name: 'proxy',
        profileType: 'FixedProfile'
      });

      return (
        <FixedProfileContent
          onBypassGroupsChange={(bypassGroups) => setProfile((current) => ({...current, bypassGroups}))}
          profile={profile}
          showBypassListGroups
        />
      );
    }

    const {container} = render(<ControlledFixedProfileContent />);
    const groupBypassList = container.querySelectorAll('textarea')[1] as HTMLTextAreaElement;

    groupBypassList.focus();
    expect(document.activeElement).toBe(groupBypassList);
    fireEvent.change(groupBypassList, {
      target: {
        value: '*.internal\n\nlocalhost'
      }
    });

    expect(groupBypassList.value).toBe('*.internal\n\nlocalhost');
  });

  it('confirms deleting non-empty fixed proxy bypass list groups and removes empty groups directly', () => {
    const onBypassGroupsChange = vi.fn();
    const profile: NamedFixedProfileModel = {
      bypassGroups: [
        {
          name: 'Internal',
          bypassList: [
            {
              conditionType: 'BypassCondition',
              pattern: '*.internal'
            }
          ]
        }
      ],
      name: 'proxy',
      profileType: 'FixedProfile'
    };

    const {rerender} = render(<FixedProfileContent onBypassGroupsChange={onBypassGroupsChange} profile={profile} showBypassListGroups />);

    fireEvent.click(screen.getByTitle('Delete group'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Delete List Group'})).toBeTruthy();
    expect(within(dialog).getByText('Internal')).toBeTruthy();
    expect(onBypassGroupsChange).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', {name: 'Delete group'}));
    expect(onBypassGroupsChange).toHaveBeenLastCalledWith([]);

    onBypassGroupsChange.mockClear();
    rerender(
      <FixedProfileContent
        onBypassGroupsChange={onBypassGroupsChange}
        profile={{name: 'proxy', profileType: 'FixedProfile'}}
        showBypassListGroups
      />
    );
    fireEvent.click(screen.getByRole('button', {name: 'Add a new list group'}));
    fireEvent.click(screen.getByTitle('Delete group'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onBypassGroupsChange).toHaveBeenLastCalledWith([]);
  });

  it('discards switch source editing without applying untouched source', () => {
    const onApplySource = vi.fn();
    const sourceCode = '[SwitchyOmega Conditions]\n@with result\n* +direct';

    render(
      <SwitchProfileStatefulContent
        onApplySource={onApplySource}
        onCreateSource={() => ({
          code: sourceCode
        })}
        profile={{
          defaultProfileName: 'direct',
          name: 'auto switch',
          profileType: 'SwitchProfile',
          rules: []
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(sourceCode);

    fireEvent.click(screen.getByRole('button', {name: 'Discard Source'}));
    expect(onApplySource).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows Chromium secure URL condition info without a rule-table banner', () => {
    const {container} = render(
      <SwitchProfileStatefulContent
        loadRules
        profile={{
          defaultProfileName: 'direct',
          name: 'auto switch',
          profileType: 'SwitchProfile',
          rules: [
            {
              condition: {
                conditionType: 'UrlRegexCondition',
                pattern: '^https://example\\.com/path'
              },
              profileName: 'direct'
            }
          ]
        }}
        proxyFeatures={['fullUrlHttp']}
        rules={[
          {
            condition: {
              conditionType: 'UrlRegexCondition',
              pattern: '^https://example\\.com/path'
            },
            profileName: 'direct'
          }
        ]}
        show
      />
    );

    expect(screen.getByTitle(CHROMIUM_HTTPS_URL_LIMITATION_TOOLTIP)).toBeTruthy();
    expect(screen.getAllByText(CHROMIUM_HTTPS_URL_LIMITATION_INTRO)).not.toHaveLength(0);
    expect(screen.getAllByText(CHROMIUM_HTTPS_URL_LIMITATION_DETAIL)).not.toHaveLength(0);
    expect(container.querySelector('.glyphicon-info-sign.text-info')).toBeTruthy();
    expect(container.querySelector('.condition-url-info')).toBeTruthy();
    expect(container.querySelector('.glyphicon-alert.text-danger')).toBeNull();
    expect(container.querySelector('.switch-rules-header-host .alert')).toBeNull();
    expect(container.querySelector('.icon-wrapper[href]')).toBeNull();
  });

  it('hides Chromium secure URL condition info when full URLs are available', () => {
    const {container} = render(
      <SwitchProfileStatefulContent
        loadRules
        profile={{
          defaultProfileName: 'direct',
          name: 'auto switch',
          profileType: 'SwitchProfile',
          rules: [
            {
              condition: {
                conditionType: 'UrlWildcardCondition',
                pattern: 'https://example.com/path*'
              },
              profileName: 'direct'
            }
          ]
        }}
        proxyFeatures={['fullUrl']}
        rules={[
          {
            condition: {
              conditionType: 'UrlWildcardCondition',
              pattern: 'https://example.com/path*'
            },
            profileName: 'direct'
          }
        ]}
        show
      />
    );

    expect(screen.queryByTitle(CHROMIUM_HTTPS_URL_LIMITATION_TOOLTIP)).toBeNull();
    expect(screen.queryByText(CHROMIUM_HTTPS_URL_LIMITATION_INTRO)).toBeNull();
    expect(screen.queryByText(CHROMIUM_HTTPS_URL_LIMITATION_DETAIL)).toBeNull();
    expect(container.querySelector('.glyphicon-info-sign.text-info')).toBeNull();
    expect(container.querySelector('.condition-url-info')).toBeNull();
    expect(container.querySelector('.switch-rules-header-host .alert')).toBeNull();
  });

  it('keeps loaded switch rules visible after deleting a rule', () => {
    vi.useFakeTimers();

    function SwitchRulesHarness() {
      const [rules, setRules] = React.useState(() =>
        Array.from({length: 23}, (_value, index) => ({
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: `rule-${index}.example`
          },
          profileName: 'direct'
        }))
      );

      return (
        <SwitchProfileStatefulContent
          confirmDeletion={false}
          loadRules
          onRemoveRule={(index) => {
            setRules((current) => current.filter((_rule, ruleIndex) => ruleIndex !== index));
          }}
          profile={{
            defaultProfileName: 'direct',
            name: 'auto switch',
            profileType: 'SwitchProfile',
            rules
          }}
          rules={rules}
        />
      );
    }

    try {
      const {container} = render(<SwitchRulesHarness />);
      expect(container.querySelectorAll('.switch-rule-row')).toHaveLength(15);

      act(() => {
        vi.advanceTimersByTime(64);
      });
      expect(container.querySelectorAll('.switch-rule-row')).toHaveLength(23);

      fireEvent.click(screen.getAllByTitle('Delete rule')[0]);
      expect(container.querySelectorAll('.switch-rule-row')).toHaveLength(22);
    } finally {
      vi.useRealTimers();
    }
  });
});
