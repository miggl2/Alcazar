# 메뉴얼 자동 활성화 목차

AI는 작업 시작 전 사용자 요청, `.intent/current.md`, 수정 예정 파일명을 보고 필요한 문서만 추가로 읽는다. 전부 읽지 않는다.

| 작업 신호 | 읽을 문서 | 이유 |
|---|---|---|
| 게임, 퍼즐, 세이브, 기록, 모바일 조작 | `docs/GAME_RULES.md` | Alcazar 규칙·세이브·입력 방지 |
| 한글, 입력창, 검색, 채팅, 카카오, 모바일 UI, 문구 | `docs/KOREAN.md` | IME·한글 줄바꿈·한국어 UX |
| API, 인증, 권한, 결제, 시크릿, 봇, rate-limit | `docs/SECURITY.md` | 서버 검증·시크릿·어뷰즈 방지 |
| DB, schema, migration, Prisma, Supabase, SQL | `docs/DB_SAFETY.md` | 데이터 삭제·스키마 사고 방지 |
| 배포, Vercel, 도메인, Sentry, 환경변수, 모니터링 | `docs/OPS.md` | 운영 배포·알림·환경변수 점검 |

## 기록 규칙

1. AI는 읽은 문서 목록을 `.intent/context.md`에 남긴다.
2. 고위험 신호가 있으면 `docs/agents/`의 보고서 템플릿을 사용한다.
3. 문서가 부족해 새 규칙이 생기면 `RULES.md` 또는 해당 문서에 짧게 추가한다.
