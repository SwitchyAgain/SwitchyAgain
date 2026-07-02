// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {OptionsAlert, OptionsShell} from '../src/react/options_shell';
import type {Options} from '../src/react/options_client_types';

function optionsFixture(): Options {
  return {
    '+auto': {
      name: 'auto',
      profileType: 'SwitchProfile'
    },
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile'
    }
  };
}

afterEach(() => {
  cleanup();
});

describe('options shell components', () => {
  it('renders navigation links and dispatches shell actions', () => {
    const onApply = vi.fn();
    const onDiscard = vi.fn();
    const onNavigate = vi.fn();
    const onNewProfile = vi.fn();

    render(
      <OptionsShell
        currentProfileName="proxy"
        currentState="profile"
        onApply={onApply}
        onDiscard={onDiscard}
        onNavigate={onNavigate}
        onNewProfile={onNewProfile}
        options={optionsFixture()}
        optionsDirty={true}
        profileHref={(profile) => `#/profile/${profile.name}`}
      />
    );

    fireEvent.click(screen.getByRole('link', {name: 'General'}));
    expect(onNavigate).toHaveBeenCalledWith('general');

    fireEvent.click(screen.getByRole('link', {name: /proxy/}));
    expect(onNavigate).toHaveBeenCalledWith('profile', {
      name: 'proxy'
    });

    fireEvent.click(screen.getByRole('button', {name: 'New profile'}));
    expect(onNewProfile).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));
    expect(onApply).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {name: 'Discard changes'}));
    expect(onDiscard).toHaveBeenCalled();
  });

  it('keeps profile links in a separate scroll region from shell actions', () => {
    const {container} = render(<OptionsShell options={optionsFixture()} optionsDirty={true} />);

    expect(container.querySelector('.options-shell-profile-list .nav-profile')).toBeTruthy();
    expect(container.querySelector('.options-shell-profile-list .nav-new-profile')).toBeNull();
    expect(container.querySelector('.options-shell-actions .nav-new-profile')).toBeTruthy();
    expect(container.querySelector('.options-shell-actions .btn-success')).toBeTruthy();
  });

  it('keeps discard disabled when there are no dirty options', () => {
    const onDiscard = vi.fn();

    const {container} = render(<OptionsShell onDiscard={onDiscard} options={optionsFixture()} optionsDirty={false} />);

    const discardButton = screen.getByRole('button', {name: 'Discard changes'});
    fireEvent.click(discardButton);

    expect(onDiscard).not.toHaveBeenCalled();
    expect(container.querySelector('.disabled .text-danger')).toBe(discardButton);
  });

  it('renders optional profile scope navigation and experimental status', () => {
    const onNavigate = vi.fn();

    render(
      <OptionsShell
        currentState="profileScope"
        isExperimental
        onNavigate={onNavigate}
        options={optionsFixture()}
        profileScopeHref="#/profileScope"
        showProfileScope
      />
    );

    expect(screen.getByText('Experimental')).toBeTruthy();
    expect(screen.getByRole('link', {name: 'Profile Scope'}).getAttribute('href')).toBe('#/profileScope');

    fireEvent.click(screen.getByRole('link', {name: 'Profile Scope'}));
    expect(onNavigate).toHaveBeenCalledWith('profileScope');
  });

  it('hides route trace navigation when disabled', () => {
    render(<OptionsShell options={optionsFixture()} showRouteTrace={false} />);

    expect(screen.queryByRole('link', {name: 'Route Trace'})).toBeNull();
  });

  it('keeps hidden profiles collapsed in a separate navigation group', () => {
    const options = {
      ...optionsFixture(),
      '+auto': {
        name: 'auto',
        hiddenInOptions: true,
        profileType: 'SwitchProfile'
      }
    };
    const {container} = render(<OptionsShell appliedOptions={options} options={options} />);
    const profileList = container.querySelector('.options-shell-profile-list') as HTMLElement;

    expect(within(profileList).queryByRole('link', {name: /auto/})).toBeNull();
    expect(within(profileList).getByRole('link', {name: /proxy/})).toBeTruthy();

    const hiddenProfiles = screen.getByRole('button', {name: 'Hidden'});
    expect(hiddenProfiles.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', {name: /auto/})).toBeNull();

    fireEvent.click(hiddenProfiles);

    expect(hiddenProfiles.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', {name: /auto/})).toBeTruthy();
  });

  it('opens profile flyouts from section headers and navigates from them', () => {
    const onNavigate = vi.fn();
    const options = {
      ...optionsFixture(),
      '+auto': {
        name: 'auto',
        hiddenInOptions: true,
        profileType: 'SwitchProfile'
      }
    };

    render(
      <OptionsShell
        appliedOptions={options}
        currentProfileName="proxy"
        currentState="profile"
        onNavigate={onNavigate}
        options={options}
        profileHref={(profile) => `#/profile/${profile.name}`}
      />
    );

    const profilesButton = screen.getAllByRole('button', {name: 'Show all'})[0];
    fireEvent.click(profilesButton);

    let profilesControlMenu = screen.getByRole('menu', {name: 'Show all'});
    fireEvent.mouseEnter(within(profilesControlMenu).getByRole('menuitem', {name: 'Show all'}));

    let profilesMenu = screen.getByRole('menu', {name: 'Profiles'});
    expect(within(profilesMenu).getByRole('menuitem', {name: /proxy/}).classList.contains('active')).toBe(true);
    expect(within(profilesMenu).queryByRole('menuitem', {name: /auto/})).toBeNull();

    fireEvent.mouseLeave(within(profilesControlMenu).getByRole('menuitem', {name: 'Show all'}).parentElement as HTMLElement);
    expect(screen.queryByRole('menu', {name: 'Profiles'})).toBeNull();

    fireEvent.mouseEnter(within(profilesControlMenu).getByRole('menuitem', {name: 'Show all'}));
    profilesMenu = screen.getByRole('menu', {name: 'Profiles'});

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu', {name: 'Profiles'})).toBeNull();

    fireEvent.click(profilesButton);
    profilesControlMenu = screen.getByRole('menu', {name: 'Show all'});
    fireEvent.focus(within(profilesControlMenu).getByRole('menuitem', {name: 'Show all'}));
    profilesMenu = screen.getByRole('menu', {name: 'Profiles'});
    fireEvent.click(within(profilesMenu).getByRole('menuitem', {name: /proxy/}));
    expect(onNavigate).toHaveBeenCalledWith('profile', {name: 'proxy'});
    expect(screen.queryByRole('menu', {name: 'Profiles'})).toBeNull();

    fireEvent.click(screen.getAllByRole('button', {name: 'Show all'})[1]);
    const hiddenProfilesControlMenu = screen.getByRole('menu', {name: 'Show all'});
    fireEvent.mouseEnter(within(hiddenProfilesControlMenu).getByRole('menuitem', {name: 'Show all'}));
    const hiddenProfilesMenu = screen.getByRole('menu', {name: 'Hidden'});
    expect(within(hiddenProfilesMenu).getByRole('menuitem', {name: /auto/})).toBeTruthy();

    fireEvent.click(within(hiddenProfilesMenu).getByRole('menuitem', {name: /auto/}));
    expect(onNavigate).toHaveBeenCalledWith('profile', {name: 'auto'});
    expect(screen.queryByRole('menu', {name: 'Hidden'})).toBeNull();
  });

  it('opens the profile browser modal and filters all profile groups', () => {
    const onNavigate = vi.fn();
    const options = {
      ...optionsFixture(),
      '+auto': {
        name: 'auto',
        hiddenInOptions: true,
        profileType: 'SwitchProfile'
      }
    };

    render(
      <OptionsShell
        appliedOptions={options}
        currentProfileName="proxy"
        currentState="profile"
        onNavigate={onNavigate}
        options={options}
        profileHref={(profile) => `#/profile/${profile.name}`}
      />
    );

    fireEvent.click(screen.getAllByRole('button', {name: 'Show all'})[0]);
    fireEvent.click(screen.getByRole('menuitem', {name: 'Browse all'}));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Browse all profiles')).toBeTruthy();
    expect(within(dialog).getByText('Profiles')).toBeTruthy();
    expect(within(dialog).getByText('Hidden')).toBeTruthy();
    expect(within(dialog).getByRole('link', {name: /proxy/})).toBeTruthy();
    expect(within(dialog).getByRole('link', {name: /auto/})).toBeTruthy();

    fireEvent.change(within(dialog).getByPlaceholderText('Search profiles'), {
      target: {
        value: 'auto'
      }
    });

    expect(within(dialog).queryByRole('link', {name: /proxy/})).toBeNull();
    const autoLink = within(dialog).getByRole('link', {name: /auto/});

    fireEvent.click(autoLink);

    expect(onNavigate).toHaveBeenCalledWith('profile', {name: 'auto'});
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('runs profile browser item actions from the overflow menu', () => {
    const onDeleteProfile = vi.fn();
    const onExportPacProfile = vi.fn();
    const onExportRuleListProfile = vi.fn();
    const onProfileColorChange = vi.fn();
    const onRenameProfile = vi.fn();

    render(
      <OptionsShell
        onDeleteProfile={onDeleteProfile}
        onExportPacProfile={onExportPacProfile}
        onExportRuleListProfile={onExportRuleListProfile}
        onProfileColorChange={onProfileColorChange}
        onRenameProfile={onRenameProfile}
        options={optionsFixture()}
      />
    );

    function openProfileBrowser() {
      fireEvent.click(screen.getAllByRole('button', {name: 'Show all'})[0]);
      fireEvent.click(screen.getByRole('menuitem', {name: 'Browse all'}));
      return screen.getByRole('dialog');
    }

    function openProfileActions(dialog: HTMLElement, profileName: string) {
      const profileItem = within(dialog)
        .getByRole('link', {name: new RegExp(profileName)})
        .closest('.options-shell-profile-browser-item') as HTMLElement;
      fireEvent.click(within(profileItem).getByRole('button', {name: 'Profile Options'}));
      return within(profileItem);
    }

    let dialog = openProfileBrowser();
    let actions = openProfileActions(dialog, 'proxy');
    fireEvent.mouseEnter(actions.getByRole('menuitem', {name: 'Profile color'}));
    fireEvent.click(screen.getByRole('button', {name: 'Use #dd6633'}));
    expect(onProfileColorChange).toHaveBeenCalledWith(expect.objectContaining({name: 'proxy'}), '#dd6633');
    expect(screen.getByRole('dialog')).toBeTruthy();

    dialog = screen.getByRole('dialog');
    fireEvent.click(openProfileActions(dialog, 'auto').getByRole('menuitem', {name: 'Export Rule List'}));
    expect(onExportRuleListProfile).toHaveBeenCalledWith(expect.objectContaining({name: 'auto'}));
    expect(screen.getByRole('dialog')).toBeTruthy();

    dialog = screen.getByRole('dialog');
    fireEvent.click(openProfileActions(dialog, 'auto').getByRole('menuitem', {name: 'Export PAC'}));
    expect(onExportPacProfile).toHaveBeenCalledWith(expect.objectContaining({name: 'auto'}));
    expect(screen.getByRole('dialog')).toBeTruthy();

    dialog = screen.getByRole('dialog');
    fireEvent.click(openProfileActions(dialog, 'proxy').getByRole('menuitem', {name: 'Export PAC'}));
    expect(onExportPacProfile).toHaveBeenCalledWith(expect.objectContaining({name: 'proxy'}));
    expect(screen.getByRole('dialog')).toBeTruthy();

    dialog = screen.getByRole('dialog');
    fireEvent.click(openProfileActions(dialog, 'proxy').getByRole('menuitem', {name: 'Rename'}));
    expect(onRenameProfile).toHaveBeenCalledWith(expect.objectContaining({name: 'proxy'}));
    expect(screen.getByRole('dialog')).toBeTruthy();

    dialog = screen.getByRole('dialog');
    fireEvent.click(openProfileActions(dialog, 'proxy').getByRole('menuitem', {name: 'Delete Profile'}));
    expect(onDeleteProfile).toHaveBeenCalledWith(expect.objectContaining({name: 'proxy'}));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('runs sidebar profile item actions from overflow menus', () => {
    const onDeleteProfile = vi.fn();
    const onExportPacProfile = vi.fn();
    const onExportRuleListProfile = vi.fn();
    const onProfileColorChange = vi.fn();
    const onRenameProfile = vi.fn();
    const options = {
      ...optionsFixture(),
      '+auto': {
        name: 'auto',
        hiddenInOptions: true,
        profileType: 'SwitchProfile'
      }
    };

    const {container} = render(
      <OptionsShell
        appliedOptions={options}
        onDeleteProfile={onDeleteProfile}
        onExportPacProfile={onExportPacProfile}
        onExportRuleListProfile={onExportRuleListProfile}
        onProfileColorChange={onProfileColorChange}
        onRenameProfile={onRenameProfile}
        options={options}
      />
    );

    const profileList = container.querySelector('.options-shell-profile-list') as HTMLElement;
    const proxyItem = within(profileList).getByRole('link', {name: /proxy/}).closest('.nav-profile') as HTMLElement;
    fireEvent.click(within(proxyItem).getByRole('button', {name: 'Profile Options'}));
    fireEvent.mouseEnter(within(proxyItem).getByRole('menuitem', {name: 'Profile color'}));
    fireEvent.click(screen.getByRole('button', {name: 'Use #99dd99'}));
    expect(onProfileColorChange).toHaveBeenCalledWith(expect.objectContaining({name: 'proxy'}), '#99dd99');

    fireEvent.click(within(proxyItem).getByRole('button', {name: 'Profile Options'}));
    fireEvent.click(within(proxyItem).getByRole('menuitem', {name: 'Export PAC'}));
    expect(onExportPacProfile).toHaveBeenCalledWith(expect.objectContaining({name: 'proxy'}));

    fireEvent.click(within(proxyItem).getByRole('button', {name: 'Profile Options'}));
    fireEvent.click(within(proxyItem).getByRole('menuitem', {name: 'Rename'}));
    expect(onRenameProfile).toHaveBeenCalledWith(expect.objectContaining({name: 'proxy'}));

    fireEvent.click(screen.getByRole('button', {name: 'Hidden'}));
    const hiddenList = container.querySelector('.options-shell-hidden-profile-list') as HTMLElement;
    const autoItem = within(hiddenList).getByRole('link', {name: /auto/}).closest('.nav-profile') as HTMLElement;
    fireEvent.click(within(autoItem).getByRole('button', {name: 'Profile Options'}));
    fireEvent.click(within(autoItem).getByRole('menuitem', {name: 'Export Rule List'}));
    expect(onExportRuleListProfile).toHaveBeenCalledWith(expect.objectContaining({name: 'auto'}));

    fireEvent.click(within(autoItem).getByRole('button', {name: 'Profile Options'}));
    fireEvent.click(within(autoItem).getByRole('menuitem', {name: 'Export PAC'}));
    expect(onExportPacProfile).toHaveBeenCalledWith(expect.objectContaining({name: 'auto'}));

    fireEvent.click(within(autoItem).getByRole('button', {name: 'Profile Options'}));
    fireEvent.click(within(autoItem).getByRole('menuitem', {name: 'Delete Profile'}));
    expect(onDeleteProfile).toHaveBeenCalledWith(expect.objectContaining({name: 'auto'}));
  });

  it('shows dismissible alerts with mapped alert classes', () => {
    const onClose = vi.fn();

    const {container} = render(
      <OptionsAlert
        alert={{
          message: 'Profile download failed.',
          type: 'error'
        }}
        onClose={onClose}
        shown={true}
      />
    );

    expect(screen.getByText('Profile download failed.')).toBeTruthy();
    expect(container.querySelector('.alert')?.classList.contains('alert-danger')).toBe(true);

    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(onClose).toHaveBeenCalled();
  });
});
