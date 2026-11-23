# DESIGN — tiny-ai-chat v0.1

- 작성일: 2026-11-23
- 상태: **확정 (2026-11-23)** — 아래 "결정"에서 `[ ]`는 미결
- 관련 문서: [REQUIREMENTS.md](./REQUIREMENTS.md) → [IMPLEMENT.md](./IMPLEMENT.md) → [MANUAL_TEST_CHECKLIST.md](./MANUAL_TEST_CHECKLIST.md)

## 1. 구성

```
방문자 브라우저                       사이트 주인의 서버 (Workers / Node)          제공자
┌──────────────────────────┐  POST   ┌──────────────────────────────┐  SDK   ┌───────────┐
│ <tiny-ai-chat>           │ ──────▶ │ createRelay(options)         │ ─────▶ │ OpenAI    │
│  lithent + lithent/element│  JSON   │  출처 확인·상한·훅           │        │ Gemini    │
│  Shadow DOM, 마크다운     │ ◀────── │  provider.stream() → SSE     │ ◀───── │ Claude    │
└──────────────────────────┘   SSE   └──────────────────────────────┘ stream └───────────┘
        키 없음                              키는 여기에만 (환경 변수·비밀)
```

- 위젯은 정해진 `endpoint`로 대화를 보내고, 돌아오는 스트림을 그린다. 어느 제공자인지 모른다.
- 중계 서버는 위젯 규약(§4)과 제공자 SDK 사이를 옮긴다. 제공자마다 어댑터 하나(§6).
- 자기 백엔드가 있는 사람은 §4 규약대로 응답하면 중계 서버 없이 위젯만 쓴다.

## 2. 패키지와 내보내기

npm 패키지 하나 `tiny-ai-chat` (DC-1).

| 경로 | 내용 | 형식 |
|---|---|---|
| `dist/tiny-ai-chat.js` | script 태그용 위젯. 로드하면 `<tiny-ai-chat>`를 등록한다. lithent 포함 | IIFE |
| `tiny-ai-chat` (`.`) | 같은 위젯 (번들러·`type="module"`용) | ESM |
| `tiny-ai-chat/relay` | `createRelay(options)` — Web 표준 fetch 핸들러 | ESM + `.d.ts` |
| `tiny-ai-chat/relay/openai` | `openai({ apiKey, model, … })` 어댑터 | ESM + `.d.ts` |
| `tiny-ai-chat/relay/gemini` | `gemini({ apiKey, model, … })` 어댑터 | ESM + `.d.ts` |
| `tiny-ai-chat/relay/anthropic` | `anthropic({ apiKey, model, … })` 어댑터 | ESM + `.d.ts` |
| `tiny-ai-chat/protocol` | 규약 타입, 이벤트 인코더·파서 (자기 백엔드·클라이언트용) | ESM + `.d.ts` |

- 제공자 SDK(`openai`, `@google/genai`, `@anthropic-ai/sdk`)는 **선택 peer 의존성**이다
  (`peerDependenciesMeta.*.optional`). 어댑터 파일마다 자기 SDK만 import하므로, 쓰는 제공자의 SDK만 설치하면 되고
  번들러가 다른 SDK를 찾지 않는다.
- `lithent`는 개발 의존성이다. 위젯 번들에 들어가므로 사용자는 따로 설치하지 않는다.
- CDN: `https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js` (`jsdelivr`·`unpkg` 필드).

## 3. 위젯

`src/widget/`. lithent 위젯 템플릿(`create-lithent` widget)으로 뼈대를 만든다 — 빌드(IIFE+ESM, 낮은 target),
`?inline` CSS, 크기 검사 스크립트를 그대로 쓴다.

### 3.1 속성·프로퍼티

