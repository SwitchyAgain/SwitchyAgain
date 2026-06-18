// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {About} from '../src/react/about';

afterEach(() => {
  cleanup();
});

describe('about component', () => {
  it('renders product details and dispatches maintenance actions', () => {
    const onDownloadLog = vi.fn();
    const onResetOptions = vi.fn();
    const {container} = render(
      <About embedded isExperimental onDownloadLog={onDownloadLog} onResetOptions={onResetOptions} version="1.2.3" />
    );

    expect(screen.getByRole('heading', {name: 'About'})).toBeTruthy();
    expect(
      screen.getByText('Mozilla Firefox support is highly experimental! If you encounter issues, please report using the buttons below.')
    ).toBeTruthy();
    expect(container.textContent).toContain('Version 1.2.3');
    expect((container.querySelector('img.media-object') as HTMLImageElement).getAttribute('src')).toBe('img/icons/omega-32.png');

    fireEvent.click(screen.getByRole('button', {name: 'Error log'}));
    expect(onDownloadLog).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {name: 'Reset'}));
    expect(onResetOptions).toHaveBeenCalled();
  });
});
