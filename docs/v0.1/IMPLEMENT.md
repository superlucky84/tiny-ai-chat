# IMPLEMENT — tiny-ai-chat v0.1

- 관련 문서: [REQUIREMENTS.md](./REQUIREMENTS.md) → [DESIGN.md](./DESIGN.md) → [MANUAL_TEST_CHECKLIST.md](./MANUAL_TEST_CHECKLIST.md)

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 문서 작성 | done |
| 1 | 저장소 뼈대와 CI | done |
| 2 | 통신 규약과 중계 서버 핵심 | done |
| 3 | 제공자 어댑터 3개 | done |
| 4 | 위젯 UI와 상태 | done |
| 5 | 안전한 마크다운 | done |
| 6 | 배포 템플릿과 로컬 실행 | done |
| 7 | Test Hardening | done |
| 8 | Integration Test | done (실제 키 점검 M-1~M-3 보류) |
| 9 | 문서·데모·릴리스 준비 | in progress |

공통 완료 조건: `pnpm lint`, `pnpm type-check`, `pnpm test` 통과, 위젯을 건드린 단계는 `pnpm build` 뒤 크기 예산(10KB) 안,
단계마다 이 표와 해당 절의 체크박스·`Files:` 갱신.

## Phase 0 — 문서 작성: done

Refs: RQ-1, RQ-2, RQ-3, RQ-4, RQ-5, RQ-6, RQ-7, RQ-8, RQ-9, RQ-10, RQ-11, RQ-12, RQ-13, RQ-14, RQ-15, RQ-16

- [x] REQUIREMENTS·DESIGN·IMPLEMENT·MANUAL_TEST_CHECKLIST 초안
- [x] 사용자 검토, DC-18 결정(첫 커밋 `main`, 이후 작업 브랜치 + PR)
- [x] 문서 커밋·푸시 (`main` 첫 커밋)

Files:
- `docs/v0.1/REQUIREMENTS.md` (added)
- `docs/v0.1/DESIGN.md` (added)
- `docs/v0.1/IMPLEMENT.md` (added)
- `docs/v0.1/MANUAL_TEST_CHECKLIST.md` (added)

## Phase 1 — 저장소 뼈대와 CI: done

Refs: RQ-1, RQ-10, RQ-16, DC-1, DC-10, DC-12, DC-16

진입: Phase 0 승인.

- [x] `npx create-lithent@0.5.0 --template widget`으로 만든 뼈대에서 설정(ESLint·Prettier·EditorConfig·tsconfig·vite·크기 검사)을
  가져와 `src/widget/`에 `<tiny-ai-chat>`을 둠
- [x] pnpm 10.28, TypeScript strict, ESLint(스크립트는 Node 전역), Prettier, Vitest 5(기본 Node, 위젯 테스트는 파일 첫 줄
  `// @vitest-environment jsdom`), `package.json` `exports`는 위젯(`.`)만
- [x] 빌드: 위젯 IIFE(`dist/tiny-ai-chat.js`)+ESM(`.mjs`), `dist/index.html`(호스트 페이지가 빌드 결과를 script로 로드)
- [x] 크기 검사: IIFE brotli 10KB 넘으면 실패 (`scripts/size.mjs`, DC-12)
- [x] 빈 위젯 크기 기록 — 아래
- [x] GitHub Actions `CI`: PR과 `main` 푸시에서 lint·format:check·type-check·test·build(크기) (Node 22)
- [x] `LICENSE`(MIT), README 뼈대("Built with lithent" 포함)
- 계획에서 바꾼 것: 중계 서버·어댑터·규약의 빌드와 `exports`는 그 코드가 생기는 Phase 2~3에서 붙인다. 빈 모듈을 미리 내지 않는다.
- `package.json`은 Phase 9까지 `"private": true` (실수로 발행되지 않게).

빈 위젯 크기 (2026-11-23, lithent 1.26.0 + `lithent/element` + 런처 버튼):

| 파일 | raw | gzip | brotli |
|---|---|---|---|
| `dist/tiny-ai-chat.js` (IIFE) | 13.78KB | 5.89KB | **5.43KB** |
| `dist/tiny-ai-chat.mjs` (ESM, 압축 안 함) | 18.94KB | 6.69KB | 6.07KB |

