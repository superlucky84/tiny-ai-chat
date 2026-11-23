import { describe, expect, it } from 'vitest';
import {
  createEventParser,
  encodeEvent,
  KEEP_ALIVE,
  readEventStream,
  type StreamEvent,
} from './protocol';

type Parsed = [name: string, data: string];

const parse = (chunks: string[]) => {
  const events: Parsed[] = [];
  const parser = createEventParser((name, data) => events.push([name, data]));
  chunks.forEach(chunk => parser.push(chunk));
  parser.end();
  return events;
};

const sample: StreamEvent[] = [
  { event: 'delta', data: { text: 'Hello, ' } },
  { event: 'delta', data: { text: 'wörld 👋\n\nnew paragraph' } },
  { event: 'done', data: { reason: 'stop' } },
];
const wire = sample.map(encodeEvent).join(KEEP_ALIVE);
const expected: Parsed[] = sample.map(e => [e.event, JSON.stringify(e.data)]);

describe('encodeEvent', () => {
  it('writes a named event with JSON data and a blank line', () => {
    expect(encodeEvent({ event: 'done', data: { reason: 'length' } })).toBe(
      'event: done\ndata: {"reason":"length"}\n\n'
    );
  });

  it('keeps newlines in the text inside the JSON, on one data line', () => {
    const text = encodeEvent({ event: 'delta', data: { text: 'a\nb\r\nc' } });
    expect(text.split('\n')).toHaveLength(4);
  });
});

describe('createEventParser', () => {
  it('reads what encodeEvent writes, skipping keep-alive comments', () => {
    expect(parse([wire])).toEqual(expected);
  });

  it('gives the same events however the stream is cut into chunks', () => {
    for (let size = 1; size <= 12; size++) {
      const chunks: string[] = [];
      for (let i = 0; i < wire.length; i += size) {
        chunks.push(wire.slice(i, i + size));
      }
      expect(parse(chunks)).toEqual(expected);
    }
  });

  it('accepts CRLF and CR line ends, even when a CRLF is split', () => {
    const crlf = wire.replace(/\n/g, '\r\n');
    expect(parse([crlf])).toEqual(expected);
    expect(parse([wire.replace(/\n/g, '\r')])).toEqual(expected);
    const cut = crlf.indexOf('\r\n') + 1;
    expect(parse([crlf.slice(0, cut), crlf.slice(cut)])).toEqual(expected);
  });

  it('joins several data lines and defaults the name to "message"', () => {
    expect(parse(['data: one\ndata:two\n\n'])).toEqual([
      ['message', 'one\ntwo'],
    ]);
  });

  it('ignores unknown fields and events without data', () => {
    expect(
      parse(['id: 7\nretry: 10\nevent: x\n\nevent: y\ndata: 1\n\n'])
    ).toEqual([['y', '1']]);
  });

  it('flushes a last event the stream did not end with a blank line', () => {
    expect(parse(['event: done\ndata: {}'])).toEqual([['done', '{}']]);
  });
});

describe('readEventStream', () => {
  it('decodes UTF-8 split across network chunks', async () => {
    const bytes = new TextEncoder().encode(wire);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 5) {
          controller.enqueue(bytes.slice(i, i + 5));
        }
        controller.close();
      },
    });
    const events: Parsed[] = [];
    await readEventStream(body, (name, data) => events.push([name, data]));
    expect(events).toEqual(expected);
  });
});
