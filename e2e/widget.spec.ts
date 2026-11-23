import { expect, test, type Locator, type Page } from '@playwright/test';

// The host page (dist/index.html) loads the built IIFE with a plain script
// tag and styles its own buttons in a way that would wreck the widget if
// they leaked in.

const chatOf = (page: Page, selector = 'tiny-ai-chat') =>
  page.locator(selector);

const send = async (chat: Locator, text: string) => {
  await chat.locator('textarea').fill(text);
  await chat.locator('textarea').press('Enter');
};

const lastReply = (chat: Locator) => chat.locator('.msg.assistant').last();

test.describe('on a host page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads from one script tag without page CSS leaking in', async ({
    page,
  }) => {
    const chat = chatOf(page);
    const launcher = chat.locator('.launcher');
    await expect(launcher).toBeVisible();
    const style = await launcher.evaluate(el => {
      const s = getComputedStyle(el);
      return {
        font: s.fontFamily,
        border: s.borderStyle,
        transform: s.textTransform,
      };
    });
    expect(style.font).not.toContain('Courier');
    expect(style.border).toBe('none');
    // The page's own button keeps the page's style.
    const pageButton = page.locator('main button');
    await expect(pageButton).toHaveCSS('text-transform', 'uppercase');
  });

  test('streams a reply and renders its Markdown', async ({ page }) => {
    const chat = chatOf(page);
    await chat.locator('.launcher').click();
    await expect(chat.locator('[role=dialog]')).toBeVisible();
    await expect(chat.locator('textarea')).toBeFocused();
    await send(chat, 'Hello');
    await expect(chat.locator('.msg.user')).toHaveText('Hello');
    const reply = lastReply(chat);
    await expect(reply.locator('strong')).toHaveText('bold');
    await expect(reply.locator('li')).toHaveText(['first', 'second']);
    await expect(reply.locator('code')).toHaveText('npm test');
    const link = reply.locator('a');
    await expect(link).toHaveAttribute('href', 'https://example.com/docs');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    await expect(chat.locator('form button')).toHaveText('Send');
    await expect(chat.locator('.sr')).toContainText('Here is **bold** text.');
    await expect(chat.locator('textarea')).toHaveValue('');
  });

  test('shows text arriving and stops on demand', async ({ page }) => {
    const chat = chatOf(page);
    await chat.locator('.launcher').click();
    await send(chat, 'slow');
    const reply = lastReply(chat);
    await expect(reply).toContainText('word3');
    const before = (await reply.textContent()) || '';
    await expect(reply).toContainText('word8');
    expect(((await reply.textContent()) || '').length).toBeGreaterThan(
      before.length
    );
    await chat.locator('form button.stop').click();
    await expect(chat.locator('form button')).toHaveText('Send');
    const stopped = await reply.textContent();
    await page.waitForTimeout(300);
    expect(await reply.textContent()).toBe(stopped);
    expect(stopped).not.toContain('word199');
  });

  test('sends the earlier conversation with each message', async ({ page }) => {
    const chat = chatOf(page);
    await chat.locator('.launcher').click();
    await send(chat, 'Hello');
    await expect(chat.locator('form button')).toHaveText('Send');
    await expect(lastReply(chat)).toContainText('second');
    await send(chat, 'echo history');
    await expect(lastReply(chat)).toHaveText('I have 3 messages.');
  });

  test('reports a provider failure with a retry button', async ({ page }) => {
    const chat = chatOf(page);
    await chat.locator('.launcher').click();
    await send(chat, 'fail');
    const alert = chat.locator('[role=alert]');
    await expect(alert).toContainText('Something went wrong.');
    await expect(alert).toHaveAttribute('data-code', 'upstream_error');
    await expect(alert.locator('button')).toHaveText('Try again');
  });

  test('keeps the conversation across a reload in the same tab', async ({
    page,
  }) => {
    const chat = chatOf(page);
    await chat.locator('.launcher').click();
    await send(chat, 'Hello');
    await expect(lastReply(chat)).toContainText('second');
    await page.reload();
    await chat.locator('.launcher').click();
    await expect(chat.locator('.msg.user')).toHaveText('Hello');
    await expect(lastReply(chat).locator('li')).toHaveCount(2);
  });

  test('works from the keyboard alone', async ({ page, browserName }) => {
    const chat = chatOf(page);
    const launcher = chat.locator('.launcher');
    // Safari does not move Tab focus to buttons by default; focus directly.
    if (browserName === 'webkit') await launcher.focus();
    else {
      await page.locator('main button').focus();
      await page.keyboard.press('Tab');
    }
    await expect(launcher).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(chat.locator('textarea')).toBeFocused();
    await page.keyboard.type('Hello');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('again');
    await expect(chat.locator('textarea')).toHaveValue('Hello\nagain');
    await page.keyboard.press('Enter');
    await expect(lastReply(chat)).toContainText('second');
    await page.keyboard.press('Escape');
    await expect(chat.locator('[role=dialog]')).toHaveCount(0);
    await expect(launcher).toBeFocused();
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('opens the panel over the whole screen without sideways scroll', async ({
    page,
  }) => {
    await page.goto('/');
    const chat = chatOf(page);
    await chat.locator('.launcher').click();
    const box = await chat.locator('.panel').boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 780 });
    await send(chat, 'Hello');
    await expect(lastReply(chat)).toContainText('second');
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(overflow).toBe(0);
    // The covered launcher is hidden, so the header's button is the only close.
    await expect(chat.locator('.launcher')).toBeHidden();
    await chat.getByRole('button', { name: 'Close chat' }).click();
    await expect(chat.locator('.panel')).toHaveCount(0);
    await expect(chat.locator('.launcher')).toBeFocused();
  });
});

test.describe('variants', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/variants.html');
  });

  test('draws an inline panel in the page flow', async ({ page }) => {
    const chat = chatOf(page, '#inline');
    await expect(chat.locator('.launcher')).toHaveCount(0);
    await expect(chat.locator('.panel')).toBeVisible();
    await expect(chat.locator('header strong')).toHaveText('Inline chat');
    const panel = await chat.locator('.panel').boundingBox();
    const box = await page.locator('#inline-box').boundingBox();
    expect(panel!.y).toBeGreaterThanOrEqual(box!.y);
    await send(chat, 'Hello');
    await expect(lastReply(chat)).toContainText('second');
  });

  test('follows the position, theme and CSS variables', async ({ page }) => {
    const chat = chatOf(page, '#forbidden');
    const launcher = chat.locator('.launcher');
    await expect(launcher).toHaveCSS('background-color', 'rgb(200, 30, 90)');
    const box = await launcher.boundingBox();
    expect(box!.x).toBeLessThan(100);
    await launcher.click();
    await expect(chat.locator('.panel')).toHaveCSS(
      'background-color',
      'rgb(15, 23, 42)'
    );
  });

  test('shows an error when the relay refuses this site', async ({ page }) => {
    const chat = chatOf(page, '#forbidden');
    await chat.locator('.launcher').click();
    await send(chat, 'Hello');
    await expect(chat.locator('[role=alert]')).toHaveAttribute(
      'data-code',
      'forbidden_origin'
    );
  });
});