| 이름 | 종류 | 기본값 | 설명 |
|---|---|---|---|
| `endpoint` | String (필수) | — | 중계 서버 또는 규약을 따르는 백엔드 URL |
| `heading` | String | `"Chat"` | 패널 머리글. HTML `title` 속성은 브라우저 툴팁이 떠서 쓰지 않는다 |
| `greeting` | String | 없음 | 첫 화면에 보이는 안내 말풍선. 모델에 보내지 않는다 |
| `placeholder` | String | `"Ask anything…"` | 입력칸 안내 |
| `position` | String | `"bottom-right"` | `bottom-right` · `bottom-left` · `inline`(제자리에 패널, 항상 열림) |
| `open` | Boolean | false | 처음부터 열린 상태 |
| `theme` | String | `"auto"` | `auto`(시스템 설정) · `light` · `dark` |
| `persist` | String | `"session"` | `session`(탭 안에서 보존, sessionStorage) · `none` (DC-13) |
| `max-history` | Number | 20 | 보낼 때 최근 몇 개 메시지까지 보낼지 |
| `with-credentials` | Boolean | false | 쿠키를 함께 보낸다 (자기 백엔드 인증용) |
| `labels` | Object (프로퍼티) | 영어 | 버튼·오류 문구 (`send`, `stop`, `close`, `open`, `retry`, `error`, `typing`, `clear`) |
| `headers` | Object (프로퍼티) | 없음 | 요청에 붙일 헤더 (자기 백엔드 인증용). 사이트 주인의 제공자 키를 넣지 말라고 문서에 적는다 |

### 3.2 이벤트

모두 `bubbles`·`composed` (`lithent/element`의 `emit`).

| 이벤트 | detail | 비고 |
|---|---|---|
| `chat-open` / `chat-close` | 없음 | |
| `chat-send` | `{ text }` | **취소 가능**. 페이지가 `preventDefault()`하면 보내지 않는다 (예: 로그인 요구) |
| `chat-reply` | `{ text, reason }` | 답 하나가 끝났을 때. `reason`: `stop` · `length` · `refusal` · `aborted` |
| `chat-error` | `{ code, message }` | §4.3 코드 |

### 3.3 모양

- Shadow DOM(기본). CSS는 `?inline`으로 넣는다.
- CSS 변수: `--tac-accent`, `--tac-accent-text`, `--tac-bg`, `--tac-text`, `--tac-muted`, `--tac-border`,
  `--tac-radius`, `--tac-font`, `--tac-width`, `--tac-height`, `--tac-z-index`.
- `::part()`: `launcher`, `panel`, `header`, `messages`, `message`, `input`, `send`.
- 좁은 화면(폭 480px 이하)에서는 열린 패널이 화면 전체를 쓴다 (RQ-12).

### 3.4 상태와 흐름

```
닫힘 ──열기──▶ 열림·대기 ──보내기──▶ 응답 대기(입력 중 표시) ──첫 delta──▶ 받는 중 ──done──▶ 열림·대기
                    ▲                     │ 멈추기/오류                  │ 멈추기/오류
                    └─────────────────────┴──────────────────────────────┘ (오류면 메시지 아래 "다시 시도")
```

- 대화는 클로저 변수 배열 `{ role, content }[]`. 받는 중인 답은 마지막 항목의 `content`에 이어 붙인다.
- 스트리밍 중 화면 갱신은 애니메이션 프레임당 한 번으로 묶는다 (DC-14).
- 목록이 맨 아래에 있을 때만 새 글자를 따라 내려간다. 사용자가 위로 올려 읽는 중이면 끌어내리지 않는다.
- 멈추기: `AbortController`로 fetch를 끊는다. 받은 데까지는 남기고 `reason: 'aborted'`.
- 다시 시도: 마지막 사용자 메시지를 다시 보낸다(실패한 답 칸은 지운다).
- 보존(`persist="session"`): `sessionStorage`의 `tiny-ai-chat:<endpoint>` 키. 읽기·쓰기는 try/catch로 감싸고
  실패하면 보존 없이 동작한다. "대화 지우기" 버튼이 있다.

### 3.5 접근성 (RQ-11)

- 런처: `<button aria-label=labels.open aria-expanded>`.
- 패널: `role="dialog"`, `aria-label=heading`. 열면 입력칸에 포커스, `Esc`로 닫으면 런처로 포커스.
- 입력: `Enter` 보내기, `Shift+Enter` 줄바꿈, 받는 중에는 보내기 버튼이 멈추기 버튼이 된다.
- 메시지 목록은 스트리밍 중 글자마다 읽히지 않게 live region으로 두지 않는다. 대신 숨김 live region(`aria-live="polite"`)에
  **완성된 답**을 한 번 넣는다 (DC-15).

### 3.6 마크다운 (RQ-9, DC-11)

