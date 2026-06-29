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

    const hiddenProfiles = screen.getByRole('button', {name: 'Hidden Profiles'});
    expect(hiddenProfiles.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', {name: /auto/})).toBeNull();

    fireEvent.click(hiddenProfiles);

    expect(hiddenProfiles.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', {name: /auto/})).toBeTruthy();
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
