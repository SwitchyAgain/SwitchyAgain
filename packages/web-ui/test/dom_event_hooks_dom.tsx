// @vitest-environment jsdom

import React, {useRef} from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {useOutsidePointer, useWindowEvent} from '../src/react/dom_event_hooks';

afterEach(() => {
  cleanup();
});

function WindowKeyHarness({enabled = true, onKey}: {enabled?: boolean; onKey: (event: KeyboardEvent) => void}) {
  useWindowEvent('keydown', onKey, undefined, enabled);
  return null;
}

function OutsidePointerHarness({enabled = true, onOutside}: {enabled?: boolean; onOutside: (event: MouseEvent | TouchEvent) => void}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useOutsidePointer(rootRef, onOutside, enabled);
  return (
    <div>
      <div ref={rootRef} data-testid="inside">
        Inside
      </div>
      <button type="button">Outside</button>
    </div>
  );
}

describe('DOM event hooks', () => {
  it('binds window events only while enabled and removes them on unmount', () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const {rerender, unmount} = render(<WindowKeyHarness onKey={firstHandler} />);

    fireEvent.keyDown(window, {key: 'a'});
    expect(firstHandler).toHaveBeenCalledTimes(1);

    rerender(<WindowKeyHarness onKey={secondHandler} />);
    fireEvent.keyDown(window, {key: 'b'});
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(1);

    rerender(<WindowKeyHarness enabled={false} onKey={secondHandler} />);
    fireEvent.keyDown(window, {key: 'c'});
    expect(secondHandler).toHaveBeenCalledTimes(1);

    rerender(<WindowKeyHarness onKey={secondHandler} />);
    fireEvent.keyDown(window, {key: 'd'});
    expect(secondHandler).toHaveBeenCalledTimes(2);

    unmount();
    fireEvent.keyDown(window, {key: 'e'});
    expect(secondHandler).toHaveBeenCalledTimes(2);
  });

  it('calls outside pointer handlers for external mouse and touch targets only', () => {
    const onOutside = vi.fn();
    const {rerender} = render(<OutsidePointerHarness onOutside={onOutside} />);

    fireEvent.mouseDown(screen.getByTestId('inside'));
    expect(onOutside).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole('button', {name: 'Outside'}));
    expect(onOutside).toHaveBeenCalledTimes(1);

    fireEvent.touchStart(document.body);
    expect(onOutside).toHaveBeenCalledTimes(2);

    rerender(<OutsidePointerHarness enabled={false} onOutside={onOutside} />);
    fireEvent.mouseDown(screen.getByRole('button', {name: 'Outside'}));
    expect(onOutside).toHaveBeenCalledTimes(2);
  });
});
