// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {OptionsGuide} from '../src/react/options_guide';

function installTarget(selectorClass: string, attrs: Record<string, string> = {}) {
  const target = document.createElement('div');
  target.className = selectorClass;
  for (const [key, value] of Object.entries(attrs)) {
    target.setAttribute(key, value);
  }
  target.scrollIntoView = vi.fn();
  target.getBoundingClientRect = () =>
    ({
      bottom: 40,
      height: 30,
      left: 10,
      right: 50,
      top: 10,
      width: 40,
      x: 10,
      y: 10,
      toJSON: () => ({})
    }) as DOMRect;
  document.body.appendChild(target);
  return target;
}

afterEach(() => {
  cleanup();
  document.body.className = '';
  document.body.removeAttribute('data-options-guide-step');
  document.body.innerHTML = '';
});

beforeEach(() => {
  window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
});

describe('OptionsGuide', () => {
  it('highlights the active target and reports next or skip actions', async () => {
    const target = installTarget('nav-profile', {'data-profile-type': 'FixedProfile'});
    const onNext = vi.fn();
    const onSkip = vi.fn();
    const {unmount} = render(<OptionsGuide guide={{kind: 'options', stepIndex: 0}} onNext={onNext} onSkip={onSkip} />);

    await waitFor(() => expect(document.body.classList.contains('options-guide-active')).toBe(true));
    expect(document.body.getAttribute('data-options-guide-step')).toBe('fixed-profile-step');
    expect(target.classList.contains('options-guide-target')).toBe(true);
    expect(screen.getByRole('dialog').textContent).toContain('Proxy Profile');
    expect(screen.getByRole('dialog').querySelector('strong')?.textContent).toBe('Proxy Profile');
    expect(screen.getByRole('dialog').querySelectorAll('br')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(onNext).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {name: 'Skip guide'}));
    expect(onSkip).toHaveBeenCalled();

    unmount();
    expect(document.body.classList.contains('options-guide-active')).toBe(false);
    expect(target.classList.contains('options-guide-target')).toBe(false);
  });

  it('uses the done action on the last guide step', async () => {
    const onDone = vi.fn();
    render(<OptionsGuide guide={{kind: 'switch', stepIndex: 4}} onDone={onDone} />);

    await waitFor(() => expect(document.body.getAttribute('data-options-guide-step')).toBe('apply-switch-profile-step'));
    expect(screen.queryByRole('button', {name: 'Skip guide'})).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: 'Done'}));
    expect(onDone).toHaveBeenCalled();
  });
});