남은 예산은 약 4.6KB(brotli). DESIGN §7 예상(lithent 몫 5.8KB)보다 0.4KB 여유가 있다.

기본 테스트: `src/widget/ChatWidget.test.ts` — 요소 등록·런처 렌더, `labels` 프로퍼티 반영 (2개 통과).
완료: 로컬에서 lint·format:check·type-check·test·build 통과. CI 결과는 PR에서 확인.

Files:
- `.editorconfig` (added)
- `.github/workflows/ci.yml` (added)
- `.gitignore` (added)
- `.nvmrc` (added)
- `.prettierrc` (added)
- `LICENSE` (added)
- `README.md` (added)
- `docs/v0.1/IMPLEMENT.md` (modified)
- `eslint.config.js` (added)
- `index.html` (added)
- `package.json` (added)
- `pnpm-lock.yaml` (added)
- `scripts/size.mjs` (added)
- `src/widget/ChatWidget.test.ts` (added)
- `src/widget/ChatWidget.tsx` (added)
- `src/widget/chat-widget.css` (added)
- `src/widget/chatProps.ts` (added)
- `src/widget/main.ts` (added)
- `tsconfig.json` (added)
- `vite.config.js` (added)

## Phase 2 — 통신 규약과 중계 서버 핵심: done

Refs: RQ-6, RQ-7, RQ-8, DC-3, DC-8, DC-9, DC-19

진입: Phase 1 완료.

- [x] `src/shared/protocol.ts`: 타입, `encodeEvent`, `KEEP_ALIVE`, 스트림 파서(조각 경계·CRLF·CR·나뉜 CRLF·여러 줄 `data`·주석),
  `readEventStream`(UTF-8 조각 해독)
- [x] `src/relay/index.ts`: `createRelay` — 옵션 검사(`provider`·`allowedOrigins` 필수, `'*'`와 `allowCredentials` 동시 금지),
  `env => 옵션` 함수(같은 env 객체는 한 번만 만듦), 메서드, CORS·출처(`allowNoOrigin`, `allowCredentials`), `onRequest`(돌려준 응답에
  CORS 머리글 추가), 본문 크기 상한·검사·자르기(맨 앞 `assistant` 제거), 바로 `200` + keep-alive, `provider.stream()` → SSE,
  제공자 오류는 일반 문구의 `event: error` + `onError`, 스트림 취소와 `request.signal`로 제공자 abort
- [x] `src/relay/testing/fakeProvider.ts`: 정해진 조각·간격·끝 이유·오류를 흉내 내고 받은 입력을 기록
- [x] 빌드: `tsconfig.build.json`으로 `src/relay`·`src/shared`를 `dist/`에 JS + `.d.ts`로 (import는 `.js` 확장자라 Node ESM·NodeNext에서 그대로 풀림),
  `exports`에 `./relay`·`./protocol`
- [x] DESIGN 갱신(코드보다 먼저): DC-19(제공자 오류는 스트림 안에서), §4.3 표, `allowCredentials` 옵션, 본문 크기 상한

기본 테스트: `protocol.test.ts` 9개(왕복, 1~12자 조각 분할, CRLF/CR/나뉜 CRLF, 여러 줄 data, 모르는 필드, 마지막 빈 줄 없음,
UTF-8 조각), `relay.test.ts` 28개(§4.3의 400·403·405·413·429·500 각각, preflight, `'*'`, 자격 증명, 자르기, 시스템 프롬프트·상한 전달,
delta·done, 끝 이유 없음, 오류 숨김과 `onError`, keep-alive, 스트림 취소·요청 signal abort).
음성 대조: 파서의 `\r` 보류를 끄면 "나뉜 CRLF" 테스트가 실패하는 것을 확인.
완료: 39개 통과(위젯 2개 포함).

