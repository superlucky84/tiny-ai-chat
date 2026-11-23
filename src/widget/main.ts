/**
 * The bundle entry. Loading dist/tiny-ai-chat.js (or .mjs) registers
 * <tiny-ai-chat>.
 */
import { defineElement } from 'lithent/element';
import { ChatWidget } from './ChatWidget';
import { chatProps } from './chatProps';
// `?inline` turns the stylesheet into a string that defineElement puts inside
// the element's shadow root: the page's CSS does not reach in, and this CSS
// does not leak out.
import styles from './chat-widget.css?inline';

defineElement('tiny-ai-chat', ChatWidget, {
  props: chatProps,
  styles: [styles],
});