모델 출력을 직접 만든 작은 파서로 lithent 가상 노드로 만든다. `innerHTML`은 쓰지 않는다.

| 지원 | 문법 |
|---|---|
| 문단·줄바꿈 | 빈 줄로 문단, 줄바꿈 유지 |
| 강조 | `**굵게**`, `*기울임*`/`_기울임_` |
| 코드 | `` `인라인` ``, ```` ``` ```` 코드 블록 (언어 표시만, 문법 강조 없음) |
| 링크 | `[글](url)` — `http:`·`https:`·`mailto:`만. 나머지는 글자로 둔다. `target="_blank" rel="noopener noreferrer nofollow"` |
| 목록 | `- `·`* `·`1. ` 한 단계 |
| 제목 | `#`~`###` → 굵은 문단 |

- HTML 태그는 글자 그대로 보인다.
- 스트리밍 중 닫히지 않은 코드 블록은 끝까지 코드 블록으로 그린다(깜빡임 방지).

## 4. 통신 규약 (RQ-8)

### 4.1 요청

```
POST {endpoint}
Content-Type: application/json

{ "messages": [ { "role": "user" | "assistant", "content": "..." }, ... ] }
```

- 마지막 메시지는 `user`여야 한다. 시스템 프롬프트는 보내지 않는다 — 중계 서버 설정에 있다.

### 4.2 응답 (성공)

`200`, `Content-Type: text/event-stream`. 이름 있는 SSE 이벤트:

```
event: delta
data: {"text":"안녕"}

event: delta
data: {"text":"하세요"}

: keep-alive

event: done
data: {"reason":"stop"}
```

- `reason`: `stop`(정상) · `length`(출력 상한) · `refusal`(제공자가 거절).
- 첫 글자가 늦을 수 있으므로(Claude의 사고 단계 등) 서버는 10초마다 주석 줄(`: keep-alive`)을 보낸다.
- 스트림 중 오류: `event: error` / `data: {"code":"upstream_error","message":"…"}` 뒤 스트림을 닫는다.
- `done`이나 `error` 없이 스트림이 끝나면 위젯은 `network_error`로 처리한다.

### 4.3 오류 (스트림 전)

JSON `{ "error": { "code": "...", "message": "..." } }`.

| 상태 | code | 언제 |
|---|---|---|
| 400 | `bad_request` | JSON이 아니거나 형식이 틀림, 마지막이 `user`가 아님 |
| 403 | `forbidden_origin` | 허용 출처가 아님 |
| 405 | `method_not_allowed` | POST·OPTIONS 외 |
| 413 | `too_large` | 메시지 수·길이 상한 초과 (상한을 넘는 오래된 메시지는 잘라서 보내므로 보통은 마지막 메시지가 너무 길 때) |
| 429 | `rate_limited` | 사용자 훅이 거절 |
| 502 | `upstream_error` | 제공자 오류 (인증·요금·과부하 등). 자세한 내용은 방문자에게 보이지 않고 `onError` 로그로만 |
| 500 | `internal` | 그 밖 |

위젯 쪽 전용: `network_error`(연결 실패·중간 끊김), `aborted`(사용자가 멈춤).

### 4.4 CORS

- `OPTIONS` 미리 요청에 `Access-Control-Allow-Origin: <요청 출처>`, `-Methods: POST`, `-Headers: content-type` +
  사용자가 쓰는 헤더, `Max-Age: 600`, `Vary: Origin`.
- `with-credentials`를 쓰면 `Access-Control-Allow-Credentials: true` (출처 목록이 `*`이면 허용하지 않는다).

## 5. 중계 서버 (`tiny-ai-chat/relay`)

