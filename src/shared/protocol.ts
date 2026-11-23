/**
 * The protocol between the widget and a relay (DESIGN §4). A request is JSON;
 * a reply is a stream of named server-sent events. Any backend that follows
 * it can serve the widget.
 *
 * The widget bundles this file, so keep it small.
 */

export type Role = 'user' | 'assistant';

export type ChatMessage = { role: Role; content: string };

/** The POST body. The last message is the visitor's. */
export type ChatRequest = { messages: ChatMessage[] };

/** Why a reply ended. */
export type EndReason = 'stop' | 'length' | 'refusal';

/** Error codes a relay sends, as a status code or inside the stream. */
export type ErrorCode =
  | 'bad_request'
  | 'forbidden_origin'
  | 'method_not_allowed'
  | 'too_large'
  | 'rate_limited'
  | 'upstream_error'
  | 'internal';

export type StreamEvent =
  | { event: 'delta'; data: { text: string } }
  | { event: 'done'; data: { reason: EndReason } }
  | { event: 'error'; data: { code: ErrorCode; message: string } };

/** One server-sent event in the wire format. */
export const encodeEvent = ({ event, data }: StreamEvent) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** A comment line that keeps idle connections open; parsers ignore it. */
export const KEEP_ALIVE = ': keep-alive\n\n';

/**
 * Splits a server-sent event stream into events, however the text arrives in
 * chunks. Follows the parts of the SSE format a relay uses: `event:` and
 * `data:` fields, several `data:` lines joined with "\n", comment lines,
 * and LF, CRLF or CR line ends.
 *
 * `push` takes decoded text; `end` flushes an event the stream did not close
 * with a blank line.
 */
export const createEventParser = (
  onEvent: (name: string, data: string) => void
) => {
  let buffer = '';
  let name = '';
  let data: string[] = [];

  const dispatch = () => {
    if (data.length) onEvent(name || 'message', data.join('\n'));
    name = '';
    data = [];
  };

  const line = (text: string) => {
    if (!text) return dispatch();
    if (text[0] === ':') return;
    const colon = text.indexOf(':');
    const field = colon < 0 ? text : text.slice(0, colon);
    let value = colon < 0 ? '' : text.slice(colon + 1);
    if (value[0] === ' ') value = value.slice(1);
    if (field === 'event') name = value;
    else if (field === 'data') data.push(value);
  };

  // Runs every complete line and keeps the unfinished one in `buffer`.
  const drain = () => {
    const lines = buffer.split(/\r\n|\r|\n/);
    buffer = lines.pop() || '';
    lines.forEach(line);
  };

  return {
    push(chunk: string) {
      // A final "\r" may be the first half of "\r\n": hold it back until the
      // next chunk shows whether "\n" follows.
      buffer += chunk;
      const held = buffer.endsWith('\r');
      if (held) buffer = buffer.slice(0, -1);
      drain();
      if (held) buffer += '\r';
    },
    end() {
      drain();
      if (buffer) line(buffer);
      buffer = '';
      dispatch();
    },
  };
};

/** Reads a response body to the end, calling `onEvent` for each event. */
export const readEventStream = async (
  body: ReadableStream<Uint8Array>,
  onEvent: (name: string, data: string) => void
) => {
  const parser = createEventParser(onEvent);
  const reader = body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.push(decoder.decode());
  parser.end();
};
