// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {ConfirmModal} from '../src/react/confirm_modals';
import type {Options} from '../src/react/options_client';
import type {Profile} from '../src/react/profile_widgets';

function installChromeMock() {
  (globalThis as any).chrome = {
    i18n: {
      getMessage: () => ''
    }
  };
}

function profile(name: string, profileType = 'FixedProfile'): Profile {
  return {
    name,
    profileType
  };
}

function optionsFixture(): Options {
  return {
    '+new': {
      name: 'new',
      profileType: 'PacProfile'
    },
    '+old': {
      name: 'old',
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

describe('confirm modal components', () => {
  it('confirms or cancels applying options', () => {
    const onClose = vi.fn();
    const onDismiss = vi.fn();

    render(
      <ConfirmModal
        kind="apply"
        onClose={onClose}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('Apply Options')).toBeTruthy();
    expect(screen.getByText('Your changes to the options must be applied before you proceed.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));
    expect(onClose).toHaveBeenCalledWith('ok');

    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('lists referring profiles without rendering a destructive close action', () => {
    const onDismiss = vi.fn();

    render(
      <ConfirmModal
        kind="cannotDeleteProfile"
        onDismiss={onDismiss}
        profile={profile('proxy')}
        refs={[
          profile('auto', 'SwitchProfile'),
          profile('rules', 'RuleListProfile')
        ]}
      />
    );

    expect(screen.getByText('Unable to Delete Profile')).toBeTruthy();
    expect(screen.getByText('auto')).toBeTruthy();
    expect(screen.getByText('rules')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'Delete Profile'})).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('returns selected profile names when replacing profiles', () => {
    const onClose = vi.fn();

    render(
      <ConfirmModal
        fromName="old"
        kind="replaceProfile"
        onClose={onClose}
        options={optionsFixture()}
        toName="new"
      />
    );

    expect(screen.getByRole('heading', {name: 'Replace Profile'})).toBeTruthy();
    expect(screen.getByText(/Do you really want to replace/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', {name: 'Replace Profile'}));

    expect(onClose).toHaveBeenCalledWith({
      fromName: 'old',
      toName: 'new'
    });
  });
});
