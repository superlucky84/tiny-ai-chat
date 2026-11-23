/**
 * Types for `import 'tiny-ai-chat'`: the <tiny-ai-chat> element, its
 * properties and its events (DESIGN §3.1, §3.2). Published as
 * dist/tiny-ai-chat.d.ts; src/widget/typesMatch.ts keeps it in step with
 * the props the element really declares.
 */

export type ChatLabels = {
  open: string;
  close: string;
  send: string;
  stop: string;
  retry: string;
  clear: string;
  typing: string;
  error: string;
};

export type ReplyReason = 'stop' | 'length' | 'refusal' | 'aborted';
export type ChatSendDetail = { text: string };
export type ChatReplyDetail = { text: string; reason: ReplyReason };
export type ChatErrorDetail = { code: string; message: string };

/** Properties of <tiny-ai-chat>; each also works as a kebab-case attribute. */
export type TinyAiChatProps = {
  endpoint?: string;
  heading?: string;
  greeting?: string;
  placeholder?: string;
  position?: 'bottom-right' | 'bottom-left' | 'inline';
  open: boolean;
  theme?: 'auto' | 'light' | 'dark';
  persist?: 'session' | 'none';
  maxHistory?: number;
  withCredentials: boolean;
  labels?: Partial<ChatLabels>;
  headers?: Record<string, string>;
};

export type TinyAiChatElement = HTMLElement & TinyAiChatProps;

declare global {
  interface HTMLElementTagNameMap {
    'tiny-ai-chat': TinyAiChatElement;
  }
  interface GlobalEventHandlersEventMap {
    'chat-open': CustomEvent<undefined>;
    'chat-close': CustomEvent<undefined>;
    /** Cancelable: preventDefault() keeps the message from being sent. */
    'chat-send': CustomEvent<ChatSendDetail>;
    'chat-reply': CustomEvent<ChatReplyDetail>;
    'chat-error': CustomEvent<ChatErrorDetail>;
  }
}
