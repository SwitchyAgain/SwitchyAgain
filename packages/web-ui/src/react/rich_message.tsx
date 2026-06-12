import React from 'react';
import {message} from './options_client';

type RichFrame = {
  children: React.ReactNode[];
  props?: Record<string, string>;
  tag: 'root' | 'a' | 'code' | 'strong';
};

const TAG_RE = /<\s*(\/?)\s*([a-zA-Z][\w-]*)([^>]*)>/g;

function decodeEntity(entity: string) {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: '\u00a0',
    quot: '"'
  };
  if (entity[0] === '#') {
    const radix = entity[1]?.toLowerCase() === 'x' ? 16 : 10;
    const value = parseInt(entity.slice(radix === 16 ? 2 : 1), radix);
    return Number.isFinite(value) ? String.fromCodePoint(value) : `&${entity};`;
  }
  return named[entity] || `&${entity};`;
}

function decodeEntities(text: string) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][\w-]*);/g, (_match, entity: string) => decodeEntity(entity));
}

function safeHref(value: string) {
  const href = decodeEntities(value).trim();
  return /^(https?:|mailto:|#|\/)/i.test(href) ? href : '#';
}

function hrefFromAttributes(attrs: string) {
  const match = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  return match ? safeHref(match[1] || match[2] || match[3] || '') : '#';
}

function appendText(frame: RichFrame, text: string) {
  if (text) {
    frame.children.push(decodeEntities(text));
  }
}

function renderFrame(frame: RichFrame, key: string) {
  switch (frame.tag) {
    case 'a':
      return (
        <a key={key} href={frame.props?.href || '#'} target="_blank" rel="noreferrer">
          {frame.children}
        </a>
      );
    case 'code':
      return <code key={key}>{frame.children}</code>;
    case 'strong':
      return <strong key={key}>{frame.children}</strong>;
    default:
      return <React.Fragment key={key}>{frame.children}</React.Fragment>;
  }
}

function closeFrame(stack: RichFrame[], key: string) {
  if (stack.length <= 1) {
    return;
  }
  const frame = stack.pop();
  if (frame) {
    stack[stack.length - 1].children.push(renderFrame(frame, key));
  }
}

export function renderRichText(text: string) {
  const root: RichFrame = {tag: 'root', children: []};
  const stack: RichFrame[] = [root];
  let lastIndex = 0;
  let keyIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_RE.exec(text))) {
    appendText(stack[stack.length - 1], text.slice(lastIndex, match.index));
    lastIndex = TAG_RE.lastIndex;

    const closing = !!match[1];
    const tag = match[2].toLowerCase();
    const attrs = match[3] || '';
    const selfClosing = /\/\s*$/.test(attrs);

    if (closing) {
      if ((tag === 'b' || tag === 'strong') && stack[stack.length - 1].tag === 'strong') {
        closeFrame(stack, `rich-${keyIndex++}`);
      } else if ((tag === 'code' || tag === 'a') && stack[stack.length - 1].tag === tag) {
        closeFrame(stack, `rich-${keyIndex++}`);
      }
      continue;
    }

    if (tag === 'br') {
      stack[stack.length - 1].children.push(<br key={`rich-${keyIndex++}`} />);
      continue;
    }

    if (tag === 'b' || tag === 'strong') {
      stack.push({tag: 'strong', children: []});
      if (selfClosing) {
        closeFrame(stack, `rich-${keyIndex++}`);
      }
      continue;
    }

    if (tag === 'code') {
      stack.push({tag: 'code', children: []});
      if (selfClosing) {
        closeFrame(stack, `rich-${keyIndex++}`);
      }
      continue;
    }

    if (tag === 'a') {
      stack.push({tag: 'a', props: {href: hrefFromAttributes(attrs)}, children: []});
      if (selfClosing) {
        closeFrame(stack, `rich-${keyIndex++}`);
      }
    }
  }

  appendText(stack[stack.length - 1], text.slice(lastIndex));
  while (stack.length > 1) {
    closeFrame(stack, `rich-${keyIndex++}`);
  }
  return root.children;
}

export function richMessage(key: string, fallback = key, substitutions?: string | string[]) {
  return renderRichText(message(key, fallback, substitutions));
}
