# Alcazar

모바일 화면을 기준으로 만든 Alcazar 퍼즐 게임입니다. 격자 안의 모든 칸을 한 번씩 지나도록 길을 완성하는 것이 목표입니다.

## 현재 앱

- Next.js App Router 기반
- 고정 9:16 모바일 캔버스 UI
- 두 개의 입구, 많은 입구, 입구 없음 퍼즐 모드
- 시드 기반 퍼즐 생성
- 진행 중인 판, 시간, 잠금 간선, 최고 기록 로컬 저장
- 스타일 선택과 진동 설정

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 확인합니다.

## 검증

작업 후 기본 검증:

```bash
npm run check
```

실제 프로덕션 빌드:

```bash
npm run build
```

배포 전 환경과 빌드를 함께 확인:

```bash
npm run deploy-check
```

## 배포 전 준비

출시 도메인이 정해지면 환경변수에 아래 값을 넣습니다.

```bash
NEXT_PUBLIC_SITE_URL=https://실제-배포-도메인
```

이 값이 없으면 앱은 로컬 실행을 위해 `http://localhost:3000`을 기본값으로 사용합니다. 실제 공개 배포 전에는 반드시 HTTPS 도메인으로 바꿔야 하며, `.example`, `.test` 같은 예시 도메인은 `deploy-check`에서 실패합니다.

## 주요 파일

- `app/page.tsx` — 게임 UI와 입력 처리
- `app/alcazar-generate.worker.ts` — 퍼즐 생성 워커
- `lib/alcazar-generator.ts` — 순수 퍼즐 생성 알고리즘
- `lib/alcazar-puzzle-factory.ts` — UI에서 쓰는 퍼즐 생성 래퍼
- `lib/save-game.ts` — 로컬 저장소
- `public/app-icon.svg` — 보관 중인 앱 아이콘 후보
- `public/manifest.webmanifest` — 웹앱 설치용 메타데이터
- `public/robots.txt` — 검색 엔진 기본 허용 규칙
- `public/play-store/feature-graphic-1024x500.png` — 공유 미리보기 이미지
- `generator-lab/` — 생성 알고리즘 실험실, 앱 런타임과 직접 연결되지 않음

## 출시 메모

- `generator-lab`은 개발용 실험실이므로 배포 번들에는 포함되지 않습니다.
- `.intent`, `.next`, `node_modules`는 작업/빌드 생성물입니다.
- 공유용 OG 이미지는 `public/play-store/feature-graphic-1024x500.png` 정적 파일을 사용합니다.
