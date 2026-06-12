// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {OptionsAlert, OptionsShell} from '../src/react/options_shell';
import type {Options} from '../src/react/options_client';

function installChromeMock() {
  (globalThis as any).chrome = {
    i18n: {
      getMessage: () => ''
    }
  };
}

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

beforeEach(() => {
  installChromeMock();
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

  it('keeps discard disabled when there are no dirty options', () => {
    const onDiscard = vi.fn();

    const {container} = render(<OptionsShell onDiscard={onDiscard} options={optionsFixture()} optionsDirty={false} />);

    const discardButton = screen.getByRole('button', {name: 'Discard changes'});
    fireEvent.click(discardButton);

    expect(onDiscard).not.toHaveBeenCalled();
    expect(container.querySelector('.disabled .text-danger')).toBe(discardButton);
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
