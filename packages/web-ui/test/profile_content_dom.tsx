// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {FixedProfileContent, PacProfile} from '../src/react/profile_content';
import type {NamedFixedProfileModel, NamedPacProfileModel} from '../src/react/profile_types';

function installChromeMock() {
  (globalThis as any).chrome = {
    i18n: {
      getMessage: () => ''
    }
  };
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  installChromeMock();
});

describe('profile content components', () => {
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
