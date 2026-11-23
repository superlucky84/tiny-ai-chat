// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'lithent/test';
import { encodeEvent, type StreamEvent } from '../shared/protocol';
import './main';

type ChatElement = HTMLElement & {
  labels?: unknown;
  headers?: unknown;
};

// ---- a fake relay -------------------------------------------------------

type Reply =
  | { events: StreamEvent[]; hold?: boolean }
  | { status: number; code: string }
  | { reject: true };

const calls: {
  url: string;
  init: RequestInit;
  body: { messages: unknown[] };
}[] = [];
let replies: Reply[] = [];

const respond = (reply: Reply, signal: AbortSignal): Promise<Response> => {
  if ('reject' in reply)
    return Promise.reject(new TypeError('Failed to fetch'));
  if ('status' in reply) {
    return Promise.resolve(
      new Response(
        JSON.stringify({ error: { code: reply.code, message: 'x' } }),
        {
          status: reply.status,
        }
      )
    );
  }
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of reply.events) {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      }
      if (!reply.hold) controller.close();
      signal.addEventListener('abort', () =>
        controller.error(new DOMException('Aborted', 'AbortError'))
      );
    },
  });
  return Promise.resolve(
    new Response(body, { headers: { 'content-type': 'text/event-stream' } })
  );
};

const delta = (text: string): StreamEvent => ({
  event: 'delta',
  data: { text },
});
const done = (reason: 'stop' | 'length' = 'stop'): StreamEvent => ({
  event: 'done',
  data: { reason },
});

beforeEach(() => {
  calls.length = 0;
  replies = [];
  sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init, body: JSON.parse(init.body as string) });
      return respond(
        replies.shift() || { events: [delta('ok'), done()] },
        init.signal!
      );
    })
  );
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

// ---- helpers ------------------------------------------------------------

const mountChat = async (attributes: Record<string, string> = {}) => {
  const el = document.createElement('tiny-ai-chat') as ChatElement;
  el.setAttribute('endpoint', '/api/chat');
  for (const [name, value] of Object.entries(attributes)) {
    el.setAttribute(name, value);
  }
  document.body.append(el);
  await act();
  return el;
};

const $ = (el: HTMLElement, selector: string) =>
  el.shadowRoot!.querySelector(selector) as HTMLElement | null;
const $$ = (el: HTMLElement, selector: string) =>
  [...el.shadowRoot!.querySelectorAll(selector)] as HTMLElement[];
const texts = (el: HTMLElement) =>
  $$(el, '.messages .msg:not(.typing)').map(node => node.textContent);

const openChat = async (el: HTMLElement) => {
  $(el, '.launcher')!.click();
  await act();
};

const type = (el: HTMLElement, value: string) => {
  const input = $(el, 'textarea') as HTMLTextAreaElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  return input;
};

const pressEnter = (input: HTMLElement, init: KeyboardEventInit = {}) =>
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ...init })
  );

const say = async (el: HTMLElement, text: string) => {
  pressEnter(type(el, text));
  await act();
};

const settle = (check: () => void) => vi.waitFor(check, { timeout: 1000 });

const record = (el: HTMLElement, name: string) => {
  const seen: unknown[] = [];
  el.addEventListener(name, event => seen.push((event as CustomEvent).detail));
  return seen;
};

// ---- tests --------------------------------------------------------------

describe('<tiny-ai-chat> launcher and panel', () => {
  it('opens and closes the panel, announcing both', async () => {
    const el = await mountChat({ heading: 'Ask us' });
    const opened = record(el, 'chat-open');
    const closed = record(el, 'chat-close');
    expect($(el, '.panel')).toBeNull();
    await openChat(el);
    const panel = $(el, '.panel')!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-label')).toBe('Ask us');
    expect($(el, '.launcher')!.getAttribute('aria-expanded')).toBe('true');
    await settle(() =>
      expect(el.shadowRoot!.activeElement).toBe($(el, 'textarea'))
    );
    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await act();
    expect($(el, '.panel')).toBeNull();
    expect(opened).toHaveLength(1);
    expect(closed).toHaveLength(1);
    await settle(() =>
      expect(el.shadowRoot!.activeElement).toBe($(el, '.launcher'))
    );
  });

  it('starts open with the open attribute and shows the greeting', async () => {
    const el = await mountChat({ open: '', greeting: 'Hi there' });
    expect(texts(el)).toEqual(['Hi there']);
  });

  it('draws the panel in place, without launcher or close, when inline', async () => {
    const el = await mountChat({ position: 'inline' });
    expect($(el, '.launcher')).toBeNull();
    expect($(el, '.panel')).not.toBeNull();
    expect($$(el, 'header button')).toHaveLength(1);
  });

  it('uses labels from the labels property', async () => {
    const el = await mountChat({ open: '' });
    el.labels = { send: '보내기', open: '채팅 열기', close: '닫기' };
    await act();
    expect($(el, 'form button')!.textContent).toBe('보내기');
    expect($(el, '.launcher')!.getAttribute('aria-label')).toBe('닫기');
  });
});

