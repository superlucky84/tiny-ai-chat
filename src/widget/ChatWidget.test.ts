// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'lithent/test';
import './main';

const mountChat = async (attributes: Record<string, string> = {}) => {
  const el = document.createElement('tiny-ai-chat');
  for (const [name, value] of Object.entries(attributes)) {
    el.setAttribute(name, value);
  }
  document.body.append(el);
  await act();
  return el;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<tiny-ai-chat>', () => {
  it('is registered and draws a launcher in its shadow root', async () => {
    const el = await mountChat({ endpoint: '/api/chat' });
    expect(customElements.get('tiny-ai-chat')).toBeDefined();
    const launcher = el.shadowRoot?.querySelector('button.launcher');
    expect(launcher?.getAttribute('aria-label')).toBe('Open chat');
  });

  it('takes the launcher label from the labels property', async () => {
    const el = await mountChat();
    (el as HTMLElement & { labels: unknown }).labels = { open: '채팅 열기' };
    await act();
    const launcher = el.shadowRoot?.querySelector('button.launcher');
    expect(launcher?.getAttribute('aria-label')).toBe('채팅 열기');
  });
});
