# Codex 지시문

한국어 비코더가 한국어 의도만 던지고, AI가 코드 작성·검증·설명을 맡는 프로젝트다. 사용자는 코드로 판단하지 못한다. 따라서 AI는 작업 전 이해 확인, 작업 중 기록, 완료 전 검증을 지켜야 한다.

## 0. 세션 시작 / 압축 복원

세션 시작 또는 컨텍스트 압축이 의심되면 먼저 읽는다.

1. `STATE.md` 마지막 10줄
2. `RULES.md`
3. `CHECKLIST.md`
4. 진행 중이면 `.intent/current.md`, `.intent/plan.md`, `.intent/context.md`

그 뒤 한국어 한 문장으로만 보고한다.

> 지금 [어디까지] 했고 다음은 [무엇]입니다.

## 1. 코드 작성 전 의도 확인

모든 코드 작업 전, 사용자에게 아래 형식으로 확인받는다. 확인 전 코드 작성 금지.

```text
이렇게 이해했습니다.
- 원하는 것:
- 원하지 않을 것 같은 것:
- 영향받는 기능/파일:
- 제가 추정한 것:
- 아직 답이 필요한 것:

맞으면 “응”, 다르면 다른 점을 말해주세요.
```

확인을 받으면 `.intent/user-confirmation.md` 첫 줄을 `확인: 예`로 바꾸고, 확인받은 문장과 사용자 답변을 기록한다.

## 2. poor prompt 대응

모호한 요청을 받아도 즉시 실행하지 않는다. 사용자를 양식 작성 노동자로 만들지 말고 AI가 항목화한다.

- 답변됨: 이미 명확한 항목. 추가 질문 금지.
- 추정됨: AI가 합리적으로 추정한 항목. 맞는지만 확인.
- 미답변: 결과가 크게 달라지는 항목. 답변을 받을 때까지 질문.

되돌리기 어렵거나 결과 취향 차이가 큰 항목은 반드시 묻는다. 작고 되돌리기 쉬운 항목은 기본값을 제안하고 확인한다.

## 3. 메뉴얼 자동 활성화

작업 시작 전 `docs/MANUAL_INDEX.md`를 보고 필요한 문서만 읽는다. 전부 읽지 않는다.

- 게임/퍼즐/세이브/기록/모바일 조작 → `docs/GAME_RULES.md`
- 한글/입력/검색/채팅/카카오/모바일 UI/문구 → `docs/KOREAN.md`
- API/인증/권한/결제/시크릿/봇/rate-limit → `docs/SECURITY.md`
- DB/schema/migration/SQL/Supabase/Prisma → `docs/DB_SAFETY.md`
- 배포/Vercel/도메인/Sentry/환경변수/모니터링 → `docs/OPS.md`

읽은 문서는 `.intent/context.md`에 남긴다.

## 4. 표준 작업 순서

코드 작성 전후 순서는 하나로 고정한다.

1. 요청을 항목화한다.
2. 답변됨/추정됨/미답변으로 나눈다.
3. 사용자에게 의도 확인을 받는다.
4. `.intent/user-confirmation.md`에 확인 기록을 남긴다.
5. 필요한 메뉴얼만 읽고 `.intent/context.md`에 기록한다.
6. `.intent/plan.md`에 계획, 예상 수정 파일, 위험 요소를 쓴다.
7. 위험하거나 5개 초과 파일이 필요한 작업은 계획에 대한 사용자 확인을 추가로 받는다.
8. 코드 작성 후 `.intent/changed-files.md`에 실제 수정 파일과 이유를 기록한다.
9. `npm run check`를 실행하고, 결과와 직접 확인 방법을 보고한다.

사용자가 `.intent` 파일을 직접 채울 필요는 없다. AI가 관리한다.

## 5. 작업 기록 파일

AI가 아래 파일을 관리한다.

- `.intent/current.md` — 요청과 의도 해석
- `.intent/plan.md` — 계획, 예상 수정 파일, 위험 요소
- `.intent/context.md` — 읽은 메뉴얼, 작업 중 판단 근거
- `.intent/checklist.md` — 이번 작업 전용 체크리스트
- `.intent/changed-files.md` — 실제 수정 파일 기록
- `.intent/user-confirmation.md` — 사용자 확인 기록
- `.intent/package-checks.md` — 새 패키지 또는 버전 변경 검증 기록

## 6. 금지 행동

- 위험 명령 자동 실행 금지: `DROP TABLE`, `migrate reset`, `--force`, `rm -rf`, `git push --force`, `git reset --hard`
- 사용자 입력을 shell 문자열로 조합해 실행 금지. `execFileSync`/인자 배열을 사용한다.
- 5개 파일 초과 편집 금지. 필요하면 작업을 쪼개고 사용자 확인.
- 시키지 않은 리팩토링 금지.
- 메이저 업그레이드 금지. 새 패키지는 `npm view <패키지>`로 존재와 최신 버전 확인 후 `~` 범위로 설치.
- 보라/인디고 그라데이션, 글래스 효과, 이모지 헤더, AI티 카피 금지.
- 점수/결제/권한은 클라이언트 값을 신뢰하지 말고 서버 검증.

사용자 명령으로 `npm run rollback`을 직접 실행하는 것은 예외다. AI가 몰래 실행하면 안 된다.

## 7. 코드 기본 사용 규칙

- 게임 세이브: `lib/save-game.ts`
- API/서버 기능을 새로 만들 때는 `docs/SECURITY.md`를 먼저 보고 해당 기능 안에서 rate-limit과 서버 검증을 함께 구현한다.
- 에러/404/로딩 화면: `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx`

## 8. 전문 에이전트 보고서

다음 신호가 있으면 보고서를 쓴다.

- 기획이 모호함 → `docs/agents/PLANNER.md`
- 보안/결제/권한/DB/패키지/5파일 초과 → `docs/agents/QUALITY_REVIEWER.md`
- check/build/test 실패 또는 반복 버그 → `docs/agents/TEST_REVIEWER.md`

보고서는 무엇을 발견했는지, 무엇을 수정했는지, 왜 그렇게 판단했는지, 사용자가 확인할 것을 반드시 포함한다.

## 9. 완료 전 검증

완료라고 말하기 전 반드시:

1. `npm run check` 실제 실행
2. 실패 시 작은 오류는 수정, 큰 오류는 보고서 작성 후 사용자 확인
3. 변경 파일 한국어 3줄 요약
4. 사용자가 직접 확인할 단계 안내

`check` 실패 상태에서 완료 선언 금지.

## 10. 사용자 소통

- 항상 한국어
- 기술 용어 최소화
- 명령어는 정확한 한 줄과 “이거 치면 무슨 일이 일어남”을 같이 설명
- 사용자가 “다음부터 X 하지 마”라고 하면 `RULES.md`에 한 줄 추가
