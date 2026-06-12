import React from 'react';
import {renderRichText} from '../src/react/rich_message';

function elementAt(nodes: React.ReactNode[], index: number) {
  const node = nodes[index];
  if (!React.isValidElement(node)) {
    throw new Error(`Expected React element at index ${index}.`);
  }
  return node as React.ReactElement<Record<string, unknown>>;
}

function childrenOf(element: React.ReactElement<Record<string, unknown>>) {
  return element.props.children as React.ReactNode[];
}

describe('rich message rendering', () => {
  it('decodes text entities and renders supported inline tags', () => {
    const nodes = renderRichText('Use <b>bold &amp; <code>x&lt;y</code></b><br/>now');

    expect(nodes[0]).toBe('Use ');

    const strong = elementAt(nodes, 1);
    const strongChildren = childrenOf(strong);
    expect(strong.type).toBe('strong');
    expect(strongChildren).toHaveLength(2);
    expect(strongChildren[0]).toBe('bold & ');

    const code = strongChildren[1] as React.ReactElement<Record<string, unknown>>;
    expect(code.type).toBe('code');
    expect(code.props.children).toEqual(['x<y']);

    expect(elementAt(nodes, 2).type).toBe('br');
    expect(nodes[3]).toBe('now');
  });

  it('keeps safe links and neutralizes unsafe links', () => {
    const nodes = renderRichText(
      [
        '<a href="https://example.com/?a=1&amp;b=2">safe</a>',
        ' ',
        '<a href="javascript:alert(1)">unsafe</a>',
        ' ',
        '<a href="/options.html">relative</a>'
      ].join('')
    );

    const safe = elementAt(nodes, 0);
    expect(safe.type).toBe('a');
    expect(safe.props.href).toBe('https://example.com/?a=1&b=2');
    expect(safe.props.target).toBe('_blank');
    expect(safe.props.rel).toBe('noreferrer');

    const unsafe = elementAt(nodes, 2);
    expect(unsafe.props.href).toBe('#');

    const relative = elementAt(nodes, 4);
    expect(relative.props.href).toBe('/options.html');
  });

  it('leaves unsupported tags as decoded text content', () => {
    expect(renderRichText('Hello <em>world</em> &quot;ok&quot;')).toEqual(['Hello ', 'world', ' "ok"']);
  });
});