Files:
- `docs/v0.1/DESIGN.md` (modified)
- `package.json` (modified)
- `src/relay/index.ts` (added)
- `src/relay/relay.test.ts` (added)
- `src/relay/testing/fakeProvider.ts` (added)
- `src/relay/types.ts` (added)
- `src/shared/protocol.test.ts` (added)
- `src/shared/protocol.ts` (added)
- `tsconfig.build.json` (added)

## Phase 3 — 제공자 어댑터 3개: done

Refs: RQ-5, DC-4, DC-5, DC-6, DC-7

진입: Phase 2 완료. 설치한 SDK(`@anthropic-ai/sdk` 1.12.0, `openai` 7.62.0, `@google/genai` 3.6.1)의 타입으로 DESIGN §6 호출 모양을
확인했다 — 그대로 맞아 DESIGN 변경 없음. 어댑터는 실제 SDK 타입으로 `tsc` 검사를 통과한다.

- [x] `src/relay/openai.ts`: `responses.create({ …extra, model, input, max_output_tokens, instructions?, stream: true }, { signal })`.
  `response.output_text.delta` → 글자, `response.refusal.delta` → 글자 + `refusal`, `response.incomplete`(`content_filter` → `refusal`,
  `max_output_tokens`·`max_messages` → `length`), `response.failed`·`error` → 던짐
- [x] `src/relay/gemini.ts`: `models.generateContentStream({ model, contents(assistant→model), config: { …extra, maxOutputTokens, abortSignal,
  systemInstruction? } })`. `finishReason` `STOP`/`MAX_TOKENS`/그 밖 → `stop`/`length`/`refusal`, `promptFeedback.blockReason` → `refusal`
- [x] `src/relay/anthropic.ts`: `beta.messages.stream({ model, max_tokens, messages, system?, output_config.effort?, betas:
  ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal })`. `text_delta`만 글자(사고 블록 무시), `stop_reason`
  `refusal`/`max_tokens`·`model_context_window_exceeded`/그 밖 → `refusal`/`length`/`stop`. `fallbacks: false`면 베타와 fallback을 빼고 보낸다
- [x] 공통: `model` 필수, `apiKey` 또는 `client` 필수, `client` 주입, signal 전달
- [x] `package.json`: `./relay/openai`·`./relay/gemini`·`./relay/anthropic` exports, 세 SDK를 선택 peer 의존성(`peerDependenciesMeta.optional`)과
  개발 의존성으로

기본 테스트: `adapters.test.ts` 29개 — 세 어댑터가 같은 계약 묶음(글자·`stop`·`length`·`refusal`·SDK 오류 통과·`createRelay` 뒤에서
SSE까지)을 통과, `model`·키 필수, 제공자별 요청 모양(Claude fallback 기본값·끄기·effort, OpenAI instructions·input·상한·거절 글자·실패 이벤트,
Gemini 역할 변환·abortSignal·차단된 프롬프트).
빌드한 `dist/relay/*.js`를 Node ESM에서 바로 import해 가짜 클라이언트로 요청 1회와 세 어댑터 생성 확인.
완료: 전체 68개 통과, 위젯 크기 변화 없음(5.43KB). 실제 API 호출은 수동 M-1~M-3(Phase 8).

Files:
- `docs/v0.1/IMPLEMENT.md` (modified)
- `package.json` (modified)
- `pnpm-lock.yaml` (modified)
- `src/relay/adapters.test.ts` (added)
- `src/relay/anthropic.ts` (added)
- `src/relay/gemini.ts` (added)
- `src/relay/openai.ts` (added)

## Phase 4 — 위젯 UI와 상태: done

Refs: RQ-1, RQ-2, RQ-3, RQ-4, RQ-11, RQ-12, RQ-13, RQ-14, DC-10, DC-13, DC-14, DC-15

진입: Phase 2 완료(규약 파서 사용).

- [x] 속성·프로퍼티·라벨 (DESIGN §3.1). 최신 props는 렌더 함수가 받은 값으로 갱신해 핸들러가 씀
- [x] 런처(열림/닫힘 아이콘, `aria-expanded`)·패널(`role="dialog"`)·머리글(대화 지우기·닫기)·메시지 목록·입력칸·보내기/멈추기,
  위치 3종(`bottom-right`·`bottom-left`·`inline`), 테마(`auto`·`light`·`dark`), 폭 480px 이하에서 전체 화면, CSS 변수 11개,
  `::part()` 7개, 접근성 초점 표시
