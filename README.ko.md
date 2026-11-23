# tiny-ai-chat

어느 웹사이트에나 붙는 10KB 미만의 AI 채팅 위젯입니다. 작은 중계 서버(relay)가 API 키를 서버에 두고
OpenAI·Google Gemini·Anthropic Claude의 답을 스트리밍으로 보내 줍니다.

```html
<script src="https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js"></script>
<tiny-ai-chat endpoint="https://your-relay.example.com/api/chat"></tiny-ai-chat>
```

- **script 한 줄, 태그 하나.** 정적 HTML, WordPress, React, Vue 등 태그를 넣을 수 있는 곳이면 됩니다.
  스타일은 Shadow DOM 안에 있어 페이지와 위젯이 서로 영향을 주지 않습니다.
- **키는 내 서버에.** 위젯은 중계 서버하고만 통신합니다. 중계 서버는 Cloudflare Workers와 Node에서 도는
  표준 `fetch` 핸들러입니다.
- **스트리밍, 멈추기, 다시 시도**, 안전한 마크다운, 같은 탭 안에서 대화 유지, 키보드·스크린리더 지원,
  휴대폰에서는 전체 화면.
- **내 백엔드도 가능.** 위젯은 작은 공개 규약(JSON 요청, server-sent events 응답)으로 통신하므로
  어느 서버든 같은 규약으로 답하면 됩니다.

**[데모](https://superlucky84.github.io/tiny-ai-chat/)** (AI 없이 준비된 답으로 동작 — 위젯은 실제 그대로)

> 상태: v0.1 개발 중, 아직 npm에 발행하지 않았습니다. English: [README.md](./README.md)

## 빠른 시작

### 1. 중계 서버 띄우기

중계 서버가 API 키를 갖고 대화를 AI 회사로 전달합니다.

**Cloudflare Workers** — [`templates/cloudflare-worker`](./templates/cloudflare-worker)를 복사한 뒤:

```bash
npm install
npx wrangler secret put ANTHROPIC_API_KEY   # 쓰는 회사의 키
npm run deploy
```

**Node** — [`templates/node`](./templates/node)를 복사한 뒤:

```bash
npm install
npm start          # 키 없는 데모 제공자: http://localhost:8787 을 여세요
```

실제 AI를 쓰려면 `.env`에 `PROVIDER`, `MODEL`, API 키, `ALLOWED_ORIGINS`를 넣습니다. 두 템플릿 모두 키 없이
도는 데모 제공자로 시작하므로 먼저 전체가 도는 것을 확인할 수 있습니다.

### 2. 사이트에 위젯 붙이기

```html
<script src="https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js"></script>
<tiny-ai-chat
  endpoint="https://your-relay.example.com/api/chat"
  heading="무엇이든 물어보세요"
  greeting="안녕하세요! 이 사이트에 대해 물어보세요."
  placeholder="질문을 입력하세요"
></tiny-ai-chat>
<script>
  document.querySelector('tiny-ai-chat').labels = {
    open: '채팅 열기',
    close: '채팅 닫기',
    send: '보내기',
    stop: '멈추기',
    retry: '다시 시도',
    clear: '대화 지우기',
    typing: '입력 중…',
    error: '문제가 생겼습니다.',
  };
</script>
```

번들러를 쓰면 `npm install tiny-ai-chat` 후 `import 'tiny-ai-chat'`.

속성·이벤트·CSS 변수·중계 서버 옵션·통신 규약의 전체 표는 [README.md](./README.md)에 있습니다.
주요 항목만 적으면:

- 속성: `endpoint`, `heading`, `greeting`, `placeholder`, `position`(`bottom-right`·`bottom-left`·`inline`),
  `open`, `theme`(`auto`·`light`·`dark`), `persist`(`session`·`none`), `max-history`, `with-credentials`
- 이벤트: `chat-open`, `chat-close`, `chat-send`(취소 가능), `chat-reply`, `chat-error`
- 꾸미기: `--tac-accent`, `--tac-bg`, `--tac-text`, `--tac-radius`, `--tac-font` 등 CSS 변수와 `::part()`

## 공개 전에

- **AI 회사 콘솔에서 지출 한도를 거세요.** `allowedOrigins`는 다른 웹사이트는 막지만, `Origin` 헤더를 속이는
  스크립트까지는 막지 못합니다.
- **속도 제한을 거세요** (Cloudflare 속도 제한 규칙, 또는 `onRequest`에서 `429` 응답).
- **시스템 프롬프트에 비밀을 넣지 마세요.** 방문자가 모델에게 되풀이하게 만들 수 있습니다.
- Claude 어댑터는 서버 측 fallback을 기본으로 켭니다. 모델이 안전 판단으로 거절하면 다른 모델이 이어서
  답합니다. `fallbacks: false`로 끕니다.

## lithent로 만들었습니다

위젯은 [lithent](https://github.com/superlucky84/lithent) 컴포넌트를 `lithent/element`로 표준 Custom Element로
등록한 것입니다. 8.9KB 번들 중 lithent와 element 도우미가 약 5.4KB입니다.

## 개발

Node.js 22와 pnpm이 필요합니다. 명령은 [README.md](./README.md#development)를 보세요.
설계와 계획: [docs/v0.1](./docs/v0.1/REQUIREMENTS.md).

## 라이선스

[MIT](./LICENSE)
