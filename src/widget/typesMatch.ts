/**
 * Compile-time only (never imported): fails `pnpm type-check` when the
 * published element types and the declared props drift apart.
 */
import type { chatProps } from './chatProps';
import type { TinyAiChatProps } from './element';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const propsMatch: Same<keyof typeof chatProps, keyof TinyAiChatProps> =
  true;