- [x] `src/widget/chat.ts`: `ask()` — fetch → 상태 코드 오류(JSON의 `error.code`) → `readEventStream` → delta·done·error,
  `done` 없이 끝나면 `network_error`, 멈춤은 AbortError 그대로. `store` — sessionStorage(예외는 무시)
- [x] 상태 흐름(§3.4): 응답 대기(입력 중 표시) → 받는 중(프레임당 한 번 그리기, 맨 아래일 때만 따라 내려감) → 끝
- [x] 멈추기(받은 글자 유지, `reason: 'aborted'`), 오류(`role="alert"`, `data-code`)·다시 시도(실패한 답 칸 제거 후 재요청),
  대화 지우기, 보존(`persist`, 키 `tiny-ai-chat:<endpoint>`, 실패한 답은 저장하지 않음), `max-history`, `headers`, `with-credentials`
- [x] 이벤트 5종(§3.2), `chat-send` 취소
- [x] 접근성(§3.5): 열면 입력칸·닫으면 런처로 초점, `Esc`로 닫기, 완성된 답만 숨김 live region에. `Enter` 보내기,
  `Shift+Enter` 줄바꿈, IME 조합 중 `Enter`(한국어 등)는 보내지 않음
- [x] 마크다운은 아직 글자 그대로(`white-space: pre-wrap`) — Phase 5에서 교체

찾은 문제와 고친 것:
- 보낸 뒤 입력칸이 비지 않음(단위 테스트가 잡음): 입력 때 다시 그리지 않아 가상 `value`가 계속 `''`라서 lithent가 DOM을 건드리지 않았다.
  보낼 때 textarea를 직접 비운다.
- 아이콘이 보이지 않음(브라우저 확인에서 발견): lithent는 `<svg>`의 네임스페이스를 `xmlns` prop에서 가져오고, 없으면 문자열 `"undefined"`가 된다
  (lithent 문서 Example17에 "xmlns 필수"로 적혀 있음). 아이콘을 `xmlns`를 붙이는 작은 함수로 만듦.
  **lithent 개선 후보**: `xmlns` 없는 `<svg>`도 SVG 네임스페이스로 만들거나 개발 모드에서 경고.

기본 테스트: `ChatWidget.test.ts` 22개(jsdom, 가짜 relay fetch) — 열기·닫기·초점·Esc, 처음부터 열림·인사말, inline, 라벨,
스트리밍 표시와 이벤트·live region·입력칸 비우기, 이전 대화 포함, `max-history`, 입력 중 표시, 길이 잘림 표시, 멈추기, 빈 글·중복 보내기 막기,
`chat-send` 취소, 헤더·자격 증명, 오류 4종(403·fetch 실패·error 이벤트·done 없음)과 다시 시도, Shift·IME Enter, 보존 복원·`none`·지우기·저장소 예외.
브라우저 확인(Chromium, 빌드한 IIFE + 가짜 제공자 relay): 1280px·390px에서 열기·보내기·스트리밍·완료, 가로 넘침 0, 페이지 오류 0,
페이지의 button·p 스타일이 위젯에 스며들지 않음.
완료: 전체 88개 통과, 크기 **8.28KB** brotli (예산 10KB, 남은 1.72KB).

Files:
- `docs/v0.1/IMPLEMENT.md` (modified)
- `src/widget/ChatWidget.test.ts` (modified)
- `src/widget/ChatWidget.tsx` (modified)
- `src/widget/chat-widget.css` (modified)
- `src/widget/chat.ts` (added)

## Phase 5 — 안전한 마크다운: done

Refs: RQ-9, DC-11

진입: Phase 4 완료.

- [x] `src/widget/markdown.tsx`: DESIGN §3.6 문법 → lithent 가상 노드. 문단(빈 줄로 나눔, 줄바꿈 유지), `**굵게**`, `*기울임*`·`_기울임_`
  (단어 안의 `_`는 그대로 — `my_var_name`), `` `코드` ``, 코드 블록(안의 마크다운·HTML은 글자), `[글](url)`(괄호 한 단계 허용 — 위키백과 주소),
  `-`·`*`·`+`·`1.`·`1)` 목록, `#`~`###` → 굵은 문단
