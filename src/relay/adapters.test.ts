import type Anthropic from '@anthropic-ai/sdk';
import type { GoogleGenAI } from '@google/genai';
import type OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { anthropic } from './anthropic';
import { gemini } from './gemini';
import { createRelay } from './index';
import { openai } from './openai';
import type { Provider, ProviderEvent, ProviderInput } from './types';
import { readEventStream } from '../shared/protocol';

type Script = {
  text: string[];
  end: 'stop' | 'length' | 'refusal';
  fail?: Error;
};

const iterate = async function* <T>(items: T[], fail?: Error) {
  for (const item of items) yield item;
  if (fail) throw fail;
};

// Fake SDK clients: each turns a script into that SDK's stream events and
// records the request it was given.

const fakeAnthropic = (script: Script) => {
  const calls: {
    body: Record<string, unknown>;
    options: { signal?: AbortSignal };
  }[] = [];
  const stop = { stop: 'end_turn', length: 'max_tokens', refusal: 'refusal' }[
    script.end
  ];
  const client = {
    beta: {
      messages: {
        stream: (
          body: Record<string, unknown>,
          options: { signal?: AbortSignal }
        ) => {
          calls.push({ body, options });
          return iterate(
            [
              { type: 'message_start' },
              {
                type: 'content_block_start',
                index: 0,
                content_block: { type: 'thinking' },
              },
              {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'thinking_delta', thinking: '' },
              },
              ...script.text.map(text => ({
                type: 'content_block_delta',
                index: 1,
                delta: { type: 'text_delta', text },
              })),
              { type: 'message_delta', delta: { stop_reason: stop } },
              { type: 'message_stop' },
            ],
            script.fail
          );
        },
      },
    },
  };
  return { client: client as unknown as Anthropic, calls };
};

const fakeOpenAI = (script: Script) => {
  const calls: {
    body: Record<string, unknown>;
    options: { signal?: AbortSignal };
  }[] = [];
  const ending =
    script.end === 'stop'
      ? [{ type: 'response.completed', response: {} }]
      : script.end === 'length'
        ? [
            {
              type: 'response.incomplete',
              response: { incomplete_details: { reason: 'max_output_tokens' } },
            },
          ]
        : [
            { type: 'response.refusal.delta', delta: '' },
            { type: 'response.completed', response: {} },
          ];
  const client = {
    responses: {
      create: async (
        body: Record<string, unknown>,
        options: { signal?: AbortSignal }
      ) => {
        calls.push({ body, options });
        return iterate(
          [
            { type: 'response.created', response: {} },
            ...script.text.map(delta => ({
              type: 'response.output_text.delta',
              delta,
            })),
            ...ending,
          ],
          script.fail
        );
      },
    },
  };
  return { client: client as unknown as OpenAI, calls };
};

const fakeGemini = (script: Script) => {
  const calls: Record<string, unknown>[] = [];
  const finish = { stop: 'STOP', length: 'MAX_TOKENS', refusal: 'SAFETY' }[
    script.end
  ];
  const client = {
    models: {
      generateContentStream: async (params: Record<string, unknown>) => {
        calls.push(params);
        const chunks = script.text.map((text, i) => ({
          text,
          candidates: [
            { finishReason: i === script.text.length - 1 ? finish : undefined },
          ],
        }));
        if (!chunks.length)
          chunks.push({ text: '', candidates: [{ finishReason: finish }] });
        return iterate(chunks, script.fail);
      },
    },
  };
  return { client: client as unknown as GoogleGenAI, calls };
};

const adapters = {
  anthropic: (script: Script) => {
    const fake = fakeAnthropic(script);
    return {
      provider: anthropic({ model: 'claude-opus-5-5', client: fake.client }),
      fake,
    };
  },
  openai: (script: Script) => {
    const fake = fakeOpenAI(script);
    return {
      provider: openai({ model: 'test-model', client: fake.client }),
      fake,
    };
  },
  gemini: (script: Script) => {
    const fake = fakeGemini(script);
    return {
      provider: gemini({ model: 'test-model', client: fake.client }),
      fake,
    };
  },
};

const input = (over: Partial<ProviderInput> = {}): ProviderInput => ({
  system: 'Be brief.',
  messages: [
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello!' },
    { role: 'user', content: 'Who are you?' },
  ],
  maxOutputTokens: 512,
  signal: new AbortController().signal,
  ...over,
});

const collect = async (provider: Provider, over?: Partial<ProviderInput>) => {
  const out: ProviderEvent[] = [];
  for await (const event of provider.stream(input(over))) out.push(event);
  return out;
};