describe('<tiny-ai-chat> conversation', () => {
  it('sends the conversation and streams the reply in', async () => {
    replies = [{ events: [delta('Hel'), delta('lo!'), done()] }];
    const el = await mountChat({ open: '' });
    const sent = record(el, 'chat-send');
    const replied = record(el, 'chat-reply');
    await say(el, '  Hi  ');
    expect(calls[0].url).toBe('/api/chat');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].body).toEqual({
      messages: [{ role: 'user', content: 'Hi' }],
    });
    await settle(() => expect(texts(el)).toEqual(['Hi', 'Hello!']));
    expect(sent).toEqual([{ text: 'Hi' }]);
    await settle(() =>
      expect(replied).toEqual([{ text: 'Hello!', reason: 'stop' }])
    );
    expect($(el, '.sr')!.textContent).toBe('Hello!');
    expect(($(el, 'textarea') as HTMLTextAreaElement).value).toBe('');
  });

  it('includes earlier turns in the next request', async () => {
    replies = [
      { events: [delta('A1'), done()] },
      { events: [delta('A2'), done()] },
    ];
    const el = await mountChat({ open: '' });
    await say(el, 'Q1');
    await settle(() => expect(texts(el)).toEqual(['Q1', 'A1']));
    await say(el, 'Q2');
    expect(calls[1].body.messages).toEqual([
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' },
    ]);
  });

  it('sends at most max-history messages', async () => {
    const el = await mountChat({ open: '', 'max-history': '1' });
    await say(el, 'Q1');
    await settle(() => expect(texts(el)).toHaveLength(2));
    await say(el, 'Q2');
    expect(calls[1].body.messages).toEqual([{ role: 'user', content: 'Q2' }]);
  });

  it('shows the typing indicator until the first text arrives', async () => {
    replies = [{ events: [], hold: true }];
    const el = await mountChat({ open: '' });
    await say(el, 'Hi');
    expect($(el, '.typing')).not.toBeNull();
    expect($(el, 'form button')!.textContent).toBe('Stop');
  });

  it('marks a reply cut by the output limit', async () => {
    replies = [{ events: [delta('long'), done('length')] }];
    const el = await mountChat({ open: '' });
    const replied = record(el, 'chat-reply');
    await say(el, 'Hi');
    await settle(() => expect($(el, '.assistant.cut')).not.toBeNull());
    expect(replied).toEqual([{ text: 'long', reason: 'length' }]);
  });

  it('stops a streaming reply and keeps what arrived', async () => {
    replies = [{ events: [delta('partial')], hold: true }];
    const el = await mountChat({ open: '' });
    const replied = record(el, 'chat-reply');
    const errors = record(el, 'chat-error');
    await say(el, 'Hi');
    await settle(() => expect(texts(el)).toEqual(['Hi', 'partial']));
    $(el, 'form button.stop')!.click();
    await settle(() =>
      expect(replied).toEqual([{ text: 'partial', reason: 'aborted' }])
    );
    expect((calls[0].init.signal as AbortSignal).aborted).toBe(true);
    expect(errors).toEqual([]);
    expect($(el, 'form button')!.textContent).toBe('Send');
  });

  it('does not send while a reply is streaming, nor empty text', async () => {
    replies = [{ events: [], hold: true }];
    const el = await mountChat({ open: '' });
    await say(el, '   ');
    expect(calls).toHaveLength(0);
    await say(el, 'Hi');
    await say(el, 'Again');
    expect(calls).toHaveLength(1);
  });

  it('lets the page cancel a message with chat-send', async () => {
    const el = await mountChat({ open: '' });
    el.addEventListener('chat-send', event => event.preventDefault());
    await say(el, 'Hi');
    expect(calls).toHaveLength(0);
    expect(texts(el)).toEqual([]);
  });

  it('passes headers and credentials when asked', async () => {
    const el = await mountChat({ open: '', 'with-credentials': '' });
    el.headers = { 'x-site-token': 't' };
    await act();
    await say(el, 'Hi');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-site-token']).toBe('t');
    expect(headers['content-type']).toBe('application/json');
    expect(calls[0].init.credentials).toBe('include');
  });
});

