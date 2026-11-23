import { mount } from 'lithent';
import type { ElementProps } from 'lithent/element';
// Type-only: this file exports nothing but the component, which is what lets
// the dev server swap it in place when you edit it.
import type { chatProps, ChatLabels } from './chatProps';
import { defaultLabels } from './chatProps';

type Props = ElementProps<typeof chatProps>;

/**
 * <tiny-ai-chat>. Phase 1 draws only the launcher; the panel, the
 * conversation and streaming arrive in Phase 4 (docs/v0.1/IMPLEMENT.md).
 */
export const ChatWidget = mount<Props>((_renew, props) => {
  const label = (key: keyof ChatLabels) =>
    (props.labels as Partial<ChatLabels> | undefined)?.[key] ??
    defaultLabels[key];

  return () => (
    <button
      type="button"
      class="launcher"
      part="launcher"
      aria-label={label('open')}
      aria-expanded="false"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v10H9l-5 4z" />
      </svg>
    </button>
  );
});
