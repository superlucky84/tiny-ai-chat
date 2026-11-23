/**
 * The public contract of <tiny-ai-chat>: what the page passes in and what the
 * widget sends back (DESIGN §3.1, §3.2). Keep it stable once sites embed it.
 *
 * Each prop is an attribute in kebab-case (`max-history="10"`) and a property
 * in camelCase (`el.maxHistory`). The constructor says how an attribute is
 * read: `String` as is, `Number`, `Boolean` (present or not), `Object` (JSON).
 */
export const chatProps = {
  endpoint: String,
  heading: String,
  greeting: String,
  placeholder: String,
  position: String,
  open: Boolean,
  theme: String,
  persist: String,
  maxHistory: Number,
  withCredentials: Boolean,
  labels: Object,
  headers: Object,
};

/** Text on the widget's buttons and messages, replaceable through `labels`. */
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

export const defaultLabels: ChatLabels = {
  open: 'Open chat',
  close: 'Close chat',
  send: 'Send',
  stop: 'Stop',
  retry: 'Try again',
  clear: 'Clear conversation',
  typing: 'Typing…',
  error: 'Something went wrong.',
};

/** Why a reply ended (`chat-reply`). */
export type ReplyReason = 'stop' | 'length' | 'refusal' | 'aborted';

/** `chat-send`: cancelable. Calling `preventDefault()` keeps the message. */
export type ChatSendDetail = { text: string };

/** `chat-reply`: one reply has finished. */
export type ChatReplyDetail = { text: string; reason: ReplyReason };

/** `chat-error`: see the error codes in DESIGN §4.3. */
export type ChatErrorDetail = { code: string; message: string };
