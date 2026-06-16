// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {UiSettings} from '../src/react/ui_settings';
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
    '-showInspectMenu': true,
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

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('theme-dark', 'theme-light');
  delete document.documentElement.dataset.effectiveTheme;
  delete document.documentElement.dataset.uiTheme;
});

beforeEach(() => {
  installChromeMock();
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

    fireEvent.click(screen.getByLabelText('Show Profile Options on profile pages for hiding profiles from the popup menu.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-showProfileOptions': true
      })
    );

    fireEvent.click(screen.getByLabelText('Show Current Profile on the General settings page.'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        '-showCurrentProfileInGeneral': true
      })
    );

    expect((screen.getByLabelText('Show SOCKS5 local DNS option. Firefox only.') as HTMLInputElement).disabled).toBe(true);

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

    fireEvent.click(
      container.querySelector('.omega-profile-select:not(.ui-locale-select):not(.ui-theme-select) button') as HTMLButtonElement
    );
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
});
