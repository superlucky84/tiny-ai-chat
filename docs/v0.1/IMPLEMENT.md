# IMPLEMENT — tiny-ai-chat v0.1

- 관련 문서: [REQUIREMENTS.md](./REQUIREMENTS.md) → [DESIGN.md](./DESIGN.md) → [MANUAL_TEST_CHECKLIST.md](./MANUAL_TEST_CHECKLIST.md)

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 문서 작성 | done |
| 1 | 저장소 뼈대와 CI | done |
| 2 | 통신 규약과 중계 서버 핵심 | todo |
| 3 | 제공자 어댑터 3개 | todo |
| 4 | 위젯 UI와 상태 | todo |
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

## Phase 2 — 통신 규약과 중계 서버 핵심: todo

Refs: RQ-6, RQ-7, RQ-8, DC-3, DC-8, DC-9

진입: Phase 1 완료.

- [ ] `src/shared/protocol.ts`: 타입, `encodeEvent`, 스트림 파서(조각 경계·CRLF·여러 줄 `data`·주석)
- [ ] `src/relay/index.ts`: `createRelay` — 옵션 검사(필수 `provider`·`allowedOrigins`), 메서드, CORS·출처,
  `onRequest`, 본문 검사·자르기, `provider.stream()` → SSE, keep-alive, `request.signal` 전파, 오류 변환, `onError`
- [ ] 가짜 제공자(`test/fakes/provider.ts`): 정해진 조각을 정해진 간격으로 내보냄, 중간 오류·거절·상한 흉내

기본 테스트: 파서 단위(경계 사례), 중계 서버 단위 — DESIGN §4.3 표의 상태 코드마다 1개 이상, 끊김 시 제공자 signal abort 확인.
완료: 규약 적합성 테스트 묶음이 생기고 통과.

## Phase 3 — 제공자 어댑터 3개: todo

Refs: RQ-5, DC-4, DC-5, DC-6, DC-7

진입: Phase 2 완료. 설치한 SDK 버전으로 DESIGN §6 호출 모양을 다시 확인하고 다르면 DESIGN을 먼저 고친다.

- [ ] `src/relay/openai.ts` (Responses API 스트림)
- [ ] `src/relay/gemini.ts` (`generateContentStream`, 역할 변환)
- [ ] `src/relay/anthropic.ts` (`beta.messages.stream`, `fallbacks: 'default'`, `effort` 옵션, 사고 블록 무시)
- [ ] 각 어댑터: `client` 주입, `model` 필수 검사, 끝 이유 변환, signal 전달

기본 테스트: 어댑터마다 가짜 클라이언트로 글자 이벤트·끝 이유 3종·SDK 오류 던짐·signal 전달. 이벤트 모양은 SDK 타입에서 가져온다.
완료: 세 어댑터가 같은 공통 테스트 묶음(`provider contract`)을 통과.

## Phase 4 — 위젯 UI와 상태: todo

Refs: RQ-1, RQ-2, RQ-3, RQ-4, RQ-11, RQ-12, RQ-13, RQ-14, DC-10, DC-13, DC-14, DC-15

진입: Phase 2 완료(규약 파서 사용).

- [ ] 속성·프로퍼티·라벨 (DESIGN §3.1)
- [ ] 런처·패널·머리글·메시지 목록·입력칸·보내기/멈추기, 위치 3종, 테마, 좁은 화면 전체 화면
- [ ] fetch 스트림 읽기, 상태 흐름(§3.4), 프레임당 렌더, 아래 따라가기
- [ ] 멈추기·오류·다시 시도·대화 지우기, 보존(sessionStorage, 실패 시 무시)
- [ ] 이벤트 5종(§3.2), `chat-send` 취소
- [ ] 접근성(§3.5)
- [ ] 마크다운은 이 단계에서는 글자 그대로 표시(Phase 5에서 교체)

기본 테스트: `lithent/test`로 — 열기·닫기·포커스, 보내기→delta→done, 멈추기, 오류 코드별 표시, 재시도, 보존 복원, 이벤트·취소.
완료: 크기 예산 안, 단위 통과.

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

- 상태: Phase 1 완료(작업 브랜치 `ccr-3e48bc24-eapswq`).
- 다음: Phase 2 — `src/shared/protocol.ts`와 `createRelay`.
- 막힌 것: 없음.
- 최신 커밋: Phase 1 커밋 (PR로 `main`에 합칠 예정).
