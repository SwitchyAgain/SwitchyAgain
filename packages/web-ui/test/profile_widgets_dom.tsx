// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {ProfileInline, ProfileSelect} from '../src/react/profile_widgets';
import type {Profile} from '../src/react/profile_widgets';

function installChromeMock() {
  (globalThis as any).chrome = {
    i18n: {
      getMessage(key: string) {
        return key === 'profile_direct' ? 'Direct' : '';
      }
    }
  };
}

const profiles: Profile[] = [
  {
    name: 'proxy',
    profileType: 'FixedProfile'
  },
  {
    name: 'pac',
    profileType: 'PacProfile'
  }
];

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  installChromeMock();
});

describe('profile widget components', () => {
  it('renders inline profile labels with localized builtin names', () => {
    const {container} = render(
      <>
        <ProfileInline
          profile={{
            builtin: true,
            name: 'direct',
            profileType: 'DirectProfile'
          }}
        />
        <ProfileInline profile={profiles[0]} />
      </>
    );

    expect(container.textContent).toContain('Direct');
    expect(container.textContent).toContain('proxy');
  });

  it('opens profile choices and emits selected profile names', () => {
    const onChange = vi.fn();
    const {container} = render(<ProfileSelect name="proxy" onChange={onChange} profiles={profiles} />);

    fireEvent.click(screen.getByRole('listbox'));
    expect(container.querySelector('.profile-select.open')).toBeTruthy();

    fireEvent.click(screen.getByText('pac'));

    expect(onChange).toHaveBeenCalledWith('pac');
    expect(container.querySelector('.profile-select.open')).toBeNull();
  });

  it('supports default choices and closes on outside pointer input', () => {
    const onChange = vi.fn();
    const {container} = render(<ProfileSelect defaultText="Current profile" name="" onChange={onChange} profiles={profiles} />);

    fireEvent.click(screen.getByRole('listbox'));
    fireEvent.mouseDown(document.body);

    expect(container.querySelector('.profile-select.open')).toBeNull();

    fireEvent.click(screen.getByRole('listbox'));
    fireEvent.click(screen.getByRole('option', {name: 'Current profile'}).querySelector('a') as HTMLAnchorElement);

    expect(onChange).toHaveBeenCalledWith('');
  });
});
