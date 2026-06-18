import {useEffect, useRef} from 'react';
import type {RefObject} from 'react';

type EventOptions = boolean | AddEventListenerOptions;

export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: EventOptions,
  enabled = true
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const listener = (event: WindowEventMap[K]) => handlerRef.current(event);
    window.addEventListener(type, listener as EventListener, options);
    return () => window.removeEventListener(type, listener as EventListener, options);
  }, [enabled, options, type]);
}

export function useDocumentEvent<K extends keyof DocumentEventMap>(
  type: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: EventOptions,
  enabled = true
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const listener = (event: DocumentEventMap[K]) => handlerRef.current(event);
    document.addEventListener(type, listener as EventListener, options);
    return () => document.removeEventListener(type, listener as EventListener, options);
  }, [enabled, options, type]);
}

export function useOutsidePointer<T extends HTMLElement>(
  rootRef: RefObject<T | null>,
  onOutside: (event: MouseEvent | TouchEvent) => void,
  enabled = true
) {
  const handler = (event: MouseEvent | TouchEvent) => {
    const target = event.target;
    if (target instanceof Node && rootRef.current?.contains(target)) {
      return;
    }
    onOutside(event);
  };
  useDocumentEvent('mousedown', handler, undefined, enabled);
  useDocumentEvent('touchstart', handler, undefined, enabled);
}

