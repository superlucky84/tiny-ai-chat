# MANUAL TEST CHECKLIST — tiny-ai-chat v0.1

- 관련 문서: [REQUIREMENTS.md](./REQUIREMENTS.md) → [DESIGN.md](./DESIGN.md) → [IMPLEMENT.md](./IMPLEMENT.md)
- 실제 키가 필요한 항목(M-1~M-4)은 사용자의 키로 한다. 키는 저장소·로그·스크린샷에 남기지 않는다.
- 2026-11-23 사용자 결정: 실제 키 점검은 사용자가 준비되면 한다. 그때까지 M-1~M-4는 **보류**이고 통과로 보지 않는다.

| ID | 확인 | 통과 기준 | 시점 | 결과 |
|---|---|---|---|---|
| M-1 | OpenAI 실제 연결 | Node 템플릿 + OpenAI 키·모델로 위젯에서 질문 2턴. 글자가 이어서 나오고, 두 번째 답이 첫 대화를 기억하고, 멈추기가 즉시 멈춘다 | Phase 8 | |
| M-2 | Gemini 실제 연결 | M-1과 같은 기준을 Gemini 키·모델로 | Phase 8 | |
| M-3 | Claude 실제 연결 | M-1과 같은 기준을 Claude 키·`claude-opus-5-5`로. 첫 글자 전 입력 중 표시가 보이고, `effort` 옵션을 바꿔도 동작 | Phase 8 | |
| M-4 | Cloudflare Workers 배포 | Workers 템플릿을 README대로 배포(`wrangler secret put`)하고, 다른 출처의 정적 페이지에서 대화 1턴 | Phase 9 | |
| M-5 | 허용 출처 | M-4 배포본에 허용 목록 밖 출처의 페이지에서 보내면 위젯에 오류가 보이고 제공자 콘솔에 사용량이 늘지 않는다. curl(출처 없음)은 403 | Phase 9 | |
| M-6 | 실제 사이트에 붙이기 | CSS가 많은 실제 사이트(예: lithent 문서 사이트 로컬 빌드)에 script 한 줄로 붙여 모양이 깨지지 않고, 페이지 모양도 바뀌지 않는다. CSS 변수로 색을 바꿀 수 있다 | Phase 9 | |
| M-7 | 휴대폰 실기기 | iOS Safari·Android Chrome에서 열기·입력·보내기·닫기. 키보드가 올라와도 입력칸이 가려지지 않는다 | Phase 9 | |
| M-8 | 스크린리더 | VoiceOver(macOS 또는 iOS)로 런처 → 질문 → 완성된 답이 한 번 읽힘 → Esc로 닫고 런처로 돌아옴 | Phase 9 | |
| M-9 | 발행 뒤 CDN | npm 발행본을 jsDelivr script 태그로 붙여 M-1~M-3 중 하나를 다시 통과. README의 3분 시작을 처음부터 그대로 따라 해서 된다 | 발행 후 | |