describe.each(Object.entries(adapters))(
  'provider contract: %s',
  (name, make) => {
    it('streams text and ends with "stop"', async () => {
      const { provider } = make({ text: ['Hel', 'lo'], end: 'stop' });
      expect(provider.name).toBe(name);
      expect(await collect(provider)).toEqual([
        { type: 'text', text: 'Hel' },
        { type: 'text', text: 'lo' },
        { type: 'end', reason: 'stop' },
      ]);
    });

    it.each(['length', 'refusal'] as const)('ends with "%s"', async end => {
      const { provider } = make({ text: ['x'], end });
      expect((await collect(provider)).at(-1)).toEqual({
        type: 'end',
        reason: end,
      });
    });

    it('lets SDK errors through to the relay', async () => {
      const { provider } = make({
        text: ['x'],
        end: 'stop',
        fail: new Error('429'),
      });
      await expect(collect(provider)).rejects.toThrow('429');
    });

    it('works behind createRelay', async () => {
      const { provider } = make({ text: ['A', 'B'], end: 'length' });
      const relay = createRelay({ provider, allowedOrigins: '*' });
      const response = await relay(
        new Request('https://relay.example', {
          method: 'POST',
          headers: { origin: 'https://site.example' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
        })
      );
      const events: string[] = [];
      await readEventStream(response.body!, (event, data) =>
        events.push(`${event} ${data}`)
      );
      expect(events).toEqual([
        'delta {"text":"A"}',
        'delta {"text":"B"}',
        'done {"reason":"length"}',
      ]);
    });
  }
);

describe('adapter options', () => {
  it.each([
    ['anthropic', () => anthropic({ apiKey: 'k' } as never)],
    ['openai', () => openai({ apiKey: 'k' } as never)],
    ['gemini', () => gemini({ apiKey: 'k' } as never)],
  ])('%s requires a model', (_name, make) => {
    expect(make).toThrow(/model/);
  });

  it.each([
    ['anthropic', () => anthropic({ model: 'm' })],
    ['openai', () => openai({ model: 'm' })],
    ['gemini', () => gemini({ model: 'm' })],
  ])('%s requires an API key or a client', (_name, make) => {
    expect(make).toThrow(/apiKey/);
  });
});

describe('anthropic request', () => {
  it('sends the conversation with server-side fallback on by default', async () => {
    const { provider, fake } = adapters.anthropic({ text: [], end: 'stop' });
    const signal = new AbortController().signal;
    await collect(provider, { signal });
    expect(fake.calls[0].body).toEqual({
      model: 'claude-opus-5-5',
      max_tokens: 512,
      system: 'Be brief.',
      messages: input().messages,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    expect(fake.calls[0].options.signal).toBe(signal);
  });

  it('can turn fallback off and set the effort', async () => {
    const fake = fakeAnthropic({ text: [], end: 'stop' });
    const provider = anthropic({
      model: 'claude-opus-5-5',
      client: fake.client,
      fallbacks: false,
      effort: 'low',
    });
    await collect(provider, { system: undefined });
    expect(fake.calls[0].body).toEqual({
      model: 'claude-opus-5-5',
      max_tokens: 512,
      messages: input().messages,
      output_config: { effort: 'low' },
    });
  });
});

describe('openai request', () => {
  it('sends instructions, input and the output limit to the Responses API', async () => {
    const { provider, fake } = adapters.openai({ text: [], end: 'stop' });
    const signal = new AbortController().signal;
    await collect(provider, { signal });
    expect(fake.calls[0].body).toEqual({
      model: 'test-model',
      instructions: 'Be brief.',
      input: input().messages,
      max_output_tokens: 512,
      stream: true,
    });
    expect(fake.calls[0].options.signal).toBe(signal);
  });

  it('shows refusal text and ends with "refusal"', async () => {
    const client = {
      responses: {
        create: async () =>
          iterate([
            {
              type: 'response.refusal.delta',
              delta: 'I cannot help with that.',
            },
            { type: 'response.completed', response: {} },
          ]),
      },
    } as unknown as OpenAI;
    expect(await collect(openai({ model: 'm', client }))).toEqual([
      { type: 'text', text: 'I cannot help with that.' },
      { type: 'end', reason: 'refusal' },
    ]);
  });

  it.each([
    [
      {
        type: 'response.failed',
        response: { error: { code: 'server_error' } },
      },
      /server_error/,
    ],
    [
      { type: 'error', code: 'rate_limit_exceeded', message: '' },
      /rate_limit_exceeded/,
    ],
  ])('throws on a failure event', async (event, message) => {
    const client = {
      responses: { create: async () => iterate([event]) },
    } as unknown as OpenAI;
    await expect(collect(openai({ model: 'm', client }))).rejects.toThrow(
      message
    );
  });
});

describe('gemini request', () => {
  it('maps roles and passes the system prompt, limit and abort signal', async () => {
    const { provider, fake } = adapters.gemini({ text: ['x'], end: 'stop' });
    const signal = new AbortController().signal;
    await collect(provider, { signal });
    expect(fake.calls[0]).toEqual({
      model: 'test-model',
      contents: [
        { role: 'user', parts: [{ text: 'Hi' }] },
        { role: 'model', parts: [{ text: 'Hello!' }] },
        { role: 'user', parts: [{ text: 'Who are you?' }] },
      ],
      config: {
        maxOutputTokens: 512,
        abortSignal: signal,
        systemInstruction: 'Be brief.',
      },
    });
  });

  it('ends with "refusal" when the prompt is blocked', async () => {
    const client = {
      models: {
        generateContentStream: async () =>
          iterate([
            { text: undefined, promptFeedback: { blockReason: 'SAFETY' } },
          ]),
      },
    } as unknown as GoogleGenAI;
    expect(await collect(gemini({ model: 'm', client }))).toEqual([
      { type: 'end', reason: 'refusal' },
    ]);
  });
});