- [x] 글자는 항상 텍스트 노드. `innerHTML` 없음. 링크는 `http:`·`https:`·`mailto:`만 `<a target="_blank" rel="noopener noreferrer nofollow">`,
  나머지 주소는 링크 없이 글만
- [x] 닫히지 않은 코드 블록은 끝까지 코드 블록 (스트리밍 중 깜빡임 방지)
- [x] 위젯: 답은 마크다운, 방문자 메시지와 인사말은 글자 그대로. 메시지 상자를 `<p>`에서 `<div>`로(블록 요소를 담으려고)
- [x] Safari 14 대상이라 정규식 lookbehind를 쓰지 않음

기본 테스트: `markdown.test.tsx` 29개 — 문법 17가지, 빈 답, XSS(`<script>`, `<img onerror>`, `<iframe>`, 코드 블록 안 HTML은 요소가 생기지 않고 글자로),
위험한 주소 6가지(`javascript:` 대소문자, `data:`, `vbscript:`, `//`, 상대 경로)는 링크 없이 글만, 주소로 속성 탈출 시도 시 속성이 `href`·`rel`·`target`뿐.
처음 테스트에서 괄호가 든 주소(`javascript:alert(1)`)가 첫 `)`에서 잘려 `)`가 남는 것을 발견 — 링크는 만들어지지 않아 안전했지만,
위키백과식 주소도 같은 이유로 잘리므로 괄호 한 단계를 허용하도록 고침.
브라우저 확인: 굵게·목록·인라인 코드가 1280px·390px에서 그려짐, 가로 넘침 0.
완료: 전체 117개 통과, 크기 **8.87KB** brotli (남은 1.13KB).

Files:
- `docs/v0.1/IMPLEMENT.md` (modified)
- `src/widget/ChatWidget.tsx` (modified)
- `src/widget/chat-widget.css` (modified)
- `src/widget/markdown.test.tsx` (added)
- `src/widget/markdown.tsx` (added)

## Phase 6 — 배포 템플릿과 로컬 실행: done

Refs: RQ-6, RQ-15, DC-20, DC-21

진입: Phase 3·4 완료.

- [x] DESIGN 갱신(코드보다 먼저): DC-20 `tiny-ai-chat/relay/node`(`toNodeHandler`), DC-21 `tiny-ai-chat/relay/fake`(키 없는 데모 제공자), §2 표, §5.1 템플릿
- [x] `src/relay/node.ts`: Node `IncomingMessage` → `Request`(본문은 스트림, `duplex: 'half'`), `Response` → `ServerResponse`,
  연결이 끊기면 `request.signal` abort와 응답 읽기 취소. Express에도 그대로 붙음
- [x] `src/relay/fake.ts`: 받은 말을 마크다운이 섞인 답으로 단어마다 30ms 간격으로 되돌려 줌, abort하면 멈춤
- [x] 중계 서버: 본문을 상한까지만 읽고 넘으면 413 (Content-Length 없는 chunked 본문 대비 — `request.text()` 대신)
- [x] `templates/node/`: `server.mjs`(환경 변수로 제공자 선택, 고른 SDK만 동적 import, `/api/chat` 중계 + `/` 데모 페이지, 자기 출처 자동 허용),
  `.env.example`, `package.json`(`node --env-file-if-exists=.env`, Node 22.9+), README(키 없이 시험 → 제공자 연결 → 공개 전 점검)
- [x] `templates/cloudflare-worker/`: `src/index.ts`(Claude 기본, OpenAI·Gemini 교체 방법은 주석, `PROVIDER=fake`면 키 없이), `wrangler.toml`
  (`nodejs_compat`, vars, 비밀은 `wrangler secret put`), `package.json`(wrangler 4.166), README
