# KOREAN — 한국어 UI / 공유 가이드

AI가 **한국어 UI, 모바일 문구, 공유 미리보기** 작업 시 읽습니다.

---

## 현재 앱의 글자 규칙

Alcazar 앱 UI는 기본적으로 글자를 쓰지 않는다.

- 허용: 시간, 크기, 난이도, 시드처럼 의미가 숫자인 값
- 비허용: 버튼 이름, 안내 문장, 기능 설명, 과한 번호 매기기
- 예외: 브라우저 메타데이터, 접근성용 `aria-label`, 에러 화면, 문서

---

## 폰트

`app/globals.css`에서 `@fontsource/pretendard`가 이미 import됨.

폰트 weight 사용:
- 본문: `font-normal` (400)
- 강조: `font-medium` (500), `font-semibold` (600)
- 헤딩: `font-bold` (700)

---

## 줄바꿈

`globals.css`에 `word-break: keep-all`이 적용되어 있다.

URL이나 긴 영문은 필요한 곳에만 `break-words`를 쓴다.

```tsx
<div className="break-words">https://very-long-url.example.com/...</div>
```

---

## 공유 미리보기

`app/layout.tsx`가 Open Graph 메타데이터를 설정하고, `public/play-store/feature-graphic-1024x500.png`를 글자 없는 공유 이미지로 사용한다.

출시 도메인이 정해지면:

1. `.env`의 `NEXT_PUBLIC_SITE_URL`을 실제 HTTPS 도메인으로 바꾼다.
2. `npm run deploy-check`를 돌린다.
3. 카카오톡 디버거에서 공유 카드가 뜨는지 확인한다.

카카오톡 디버거: https://developers.kakao.com/tool/debugger/sharing

---

## 한국어 카피 가이드

문서나 에러 화면처럼 글자가 필요한 곳에만 적용한다.

금지:
- "당신의 여정을 시작하세요"
- "원활한 경험을 제공합니다"
- "혁신적인 / 차세대의 / 혁명적인"
- "지금 바로 / 더 이상 망설이지 마세요"
- 이모지 떡칠
- 영어 직역체

좋은 패턴:
- 짧고 직접적
- 행동 동사 위주
- 친근한 종결은 "~요", 안내 문서는 "~합니다"

---

## 한국 환경 모바일 체크

- 가장 작은 모바일 너비 320px에서 확인한다.
- `viewportFit: 'cover'`와 safe-area 적용을 유지한다.
- `100vh` 대신 `100dvh`, `h-screen-safe`, `min-h-screen-safe`를 쓴다.

---

## 한국어 검색 SEO

- `app/layout.tsx`의 `metadata.description`은 한국어로 자연스럽게 쓴다.
- 네이버 서치어드바이저 등록: https://searchadvisor.naver.com
- 카카오/다음 색인은 시간이 오래 걸릴 수 있다.
