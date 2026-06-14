// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {FixedProfileContent, PacProfile, ProfileShell, RuleListProfile, SwitchAttachedProfile} from '../src/react/profile_content';
import type {NamedFixedProfileModel, NamedPacProfileModel, NamedRuleListProfileModel} from '../src/react/profile_types';

function installChromeMock() {
  (globalThis as any).chrome = {
    i18n: {
      getMessage: () => ''
    }
  };
}

function installOmegaPacMock() {
  (globalThis as any).OmegaPac = {
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
  installChromeMock();
  installOmegaPacMock();
});

describe('profile content components', () => {
  it('toggles popup visibility from profile options', () => {
    const onPopupHiddenChange = vi.fn();

    render(
      <ProfileShell
        onPopupHiddenChange={onPopupHiddenChange}
        profile={{
          name: 'proxy',
          profileType: 'FixedProfile'
        }}
      />
    );

    expect(screen.getByRole('heading', {name: 'Profile Options'})).toBeTruthy();
    expect(screen.getByText('When enabled, this profile is moved to the hidden profiles section in the popup menu.')).toBeTruthy();

    const switchInput = screen.getByRole('switch', {name: 'Hide from popup menu'}) as HTMLInputElement;
    expect(switchInput.checked).toBe(false);

    fireEvent.click(switchInput);
    expect(onPopupHiddenChange).toHaveBeenCalledWith(true);
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
});