- [x] 저장소 `pnpm dev`: Vite 개발 서버가 `/api/chat`에 중계 서버를 붙임(src를 직접 불러 수정이 바로 반영). 기본은 데모 제공자,
  `.env`(git 제외)에 `PROVIDER`·`MODEL`·키를 두면 실제 제공자 — 계획의 `pnpm dev:real`은 따로 두지 않고 `.env`로 대신함
- [x] `scripts/check-templates.mjs`(`pnpm check:templates`, CI의 build 뒤): 두 템플릿을 임시 폴더에 복사하고 `node_modules/tiny-ai-chat`을
  이 저장소로 연결해 설치본처럼 실행. Node — 서버 기동, 스트림·`done`, 다른 출처 403, 데모 페이지, 404. Workers — `src/index.ts`가 패키지
  공개 타입으로 타입 검사 통과, `fetch`를 Node에서 불러 `PROVIDER=fake`로 스트림
- [x] 빌드 수정: `tsconfig.build.json`에 `DOM.Iterable`(없어서 `node.ts` 타입 오류였는데 tsc가 파일은 써서 템플릿 검사는 통과했었다)과
  `noEmitOnError`(타입 오류면 빌드가 실패하고 파일도 쓰지 않게)

기본 테스트: `node.test.ts` 6개 — 실제 `node:http` 서버로 스트림·상태 코드·preflight, 방문자 연결 끊김 → 제공자 abort, chunked 본문 413,
데모 제공자 되돌려 주기·abort. `pnpm check:templates` 7항목 통과. `pnpm dev`에서 `/api/chat` 스트림과 호스트 페이지 확인.
완료: 전체 123개 통과, 크기 8.87KB 그대로. 실제 키로 Workers 배포(M-4)는 사용자 준비 뒤로 미룸.

Files:
- `.github/workflows/ci.yml` (modified)
- `docs/v0.1/DESIGN.md` (modified)
- `docs/v0.1/IMPLEMENT.md` (modified)
- `package.json` (modified)
- `scripts/check-templates.mjs` (added)
- `src/relay/fake.ts` (added)
- `src/relay/index.ts` (modified)
- `src/relay/node.test.ts` (added)
- `src/relay/node.ts` (added)
- `templates/cloudflare-worker/README.md` (added)
- `templates/cloudflare-worker/package.json` (added)
- `templates/cloudflare-worker/src/index.ts` (added)
- `templates/cloudflare-worker/wrangler.toml` (added)
- `templates/node/.env.example` (added)
- `templates/node/README.md` (added)
- `templates/node/package.json` (added)
- `templates/node/server.mjs` (added)
- `tsconfig.build.json` (modified)
- `vite.config.js` (modified)

## Phase 7 — Test Hardening: done

Refs: RQ-3, RQ-5, RQ-9, RQ-10, RQ-16

진입: Phase 5·6 완료.

- [x] 파서: 시드를 고정한 무작위 조각 분할 500회(LF·CRLF·CR, 한글·이모지, keep-alive 포함)에서 같은 이벤트
- [x] 마크다운: 악의적 입력 10종(별표 2만 개, 닫히지 않은 굵게·링크, 대괄호 중첩, 백틱, `_` 반복, 주소 속 괄호, 긴 한 줄, 목록 5천 줄,
  닫히지 않은 긴 코드 블록)이 각각 250ms 안에 끝남 — 정규식 폭주 없음
- [x] 중계 서버: 첫 글자 전에 실패하는 제공자, 첫 글자 전 취소는 오류로 기록하지 않음, 동시 요청 20개가 섞이지 않음
- [x] 위젯: 받는 중에 닫았다 다시 열어도 답이 이어짐, 받는 중 대화 지우기는 요청을 끊고 빈 대화로, endpoint마다 대화가 따로
- [x] `scripts/check-bundle.mjs`(build 끝에서 실행): 위젯 번들 두 개에 제공자 호스트·SDK 이름·API 키 처리 문자열·`eval`이 없음 (RQ-5)
- [x] ESLint 규칙(`src/widget`): JSX `innerHTML`, `innerHTML`·`outerHTML` 대입, `insertAdjacentHTML` 금지 (RQ-9).
  처음에는 번들에서 `innerHTML`을 찾으려 했으나 lithent 코어가 자체 `innerHTML` prop 기능으로 그 글자를 가지고 있어, 위젯 소스 검사로 옮김.
  일부러 넣은 두 형태를 모두 잡는 것을 확인
