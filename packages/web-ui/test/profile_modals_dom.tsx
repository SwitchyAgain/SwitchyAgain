// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {NewProfileModal, ProxyAuthModal, RenameProfileModal} from '../src/react/profile_modals';
import type {Profile} from '../src/react/profile_widgets';

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

describe('profile modal components', () => {
  it('blocks conflicting rename values and submits valid names', () => {
    const onClose = vi.fn();
    const profileByName = (name: string): Profile | null => {
      return name === 'taken'
        ? {
            name: 'taken',
            profileType: 'FixedProfile'
          }
        : null;
    };

    render(<RenameProfileModal fromName="old" onClose={onClose} profileByName={profileByName} />);

    const nameInput = screen.getByLabelText('New profile name');
    const submitButton = screen.getByRole('button', {name: 'Rename'}) as HTMLButtonElement;

    fireEvent.change(nameInput, {
      target: {
        value: 'taken'
      }
    });

    expect(screen.getByText('A profile with this name already exists.')).toBeTruthy();
    expect(submitButton.disabled).toBe(true);

    fireEvent.change(nameInput, {
      target: {
        value: 'new'
      }
    });
    fireEvent.click(submitButton);

    expect(onClose).toHaveBeenCalledWith('new');
  });

  it('creates a new profile with the selected type', () => {
    const onClose = vi.fn();

    render(<NewProfileModal onClose={onClose} />);

    const createButton = screen.getByRole('button', {name: 'Create'}) as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Profile name'), {
      target: {
        value: 'auto'
      }
    });
    fireEvent.click(screen.getByRole('radio', {name: /Switch Profile/}));
    fireEvent.click(createButton);

    expect(onClose).toHaveBeenCalledWith({
      name: 'auto',
      profileType: 'SwitchProfile'
    });
  });

  it('shows duplicate as a disabled final option when no profiles can be copied', () => {
    render(<NewProfileModal duplicatableProfiles={[]} />);

    const duplicateOption = screen.getByRole('radio', {name: /Duplicate/}) as HTMLInputElement;
    const allOptions = screen.getAllByRole('radio') as HTMLInputElement[];

    expect(duplicateOption.disabled).toBe(true);
    expect(allOptions[allOptions.length - 1]).toBe(duplicateOption);
    expect(screen.getByText('No profiles available to duplicate.')).toBeTruthy();
    expect(screen.queryByRole('listbox', {name: 'Profile'})).toBeNull();
  });

  it('duplicates an existing profile after selecting a source profile', () => {
    const onClose = vi.fn();

    render(
      <NewProfileModal
        duplicatableProfiles={[
          {
            name: 'proxy',
            profileType: 'FixedProfile'
          },
          {
            name: 'auto',
            profileType: 'SwitchProfile'
          }
        ]}
        onClose={onClose}
      />
    );

    const createButton = screen.getByRole('button', {name: 'Create'}) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText('Profile name'), {
      target: {
        value: 'proxy-copy'
      }
    });
    fireEvent.click(screen.getByRole('radio', {name: /Duplicate/}));

    expect(createButton.disabled).toBe(true);
    expect(screen.getByText('Please select a profile to duplicate.')).toBeTruthy();

    const sourcePicker = screen.getByRole('listbox', {name: 'Profile'});
    expect(sourcePicker.closest('.profile-duplicate-source')).toBeTruthy();
    expect(screen.getByText('Select a profile')).toBeTruthy();

    fireEvent.click(sourcePicker);
    const proxyOption = screen.getByRole('option', {name: /proxy/});
    expect(proxyOption.querySelector('.glyphicon-globe')).toBeTruthy();
    fireEvent.click(proxyOption.querySelector('a') as HTMLAnchorElement);
    fireEvent.click(createButton);

    expect(onClose).toHaveBeenCalledWith({
      duplicateProfileName: 'proxy',
      name: 'proxy-copy'
    });
  });

  it('edits proxy authentication and toggles password visibility', () => {
    const onClose = vi.fn();

    render(
      <ProxyAuthModal
        auth={{
          password: 'pass',
          username: 'user'
        }}
        onClose={onClose}
      />
    );

    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    fireEvent.click(screen.getByTitle('Show password'));
    expect(passwordInput.type).toBe('text');

    fireEvent.change(usernameInput, {
      target: {
        value: 'next-user'
      }
    });
    fireEvent.change(passwordInput, {
      target: {
        value: 'next-pass'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(onClose).toHaveBeenCalledWith({
      password: 'next-pass',
      username: 'next-user'
    });
  });
});
