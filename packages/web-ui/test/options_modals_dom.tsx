// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {WelcomeModal} from '../src/react/options_modals';

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

describe('options modal components', () => {
  it('renders upgrade welcome content and reports guide choices', () => {
    const onClose = vi.fn();
    const onDismiss = vi.fn();

    render(<WelcomeModal onClose={onClose} onDismiss={onDismiss} upgrade />);

    expect(screen.getByRole('heading', {name: 'Welcome to SwitchyAgain'})).toBeTruthy();
    expect(
      screen.getByText("You have successfully upgraded to SwitchyAgain. Don't panic, your existing options are fully preserved.")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(onDismiss).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {name: 'Skip guide'}));
    expect(onClose).toHaveBeenCalledWith('skip');

    fireEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(onClose).toHaveBeenCalledWith('show');
  });
});