- [x] `scripts/check-mutations.mjs`(`pnpm test:mutations`, CI): 안전장치 11개를 하나씩 망가뜨리고 해당 테스트가 실패하는지 —
  파서 CRLF 보류, 출처 검사, 취소 시 제공자 abort, 오류 내용 숨김, 맨 앞 assistant 제거, 본문 크기 상한, Node 연결 끊김 abort,
  Claude 거절 변환, 링크 주소 제한, 보낸 뒤 입력칸 비우기, IME 조합 중 Enter. **11개 모두 잡힘**

완료: 전체 140개 통과, 변이 11/11 검출, 번들 검사 통과, 크기 8.87KB.

Files:
- `.github/workflows/ci.yml` (modified)
- `docs/v0.1/IMPLEMENT.md` (modified)
- `eslint.config.js` (modified)
- `package.json` (modified)
- `scripts/check-bundle.mjs` (added)
- `scripts/check-mutations.mjs` (added)
- `src/relay/relay.test.ts` (modified)
- `src/shared/protocol.test.ts` (modified)
- `src/widget/ChatWidget.test.ts` (modified)
- `src/widget/markdown.test.tsx` (modified)

## Phase 8 — Integration Test: done (실제 키 점검 보류)

Refs: RQ-1, RQ-2, RQ-3, RQ-4, RQ-11, RQ-12, RQ-13, RQ-16

진입: Phase 7 완료.

- [x] Playwright 1.63.0(이 환경에 미리 설치된 버전과 맞춤): `e2e/server.mjs`가 빌드 결과(`dist/`)와 시험 페이지를 내보내고, 빌드한 중계 서버를
  보낸 말에 따라 답이 정해진 제공자(`slow`·`fail`·`echo history`)로 돌린다. `e2e/widget.spec.ts` 11개:
  script 한 줄 로드와 페이지 CSS 격리, 스트리밍·마크다운(굵게·목록·코드·안전한 링크)·live region·입력칸 비우기, 글자가 늘어나는 것과 멈추기,
  이전 대화 포함, 제공자 실패 시 alert·다시 시도 버튼, 새로고침 뒤 보존, 키보드만으로(Tab·Enter·Shift+Enter·Esc, 초점 복귀),
  휴대폰 390px 전체 화면·가로 넘침 0·닫기, inline 패널, 위치·다크 테마·CSS 변수, 허용되지 않은 출처의 오류(`forbidden_origin`)
- [x] 찾은 문제: 휴대폰에서 열린 패널이 화면을 덮으면 런처("Close chat")가 패널 아래에 가려진 채로 Tab·스크린리더에 남았다.
  폭 480px 이하에서 열린 동안 런처를 숨김(머리글의 닫기 버튼 사용). 크기 8.87 → 8.88KB
- [x] 위젯 타입: `src/widget/element.d.ts` → `dist/tiny-ai-chat.d.ts`(빌드가 복사). 요소 프로퍼티, `HTMLElementTagNameMap`,
  `chat-*` 이벤트(`GlobalEventHandlersEventMap`). `src/widget/typesMatch.ts`가 선언한 props와 타입의 이름이 어긋나면 type-check 실패
  (일부러 어긋나게 해 실패하는 것 확인)
- [x] `scripts/check-package.mjs`(`pnpm check:package`, CI): `npm pack` → 빈 프로젝트에 설치(세 SDK 포함) →
  묶음에 `dist`만(소스·개발용 호스트 페이지 제외, 24파일·78.1KB), 모든 하위 경로를 Node ESM으로 import(위젯 진입점은 DOM 없이도 오류 없음),
  설치본으로 만든 중계 서버가 스트림, 모든 하위 경로를 쓰는 TS 파일이 `Bundler`·`NodeNext` 모두에서 타입 검사 통과