describe('<tiny-ai-chat> errors', () => {
  it.each([
    [
      'a refused request',
      { status: 403, code: 'forbidden_origin' },
      'forbidden_origin',
    ],
    ['a failed fetch', { reject: true }, 'network_error'],
    [
      'an error event',
      {
        events: [
          { event: 'error', data: { code: 'upstream_error', message: 'x' } },
        ],
      },
      'upstream_error',
    ],
    ['a stream without done', { events: [delta('half')] }, 'network_error'],
  ] as [string, Reply, string][])(
    'reports %s and retries',
    async (_name, reply, code) => {
      replies = [reply, { events: [delta('Recovered'), done()] }];
      const el = await mountChat({ open: '' });
      const errors = record(el, 'chat-error');
      await say(el, 'Hi');
      await settle(() => expect($(el, '.error')).not.toBeNull());
      expect($(el, '.error')!.dataset.code).toBe(code);
      expect($(el, '.error')!.getAttribute('role')).toBe('alert');
      expect((errors[0] as { code: string }).code).toBe(code);
      $(el, '.error button')!.click();
      await settle(() => expect(texts(el)).toEqual(['Hi', 'Recovered']));
      expect($(el, '.error')).toBeNull();
      expect(calls[1].body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    }
  );
});

describe('<tiny-ai-chat> keyboard', () => {
  it('does not send on Shift+Enter or while an IME composes', async () => {
    const el = await mountChat({ open: '' });
    const input = type(el, '안녕');
    pressEnter(input, { shiftKey: true });
    pressEnter(input, { isComposing: true });
    pressEnter(input, { keyCode: 229 });
    await act();
    expect(calls).toHaveLength(0);
    pressEnter(input);
    await act();
    expect(calls).toHaveLength(1);
  });
});

describe('<tiny-ai-chat> persistence', () => {
  it('restores the conversation for the same endpoint in this tab', async () => {
    const el = await mountChat({ open: '' });
    await say(el, 'Hi');
    await settle(() => expect(texts(el)).toEqual(['Hi', 'ok']));
    el.remove();
    const again = await mountChat({ open: '' });
    expect(texts(again)).toEqual(['Hi', 'ok']);
  });

  it('keeps nothing with persist="none"', async () => {
    const el = await mountChat({ open: '', persist: 'none' });
    await say(el, 'Hi');
    await settle(() => expect(texts(el)).toHaveLength(2));
    expect(sessionStorage.length).toBe(0);
  });

  it('clears the conversation and the stored copy', async () => {
    const el = await mountChat({ open: '' });
    await say(el, 'Hi');
    await settle(() => expect(texts(el)).toHaveLength(2));
    $(el, 'header .icon')!.click();
    await act();
    expect(texts(el)).toEqual([]);
    expect(sessionStorage.length).toBe(0);
  });

  it('works when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const el = await mountChat({ open: '' });
    await say(el, 'Hi');
    await settle(() => expect(texts(el)).toEqual(['Hi', 'ok']));
    vi.restoreAllMocks();
  });
});

describe('<tiny-ai-chat> hardening', () => {
  it('keeps streaming while closed and shows the reply when reopened', async () => {
    replies = [{ events: [delta('first')], hold: true }];
    const el = await mountChat();
    await openChat(el);
    await say(el, 'Hi');
    $(el, '.launcher')!.click();
    await act();
    expect($(el, '.panel')).toBeNull();
    await openChat(el);
    await settle(() => expect(texts(el)).toEqual(['Hi', 'first']));
  });

  it('clearing during a reply stops it and leaves an empty conversation', async () => {
    replies = [{ events: [delta('part')], hold: true }];
    const el = await mountChat({ open: '' });
    await say(el, 'Hi');
    await settle(() => expect(texts(el)).toEqual(['Hi', 'part']));
    $(el, 'header .icon')!.click();
    await act();
    await settle(() =>
      expect((calls[0].init.signal as AbortSignal).aborted).toBe(true)
    );
    expect(texts(el)).toEqual([]);
    expect($(el, 'form button')!.textContent).toBe('Send');
  });

  it('keeps separate conversations for separate endpoints', async () => {
    const a = await mountChat({ open: '' });
    await say(a, 'For A');
    await settle(() => expect(texts(a)).toHaveLength(2));
    a.remove();
    const b = await mountChat({ open: '', endpoint: '/other' });
    expect(texts(b)).toEqual([]);
  });
});
