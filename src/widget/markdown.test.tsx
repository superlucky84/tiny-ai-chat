// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'lithent';
import { markdown } from './markdown';

let destroy: (() => void) | undefined;
afterEach(() => destroy?.());

const html = (source: string) => {
  const box = document.createElement('div');
  destroy = render(<div>{markdown(source)}</div>, box);
  return (box.firstElementChild as HTMLElement).innerHTML;
};

describe('markdown', () => {
  it.each([
    ['a paragraph', 'Hello', '<p>Hello</p>'],
    ['line breaks inside a paragraph', 'one\ntwo', '<p>one\ntwo</p>'],
    ['paragraphs split by blank lines', 'one\n\ntwo', '<p>one</p><p>two</p>'],
    ['bold', 'a **b** c', '<p>a <strong>b</strong> c</p>'],
    [
      'italic with * and _',
      '*a* and _b_.',
      '<p><em>a</em> and <em>b</em>.</p>',
    ],
    [
      'snake_case left alone',
      'use my_var_name here',
      '<p>use my_var_name here</p>',
    ],
    ['inline code', 'run `npm i`', '<p>run <code>npm i</code></p>'],
    ['markdown inside code left alone', '`**x**`', '<p><code>**x**</code></p>'],
    [
      'a link',
      '[docs](https://example.com/a?b=1)',
      '<p><a href="https://example.com/a?b=1" target="_blank" rel="noopener noreferrer nofollow">docs</a></p>',
    ],
    [
      'a link with parentheses',
      '[Foo](https://en.wikipedia.org/wiki/Foo_(bar)).',
      '<p><a href="https://en.wikipedia.org/wiki/Foo_(bar)" target="_blank" rel="noopener noreferrer nofollow">Foo</a>.</p>',
    ],
    [
      'a mailto link',
      '[mail](mailto:a@b.c)',
      '<p><a href="mailto:a@b.c" target="_blank" rel="noopener noreferrer nofollow">mail</a></p>',
    ],
    [
      'headings as bold paragraphs',
      '## Title',
      '<p><strong>Title</strong></p>',
    ],
    [
      'a bullet list',
      '- a\n* b\n+ c',
      '<ul><li>a</li><li>b</li><li>c</li></ul>',
    ],
    ['a numbered list', '1. a\n2) b', '<ol><li>a</li><li>b</li></ol>'],
    [
      'a list after a paragraph',
      'Steps:\n- a',
      '<p>Steps:</p><ul><li>a</li></ul>',
    ],
    [
      'a code block, keeping its text',
      '```js\nconst a = 1 < 2;\n  **x**\n```\nafter',
      '<pre><code>const a = 1 &lt; 2;\n  **x**</code></pre><p>after</p>',
    ],
    [
      'an unclosed code block while streaming',
      'Look:\n```\nline 1\nline',
      '<p>Look:</p><pre><code>line 1\nline</code></pre>',
    ],
  ])('renders %s', (_name, source, expected) => {
    expect(html(source)).toBe(expected);
  });

  it('renders nothing for an empty reply', () => {
    expect(html('')).toBe('');
    expect(html('\n\n')).toBe('');
  });
});

describe('markdown safety', () => {
  it.each([
    ['a script tag', '<script>alert(1)</script>'],
    ['an image with onerror', '<img src=x onerror="alert(1)">'],
    ['an iframe', '<iframe src="https://evil.example"></iframe>'],
    ['HTML inside a code block', '```\n<b onclick="x()">hi</b>\n```'],
  ])('shows %s as text, never as elements', (_name, source) => {
    const box = document.createElement('div');
    destroy = render(<div>{markdown(source)}</div>, box);
    const root = box.firstElementChild!;
    expect(root.querySelector('script, img, iframe, b')).toBeNull();
    expect(root.textContent).toContain(source.replace(/```\n?/g, '').trim());
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//evil.example',
    '/relative',
  ])('keeps the text but drops a link to %s', url => {
    const box = document.createElement('div');
    destroy = render(<div>{markdown(`[click](${url})`)}</div>, box);
    const root = box.firstElementChild!;
    expect(root.querySelector('a')).toBeNull();
    expect(root.textContent).toBe('click');
  });

  it('cannot break out of an attribute through a link URL', () => {
    const box = document.createElement('div');
    destroy = render(
      <div>{markdown('[x](https://a.example/"onmouseover="alert(1))')}</div>,
      box
    );
    const link = box.querySelector('a')!;
    expect(link.getAttributeNames().sort()).toEqual(['href', 'rel', 'target']);
  });
});

describe('markdown on hostile input', () => {
  it.each([
    ['many asterisks', '*'.repeat(20000)],
    ['unclosed bold runs', '**a '.repeat(5000)],
    ['unclosed links', '[a]('.repeat(5000)],
    ['nested brackets', '['.repeat(5000) + ']'.repeat(5000)],
    ['backticks', '`'.repeat(20000)],
    ['underscores and spaces', ' _a'.repeat(7000)],
    ['parentheses in a link URL', `[x](${'('.repeat(5000)}`],
    ['one long line', 'word '.repeat(40000)],
    ['many list items', '- item\n'.repeat(5000)],
    ['an unclosed fence with long text', '```\n' + 'code\n'.repeat(20000)],
  ])('stays fast on %s', (_name, source) => {
    const start = performance.now();
    markdown(source);
    expect(performance.now() - start).toBeLessThan(250);
  });
});