- [x] CI: Quality에 `check:package`, `Browser (chromium·firefox·webkit)` 행렬 잡(빌드 → 브라우저 설치 → E2E)
- [ ] 실제 제공자 수동 점검 M-1~M-3 — **보류**(2026-11-23 사용자: 키가 준비되면 다시 말하겠다, 일단 된다고 보고 진행)

로컬 결과: E2E 11/11(Chromium — 이 환경에는 Chromium만 있어 Firefox·WebKit은 CI에서 확인), `check:package` 7항목, 단위 140개.

Files:
- `.github/workflows/ci.yml` (modified)
- `docs/v0.1/IMPLEMENT.md` (modified)
- `e2e/pages/variants.html` (added)
- `e2e/server.mjs` (added)
- `e2e/widget.spec.ts` (added)
- `eslint.config.js` (modified)
- `package.json` (modified)
- `playwright.config.ts` (added)
- `pnpm-lock.yaml` (modified)
- `scripts/check-package.mjs` (added)
- `src/widget/chat-widget.css` (modified)
- `src/widget/element.d.ts` (added)
- `src/widget/typesMatch.ts` (added)
- `tsconfig.json` (modified)
- `vite.config.js` (modified)

## Phase 9 — 문서·데모·릴리스 준비: in progress

Refs: RQ-15, DC-17

진입: Phase 8 완료, DC-17 결정.

- [x] README(영어): 3분 시작(중계 서버 템플릿 → 위젯 태그), 속성·프로퍼티·이벤트·CSS 변수·part 표, 중계 서버와 어댑터 옵션 표,
  공개 전 점검, 통신 규약, "Built with lithent", 개발 명령
- [x] README 한국어판(`README.ko.md`): 시작 방법, 한국어 라벨 예시, 주요 항목 요약, 공개 전 점검 — 전체 표는 영어판으로 연결
- [x] 데모 페이지(DC-17, 사용자 결정 2026-11-23: 추천안 (a)): `demo/index.html`(소개·설치 코드·색 바꾸기 버튼·inline 예시·모서리 위젯),
  `demo/fake-relay.js`(`/demo-relay`로 가는 fetch만 가로채 규약대로 SSE 답 — 설치·크기·제공자 질문에 준비된 답, 그 밖은 안내),
  `scripts/build-demo.mjs`(build 끝에서 `demo-dist/`로 복사, 위젯은 빌드한 IIFE를 script 태그로), `.github/workflows/pages.yml`(`main` 푸시 때
  Pages 배포 — 저장소 설정 Pages 소스를 GitHub Actions로 켜야 함), README 두 곳에 데모 링크. E2E에 데모 시나리오 1개(질문 2개·색 바꾸기·페이지 오류 0).
  처음에는 "How big is it?"이 설치 답("how")과 이어서 기본 답("big" 없음)으로 가서, 질문 짝을 더 구체적으로 고침
- [x] CI: Firefox에서 "새로고침 뒤 보존" E2E가 실패 — 테스트가 마지막 글자를 보자마자 새로고침해 스트림이 닫히기 전 요청이 끊겼고,
  위젯은 끝난 답만 저장하므로 답이 빠졌다. 테스트가 답이 끝날 때(Send 버튼 복귀)까지 기다리도록 고침(제품 동작은 그대로)
- [x] `CHANGELOG.md` 0.1.0(미발행)
- [x] `RELEASING.md`: 첫 발행은 사용자가 수동(`npm publish`) → npm 신뢰 발행 설정 → 태그·GitHub 릴리스, 발행 뒤 점검
- [ ] 버전 0.1.0, `"private": true` 해제 — 릴리스 PR에서
- [ ] 수동 점검 M-4~M-9 (M-4·M-5는 실제 키 필요 — 보류)

## 인계

- 상태: Phase 1 병합(PR #1). Phase 2~8과 Phase 9 문서·데모는 PR #2.
- 다음: PR #2 CI 확인 → 병합 → 저장소 설정에서 Pages 켜기(사용자) → 릴리스 PR(버전 0.1.0, `private` 해제) → npm 첫 발행(사용자).
- 막힌 것: 실제 키 점검(M-1~M-5)은 사용자가 준비되면 진행.
- 최신 커밋: Phase 9 데모 커밋.
