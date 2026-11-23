import { mount, nextTick, ref } from 'lithent';
import { emit } from 'lithent/element';
import type { ElementProps } from 'lithent/element';
// Type-only imports keep this file exporting nothing but the component, which
// lets the dev server swap it in place when you edit it.
import type {
  chatProps,
  ChatErrorDetail,
  ChatLabels,
  ChatReplyDetail,
  ChatSendDetail,
} from './chatProps';
import { defaultLabels } from './chatProps';
import { ask, ChatError, store, type Turn } from './chat';

type Props = ElementProps<typeof chatProps>;

const frame =
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (run: () => void) => setTimeout(run, 16);

// lithent takes an <svg>'s namespace from its xmlns prop: always pass it.
const icon = (d: string) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);
const CLOSE = 'M6 6l12 12M18 6L6 18';

/** <tiny-ai-chat>: launcher, panel, streaming conversation (DESIGN §3). */
export const ChatWidget = mount<Props>((renew, first) => {
  let props = first;
  const key = () => `tiny-ai-chat:${props.endpoint}`;
  const persist = () => props.persist !== 'none';
  const inline = () => props.position === 'inline';
  const label = (name: keyof ChatLabels) =>
    (props.labels as Partial<ChatLabels> | undefined)?.[name] ??
    defaultLabels[name];

  let open = !!first.open;
  let turns: Turn[] = persist() ? store.load(key()) : [];
  let draft = '';
  let busy: AbortController | undefined;
  let waiting = false;
  let failure: ChatError | undefined;
  let announce = '';
  let queued = false;

  const list = ref<HTMLElement | null>(null);
  const input = ref<HTMLTextAreaElement | null>(null);
  const launcher = ref<HTMLButtonElement | null>(null);

  // Draw now, following the newest text if the reader is at the bottom.
  const draw = () => {
    const box = list.value;
    const follow =
      !box || box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    renew();
    if (follow) {
      nextTick().then(() => {
        if (list.value) list.value.scrollTop = list.value.scrollHeight;
      });
    }
  };
  // While text streams in, draw at most once per frame (DC-14).
  const drawSoon = () => {
    if (queued) return;
    queued = true;
    frame(() => {
      queued = false;
      draw();
    });
  };

  const save = () => {
    if (persist())
      store.save(
        key(),
        turns.filter(t => t.end !== 'error')
      );
  };

  const setOpen = (next: boolean) => {
    if (open === next) return;
    open = next;
    emit(props.host, next ? 'chat-open' : 'chat-close');
    draw();
    nextTick().then(() => (next ? input.value : launcher.value)?.focus());
  };

  const reply = async () => {
    const history = turns
      .filter(t => t.content && t.end !== 'error')
      .slice(-(props.maxHistory || 20))
      .map(({ role, content }) => ({ role, content }));
    const turn: Turn = { role: 'assistant', content: '' };
    turns.push(turn);
    const controller = (busy = new AbortController());
    waiting = true;
    failure = undefined;
    draw();
    let end: Turn['end'];
    try {
      end = await ask({
        endpoint: props.endpoint || '',
        messages: history,
        headers: props.headers as Record<string, string> | undefined,
        withCredentials: props.withCredentials,
        signal: controller.signal,
        onText: text => {
          waiting = false;
          turn.content += text;
          drawSoon();
        },
      });
    } catch (error) {
      if (controller.signal.aborted) end = 'aborted';
      else {
        end = 'error';
        failure =
          error instanceof ChatError ? error : new ChatError('network_error');
        const detail: ChatErrorDetail = {
          code: failure.code,
          message: failure.message,
        };
        emit(props.host, 'chat-error', detail);
      }
    }
    if (busy === controller) busy = undefined;
    waiting = false;
    turn.end = end;
    if (end !== 'error') {
      announce = turn.content;
      const detail: ChatReplyDetail = {
        text: turn.content,
        reason: end as ChatReplyDetail['reason'],
      };
      emit(props.host, 'chat-reply', detail);
    }
    save();
    draw();
  };

  const send = (event?: Event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const detail: ChatSendDetail = { text };
    if (!emit(props.host, 'chat-send', detail)) return;
    turns.push({ role: 'user', content: text });
    draft = '';
    // Typing does not redraw, so the virtual value is still '' and a redraw
    // would not touch the field: empty it here.
    if (input.value) input.value.value = '';
    reply();
  };

  const stop = () => busy?.abort();

  const retry = () => {
    if (turns[turns.length - 1]?.end === 'error') turns.pop();
    reply();
  };

  const clear = () => {
    stop();
    turns = [];
    failure = undefined;
    announce = '';
    save();
    draw();
  };

  const onKey = (event: KeyboardEvent) => {
    // Enter sends; Shift+Enter breaks the line; Enter that ends an IME
    // composition (Korean, Japanese, Chinese input) does neither.
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.isComposing &&
      event.keyCode !== 229
    ) {
      send(event);
    }
  };

  return next => {
    props = next;
    const show = open || inline();
    return (
      <>
        {!inline() && (
          <button
            type="button"
            class="launcher"
            part="launcher"
            ref={launcher}
            aria-label={label(open ? 'close' : 'open')}
            aria-expanded={String(open)}
            onClick={() => setOpen(!open)}
          >
            {icon(open ? CLOSE : 'M4 5h16v10H9l-5 4z')}
          </button>
        )}
        {show && (
          <section
            class="panel"
            part="panel"
            role="dialog"
            aria-label={props.heading || 'Chat'}
            onKeyDown={(event: KeyboardEvent) => {
              if (event.key === 'Escape' && !inline()) setOpen(false);
            }}
          >
            <header part="header">
              <strong>{props.heading || 'Chat'}</strong>
              <button
                type="button"
                class="icon"
                aria-label={label('clear')}
                title={label('clear')}
                onClick={clear}
              >
                {icon('M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13')}
              </button>
              {!inline() && (
                <button
                  type="button"
                  class="icon"
                  aria-label={label('close')}
                  title={label('close')}
                  onClick={() => setOpen(false)}
                >
                  {icon(CLOSE)}
                </button>
              )}
            </header>
            <div class="messages" part="messages" ref={list}>
              {props.greeting && <p class="msg assistant">{props.greeting}</p>}
              {turns.map(turn =>
                turn.content || turn.end !== 'error' ? (
                  <p
                    class={`msg ${turn.role}${turn.end === 'length' ? ' cut' : ''}`}
                    part="message"
                  >
                    {turn.content}
                  </p>
                ) : null
              )}
              {waiting && (
                <p class="msg assistant typing" aria-label={label('typing')}>
                  <i />
                  <i />
                  <i />
                </p>
              )}
              {failure && (
                <p class="error" role="alert" data-code={failure.code}>
                  {label('error')}{' '}
                  <button type="button" onClick={retry}>
                    {label('retry')}
                  </button>
                </p>
              )}
            </div>
            <form part="form" onSubmit={send}>
              <textarea
                part="input"
                ref={input}
                rows={1}
                placeholder={props.placeholder || 'Ask anything…'}
                aria-label={props.placeholder || 'Ask anything…'}
                value={draft}
                onInput={(event: Event) => {
                  draft = (event.target as HTMLTextAreaElement).value;
                }}
                onKeyDown={onKey}
              />
              {busy ? (
                <button type="button" part="send" class="stop" onClick={stop}>
                  {label('stop')}
                </button>
              ) : (
                <button type="submit" part="send">
                  {label('send')}
                </button>
              )}
            </form>
            <p class="sr" aria-live="polite">
              {announce}
            </p>
          </section>
        )}
      </>
    );
  };
});
