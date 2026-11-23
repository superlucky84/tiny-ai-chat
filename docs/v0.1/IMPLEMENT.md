# IMPLEMENT — tiny-ai-chat v0.1

- 관련 문서: [REQUIREMENTS.md](./REQUIREMENTS.md) → [DESIGN.md](./DESIGN.md) → [MANUAL_TEST_CHECKLIST.md](./MANUAL_TEST_CHECKLIST.md)

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 문서 작성 | done |
| 1 | 저장소 뼈대와 CI | done |
| 2 | 통신 규약과 중계 서버 핵심 | done |
| 3 | 제공자 어댑터 3개 | done |
| 4 | 위젯 UI와 상태 | done |
| 5 | 안전한 마크다운 | todo |
| 6 | 배포 템플릿과 로컬 실행 | todo |
| 7 | Test Hardening | todo |
| 8 | Integration Test | todo |
| 9 | 문서·데모·릴리스 준비 | todo |

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

## Phase 5 — 안전한 마크다운: todo

Refs: RQ-9, DC-11

진입: Phase 4 완료.

- [ ] `src/widget/markdown.ts`: DESIGN §3.6 문법 → lithent 가상 노드
- [ ] 스트리밍 중 닫히지 않은 코드 블록 처리
- [ ] 메시지 표시를 마크다운으로 교체

기본 테스트: 문법별 사례, XSS 사례(`<script>`, `<img onerror>`, `javascript:` 링크, `data:` 링크, 속성 주입), 닫히지 않은 블록.
완료: 크기 예산 안(크기 기록), 단위 통과.

## Phase 6 — 배포 템플릿과 로컬 실행: todo

Refs: RQ-6, RQ-15

진입: Phase 3·4 완료.

- [ ] `templates/node/` (`node:http` 어댑터, `.env`, 제공자 선택)
- [ ] `templates/cloudflare-worker/` (`wrangler.toml`, 비밀 등록 안내)
- [ ] 저장소 `pnpm dev`: 호스트 페이지 + 가짜 제공자 중계 서버 (키 없이 위젯 개발)
- [ ] `pnpm dev:real`: 환경 변수의 실제 키로 Node 중계 서버 (수동 점검용, 키는 `.env`이고 git 제외)

기본 테스트: Node 템플릿을 띄워 가짜 제공자로 요청 1회(통합 테스트 스크립트).
완료: 두 템플릿 README대로 따라 하면 뜬다(Workers는 `wrangler dev`까지, 배포는 수동 M-4).

## Phase 7 — Test Hardening: todo

Refs: RQ-3, RQ-9, RQ-10, RQ-16

진입: Phase 5·6 완료.

- [ ] 파서: 무작위 조각 분할 속성 테스트(같은 입력을 어떻게 잘라도 같은 이벤트)
- [ ] 마크다운: XSS 사례 확장, 아주 긴 입력·깊은 중첩에서 시간 상한
- [ ] 중계 서버: 느린 제공자·첫 글자 전 끊김·keep-alive 간격
- [ ] 위젯: 빠른 연속 보내기, 받는 중 닫기·다시 열기, 저장소 접근 예외
- [ ] 위젯 빌드 결과에 제공자 SDK·키 이름 문자열이 없는지 검사 (RQ-5)
- [ ] 변이 확인: 핵심 분기 몇 개를 일부러 망가뜨려 테스트가 잡는지 기록

완료: 추가 테스트 통과, 변이 기록.

## Phase 8 — Integration Test: todo

Refs: RQ-1, RQ-2, RQ-3, RQ-4, RQ-11, RQ-12, RQ-13, RQ-16

진입: Phase 7 완료.

- [ ] Playwright(Chromium·Firefox·WebKit): 빌드한 IIFE + Node 템플릿(가짜 제공자) — DESIGN §9 E2E 항목 전부
- [ ] 설치 소비자 검사: `npm pack` → 빈 프로젝트에서 하위 경로 import, 타입(Bundler·NodeNext), IIFE 로드
- [ ] CI에 E2E 추가
- [ ] 실제 제공자 수동 점검 M-1~M-3 (사용자 키 필요)

완료: CI E2E 통과, M-1~M-3 결과 기록.

## Phase 9 — 문서·데모·릴리스 준비: todo

Refs: RQ-15, DC-17

진입: Phase 8 완료, DC-17 결정.

- [ ] README(영어): 3분 시작(위젯 태그 + Workers 템플릿), 속성·이벤트·CSS 변수, 규약, 보안 주의, "Built with lithent"
- [ ] README 한국어판
- [ ] 데모 페이지(DC-17에 따라)
- [ ] CHANGELOG, 버전 0.1.0
- [ ] 발행 절차 문서(첫 발행은 사용자가 수동, 이후 신뢰 발행)
- [ ] 수동 점검 M-4~M-9

완료: 사용자가 npm 첫 발행, M-9 통과.

## 인계

- 상태: Phase 1~4 완료(작업 브랜치 `ccr-3e48bc24-eapswq`). Phase 1은 PR #1(CI 통과, 병합 대기), Phase 2~4는 로컬 커밋.
- 다음: Phase 5 — 안전한 마크다운 (남은 크기 1.72KB).
- 막힌 것: 없음.
- 최신 커밋: Phase 4 커밋.