```ts
// Cloudflare Workers
import { createRelay } from 'tiny-ai-chat/relay';
import { anthropic } from 'tiny-ai-chat/relay/anthropic';

export default {
  fetch: createRelay(env => ({
    provider: anthropic({ apiKey: env.ANTHROPIC_API_KEY, model: 'claude-opus-5-5' }),
    system: 'You answer questions about example.com.',
    allowedOrigins: ['https://example.com'],
  })),
};
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `provider` | (필수) | §6 어댑터 |
| `system` | 없음 | 시스템 프롬프트. 방문자가 알아낼 수 있으니 비밀을 넣지 말라고 문서에 적는다 |
| `allowedOrigins` | (필수) | 정확한 출처 목록, 또는 명시적 `'*'` (DC-9) |
| `allowNoOrigin` | false | `Origin` 헤더 없는 요청(curl·서버 간 호출)을 받을지 |
| `maxOutputTokens` | 4096 | 답 하나의 출력 토큰 상한 (DC-8) |
| `maxMessages` | 20 | 이보다 오래된 메시지는 잘라서 보낸다 |
| `maxMessageChars` | 4000 | 메시지 하나의 글자 수 상한. 넘으면 413 |
| `onRequest` | 없음 | `(request, env) => Response \| void` — `Response`를 돌려주면 그걸로 거절(속도 제한 등) |
| `onError` | `console.error` | `(error, request) => void` — 서버 로그용. 방문자에게는 일반 메시지만 |
| `keepAliveMs` | 10000 | 주석 줄 간격 |

- `createRelay`는 옵션 객체 또는 `env => 옵션` 함수를 받는다. 핸들러 모양은 `(request, env?, ctx?) => Promise<Response>`로
  Workers의 `fetch(request, env, ctx)`에 그대로 맞는다. Node는 템플릿의 작은 어댑터(`node:http` ↔ `Request`/`Response`)로 붙인다.
- 방문자가 연결을 끊으면(`request.signal`) 제공자 요청도 끊는다 — 비용 절약.
- 요청 처리 순서: 메서드 → 출처 → `onRequest` → 본문 검사·자르기 → `provider.stream()` → SSE.

### 5.1 템플릿 (`templates/`)

| 템플릿 | 내용 |
|---|---|
| `templates/cloudflare-worker/` | `wrangler.toml`, `src/index.ts`, README(비밀 등록: `wrangler secret put`) |
| `templates/node/` | `server.mjs`(`node:http` + 어댑터, `.env` 읽기), README |

## 6. 제공자 어댑터

공통 모양:

```ts
type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ProviderEvent = { type: 'text'; text: string } | { type: 'end'; reason: 'stop' | 'length' | 'refusal' };
type Provider = {
  name: string;
  stream(input: {
    system?: string;
    messages: ChatMessage[];
    maxOutputTokens: number;
    signal: AbortSignal;
  }): AsyncIterable<ProviderEvent>;
};
```

- 공식 SDK를 쓴다 (DC-4). 각 어댑터는 테스트용으로 `client`(SDK 클라이언트)를 주입받을 수 있다.
- SDK 오류는 던지고, 중계 서버가 `upstream_error`로 바꾼다.
- 아래 호출 모양은 설계 시점(2026-11-23)에 확인한 것이다. 구현 단계에서 설치한 SDK 버전으로 다시 확인한다.

| 어댑터 | 호출 | 글자 | 끝 |
|---|---|---|---|
| `openai` | `client.responses.create({ model, instructions: system, input: messages, max_output_tokens, stream: true }, { signal })` (DC-5) | `response.output_text.delta` | `response.completed` → `stop`, 출력 상한으로 `response.incomplete` → `length`, 거절 이벤트 → `refusal` |
| `gemini` | `ai.models.generateContentStream({ model, contents, config: { systemInstruction, maxOutputTokens, abortSignal } })` — `assistant`는 `model` 역할로 바꾼다 | 각 조각의 `text` | `finishReason`: `STOP` → `stop`, `MAX_TOKENS` → `length`, `SAFETY` 등 → `refusal` |
| `anthropic` | `client.beta.messages.stream({ model, max_tokens, system, messages, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal })` (DC-7) | `content_block_delta`의 `text_delta` (사고 블록은 무시) | `stop_reason`: `end_turn` → `stop`, `max_tokens` → `length`, `refusal` → `refusal` |

- `model`은 필수다. 기본 모델을 두지 않는다 (DC-6). README 예시는 Claude `claude-opus-5-5`,
  OpenAI·Gemini는 릴리스 시점에 각 사 모델 목록에서 확인한 이름을 쓴다.
- Claude 어댑터 추가 옵션: `effort`(`low`~`max`, 없으면 API 기본값), `fallbacks`(기본 `'default'`, `false`면 끔).
- OpenAI·Gemini 어댑터 추가 옵션: SDK 요청에 그대로 합칠 `extra` 객체 (온도 등).

## 7. 크기 예산 (RQ-10, DC-12)

| 부분 | 예상 (brotli) |
|---|---|
| lithent 코어 | 약 4.8KB |
| `lithent/element` | 약 1.0KB |
| 위젯 UI·상태·fetch·SSE 파서 | 약 2KB |
| 마크다운 | 약 1KB |
| CSS | 약 1KB |
| **합계** | **약 9.8KB / 예산 10KB** |

- 여유가 거의 없다. Phase 1에서 빈 위젯으로 lithent 몫을 먼저 재고, 단계마다 크기를 기록한다.
- 넘으면 순서대로: CSS 줄이기 → 기능 줄이기(제목 문법 등) → 사용자와 예산 조정. 예산을 말없이 올리지 않는다.

## 8. 보안 메모

- 제공자 키는 중계 서버의 환경 변수·비밀에만. 위젯 빌드 결과에 제공자 SDK·키 관련 코드가 없는지 검사한다(RQ-5).
- `Origin` 확인은 브라우저 남용만 막는다. curl 같은 비브라우저 요청은 출처를 속일 수 있으므로, README에서
  ① 제공자 콘솔의 지출 한도, ② Cloudflare 속도 제한(`onRequest`로 연결) 사용을 권한다.
- 시스템 프롬프트는 방문자가 알아낼 수 있다. 비밀·내부 정보를 넣지 않는다.
- 방문자는 모델이 무엇이든 말하게 시도할 수 있다. 위젯은 안전하게 그리기만 하고(§3.6), 내용 책임은 사이트 주인에게 있다고 적는다.

## 9. 테스트 전략

| 층 | 도구 | 대상 |
|---|---|---|
| 단위 | Vitest | SSE 인코더·파서(조각 경계·CRLF·주석), 마크다운(XSS 사례), 중계 서버(메서드·출처·상한·훅·끊김·오류 변환), 어댑터(가짜 SDK 클라이언트, 이벤트 녹화본) |
| 위젯 단위 | Vitest + jsdom + `lithent/test` | 열기·닫기·보내기·멈추기·재시도·보존·이벤트·라벨, 가짜 `fetch` 스트림 |
| E2E | Playwright (Chromium·Firefox·WebKit) | 빌드한 IIFE를 script 태그로 넣은 호스트 페이지 + 가짜 제공자를 쓴 Node 중계 서버. 스트리밍 표시, 멈추기, 오류·재시도, 키보드, 모바일 뷰포트, CSS 격리, 새로고침 뒤 보존 |
| 설치 소비자 | `npm pack` 결과 | 하위 경로 import, 타입, 위젯 IIFE |
| 수동 | 실제 키 | [MANUAL_TEST_CHECKLIST.md](./MANUAL_TEST_CHECKLIST.md) |

## 10. 결정

- [x] **DC-1 패키지 하나, 하위 경로로 나눔.** 위젯·중계 서버·어댑터·규약을 `tiny-ai-chat` 하나로 내고 하위 경로로 나눈다.
  패키지를 여러 개로 나누면 npm 신뢰 발행 설정과 버전 관리가 그만큼 늘어난다.
- [x] **DC-2 키는 중계 서버에만. 방문자 본인 키(BYOK)는 v0.1에서 빼고 후속 후보.** 사용자가 2026-11-23 설명을 듣고 동의.
  BYOK는 세 제공자 어댑터를 위젯 번들에 넣어야 해서 크기 예산(DC-12)을 넘고, 공개 사이트에서 잘못 쓰면 키가 샌다.
  (참고: 브라우저 직접 호출 시 Claude는 `anthropic-dangerous-direct-browser-access: true` 헤더가 필요하다.)
- [x] **DC-3 규약은 POST JSON → 이름 있는 SSE.** `EventSource`는 POST를 못 하므로 위젯은 `fetch` + `ReadableStream`으로
  읽는다. SSE는 어느 서버 언어로도 쉽게 만들 수 있어 자기 백엔드 사용자(사용 장면 3)에게 맞다.
  `TextDecoderStream`은 Safari 14에 없으므로 `TextDecoder`로 직접 푼다.
- [x] **DC-4 제공자마다 공식 SDK를 쓴다.** 스트림 해석·재시도·오류 타입을 SDK가 관리한다. 직접 `fetch`로 짜면
  세 제공자의 이벤트 형식 변화를 우리가 따라가야 한다. 어댑터를 하위 경로로 나눠(DC-1) 쓰지 않는 SDK는 설치도 번들도 되지 않는다.
  SDK를 쓰면 중계 서버 번들이 커지지만 서버 쪽이라 방문자 다운로드에는 영향이 없다.
- [x] **DC-5 OpenAI는 Responses API.** OpenAI 문서가 스트리밍에 권하는 API이고 이벤트가 의미 단위(`response.output_text.delta`)다.
- [x] **DC-6 기본 모델 없음.** `model` 필수. 모델 이름은 자주 바뀌어 기본값이 금방 낡는다. 예시 이름은 README에서만 관리한다.
- [x] **DC-7 Claude는 서버 측 fallback을 기본으로 켠다.** Claude Opus 5.5 등은 안전 분류기가 요청을 거절할 수 있고
  (`stop_reason: "refusal"`), `fallbacks: 'default'`(베타 `server-side-fallback-2026-07-01`)를 켜면 같은 호출 안에서
  다른 모델이 이어받는다. 끌 수 있다(`fallbacks: false`). Claude API 가이드의 기본 권장을 따른다.
- [x] **DC-8 출력 상한 기본 4096 토큰.** 공개 엔드포인트라 답 하나의 비용에 상한이 필요하다. 사이트 안내용 답에는 충분하고,
  잘리면 `reason: 'length'`로 위젯이 "답이 길어 잘렸다"를 보인다. 옵션으로 바꾼다.
- [x] **DC-9 허용 출처는 필수.** 빠뜨리면 `createRelay`가 시작할 때 오류를 낸다. 모든 출처를 열려면 `'*'`를 명시해야 한다.
  출처 없는 요청(curl 등)은 기본 거절, `allowNoOrigin: true`로 연다(개발·서버 간 호출용).
- [x] **DC-10 lithent 기본 코어 + `lithent/element`, Shadow DOM.** concurrent 코어는 더 크고, 위젯 규모에서는 애니메이션 프레임
  묶음(DC-14)으로 충분하다. lithent는 번들에 넣어 script 한 줄로 끝나게 한다.
- [x] **DC-11 마크다운은 직접 만든 작은 부분집합.** 범용 라이브러리는 수 KB라 예산을 넘고 HTML 통과 옵션이 위험하다.
  가상 노드로 바로 만들어 `innerHTML`을 쓰지 않는다.
- [x] **DC-12 크기 예산 brotli 10KB (script 태그 번들 전체).** 사용자에게 "10KB 안쪽"으로 소개했다. CI에서 넘으면 실패.
- [x] **DC-13 보존 기본값 `session`.** 사이트 안에서 페이지를 옮길 때 대화가 사라지면 불편하다. sessionStorage는 탭을 닫으면
  지워져 개인정보 부담이 작다. `persist="none"`으로 끈다.
- [x] **DC-14 스트리밍 중 렌더는 프레임당 한 번.** 네트워크 조각마다 다시 그리면 긴 답에서 마크다운 파싱이 쌓인다.
- [x] **DC-15 완성된 답만 스크린리더에 알린다.** 글자마다 읽히는 live region은 사용할 수 없을 만큼 시끄럽다.
- [x] **DC-16 도구: pnpm, TypeScript, Vite, Vitest, Playwright, MIT.** lithent 저장소와 같아 유지가 쉽다.
- [ ] **DC-17 데모 페이지 — TBD.** 후보: (a) GitHub Pages에 위젯을 두고 데모 페이지 스크립트가 `fetch`를 가로채 정해진 답을
  스트리밍(키 없음, 비용 없음), (b) 사용자 계정의 Workers에 낮은 상한으로 실제 모델 연결. Phase 9 전에 사용자와 정한다.
- [x] **DC-18 첫 커밋은 `main`, 이후는 작업 브랜치 + PR.** 사용자 결정(2026-11-23). 저장소가 비어 있어 처음 푸시한 브랜치가
  GitHub 기본 브랜치가 되므로 문서만 담은 첫 커밋을 `main`에 올린다. 구현은 작업 브랜치에서 하고 PR로 `main`에 합친다.
