import type { MiddleStateWDom } from 'lithent';

/**
 * The small Markdown subset model replies use (DESIGN §3.6), turned into
 * lithent nodes. Text only ever becomes text nodes: there is no innerHTML,
 * so HTML in a reply shows as written, and links accept http(s) and mailto
 * only. An unclosed code fence runs to the end, which keeps a code block
 * steady while it streams in.
 */

type Node = MiddleStateWDom;

const FENCE = /^\s*```/;
const HEADING = /^#{1,3}\s+/;
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;
const SAFE_URL = /^(?:https?:|mailto:)/i;
// 1 code · 2 bold · 3 link text, 4 link url (one level of parentheses
// allowed, as in Wikipedia URLs) · 5 before italic, 6 italic
const INLINE =
  /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|\[([^\]\n]+)\]\(((?:[^\s()]|\([^\s()]*\))+)\)|(^|[\s(])[*_]([^*_\n]+?)[*_](?=$|[\s.,!?;:)])/g;

export const inline = (text: string): Node[] => {
  const out: Node[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index! + (m[5] || '').length;
    out.push(text.slice(last, start));
    last = m.index! + m[0].length;
    if (m[1]) out.push(<code>{m[1]}</code>);
    else if (m[2]) out.push(<strong>{m[2]}</strong>);
    else if (m[3]) {
      out.push(
        SAFE_URL.test(m[4]) ? (
          <a href={m[4]} target="_blank" rel="noopener noreferrer nofollow">
            {m[3]}
          </a>
        ) : (
          m[3]
        )
      );
    } else out.push(<em>{m[6]}</em>);
  }
  out.push(text.slice(last));
  return out.filter(part => part !== '');
};

export const markdown = (source: string): Node[] => {
  const lines = source.split('\n');
  const blocks: Node[] = [];
  let i = 0;
  const plain = (line: string) =>
    line.trim() && !FENCE.test(line) && !HEADING.test(line) && !ITEM.test(line);

  while (i < lines.length) {
    const line = lines[i];
    if (FENCE.test(line)) {
      const code: string[] = [];
      while (++i < lines.length && !FENCE.test(lines[i])) code.push(lines[i]);
      i++;
      blocks.push(
        <pre>
          <code>{code.join('\n')}</code>
        </pre>
      );
    } else if (HEADING.test(line)) {
      blocks.push(
        <p>
          <strong>{inline(line.replace(HEADING, ''))}</strong>
        </p>
      );
      i++;
    } else if (ITEM.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: Node[] = [];
      while (i < lines.length && ITEM.test(lines[i])) {
        items.push(<li>{inline(lines[i++].replace(ITEM, ''))}</li>);
      }
      blocks.push(ordered ? <ol>{items}</ol> : <ul>{items}</ul>);
    } else if (line.trim()) {
      const text: string[] = [];
      while (i < lines.length && plain(lines[i])) text.push(lines[i++]);
      blocks.push(<p>{inline(text.join('\n'))}</p>);
    } else i++;
  }
  return blocks;
};
