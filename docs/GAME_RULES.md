# GAME_RULES — Alcazar 게임 작업 가이드

AI가 **퍼즐 규칙, 세이브, 입력, 기록** 관련 코드를 만들 때 읽습니다.

---

## 현재 게임 원칙

- 앱은 고정 9:16 모바일 화면을 기준으로 만든다.
- 화면 UI에는 글자를 쓰지 않고, 시간·크기·난이도·시드처럼 필요한 숫자만 허용한다.
- 퍼즐 판, 현재 진행, 시간, 잠금 간선, 최고 기록, 스타일, 진동 설정은 로컬 저장소에 저장한다.
- 서버 점수판이나 계정 기능은 아직 없다. 새 API를 만들 때만 `docs/SECURITY.md` 기준으로 서버 검증을 추가한다.

---

## 세이브

`lib/save-game.ts`의 `createSaveStore`를 사용한다. 직접 `localStorage.setItem`을 흩뿌리지 않는다.

```tsx
import { createSaveStore } from '@/lib/save-game';
import { z } from 'zod';

const savev1 = z.object({
  currentRun: z.unknown().nullable(),
  bestTimes: z.record(z.number()),
});

const save = createSaveStore({
  key: 'alcazar-save',
  currentVersion: 1,
  schemas: { 1: savev1 },
  defaultData: { currentRun: null, bestTimes: {} },
});
```

파싱 실패, localStorage 차단, quota 초과, 버전 충돌은 모두 기본값으로 복구되어야 한다.

---

## 입력

- 클릭만으로 간선을 만들지 않는다. 드래그 경로만 반영한다.
- 드래그 중에는 잉크선으로 미리 보이고, 드래그가 끝난 뒤 간선을 확정한다.
- 한 드래그 안에 추가 간선이 하나라도 있으면 같은 드래그 안의 삭제 후보는 무시한다.
- 잠긴 간선은 지우기 대상이 아니다.

---

## 기록

- 시드런은 최고 기록으로 인정하지 않는다.
- 최고 기록과 클리어 시간은 `x:xx.xx` 꼴로 표시한다.
- 앱을 껐다 켜도 진행 중인 판과 흘러간 시간은 이어져야 한다.

---

## 게임 작업 시 체크리스트

- [ ] 저장 구조를 바꾸면 스키마 버전과 마이그레이션을 같이 갱신한다.
- [ ] 퍼즐 생성 중에는 로딩 상태와 실패 복구 경로를 둔다.
- [ ] 작은 판과 큰 판 모두 벽, 간선, 잉크선 두께가 자연스럽게 보인다.
- [ ] 모바일 터치 타겟은 충분히 크고, 화면 전체 스크롤이 생기지 않는다.
- [ ] `prefers-reduced-motion`을 존중한다.
