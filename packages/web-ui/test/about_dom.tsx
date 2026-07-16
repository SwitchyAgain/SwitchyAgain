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
    const {container} = render(<About embedded onDownloadLog={onDownloadLog} onResetOptions={onResetOptions} version="1.2.3" />);

    expect(screen.getByRole('heading', {name: 'About'})).toBeTruthy();
    expect(container.textContent).toContain('Version 1.2.3');
    expect((container.querySelector('img.media-object') as HTMLImageElement).getAttribute('src')).toBe('img/icons/app-icon-32.png');

    fireEvent.click(screen.getByRole('button', {name: 'Save error log'}));
    expect(onDownloadLog).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {name: 'Reset options'}));
    expect(onResetOptions).toHaveBeenCalled();
  });
});
