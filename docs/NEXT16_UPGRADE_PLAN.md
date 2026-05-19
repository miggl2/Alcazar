# Next 16 업그레이드 계획

Google Play 공개 배포 전 `npm run audit:prod`의 high 취약점을 없애기 위한 작업 계획이다. 메이저 업그레이드라 사용자 승인 전에는 실제 패키지 변경을 하지 않는다.

## 현재 차단 이유

- 현재 앱: `next@~14.2.35`
- `npm run audit:prod` 결과: Next 관련 high 취약점 때문에 실패
- `next-14` dist-tag 최신도 `14.2.35`라 같은 메이저 안에서 해결할 패치가 없다.
- 2026-05-20 기준 `next@latest`는 `16.2.6`이다.

## 공식 기준

- Next 16 최소 Node: `>=20.9.0`
- Next 16 최소 TypeScript: `>=5.1.0`
- Next 16에서 `next lint`와 `next.config.js`의 `eslint` 옵션은 제거되어 ESLint CLI를 써야 한다.
- Next 16 업그레이드 공식 문서는 `next@latest react@latest react-dom@latest` 수동 설치 또는 codemod를 안내한다.

## 현재 이미 준비된 것

- `package.json`의 `engines.node`는 이미 `>=20.9.0`
- `lint` 스크립트는 이미 `eslint . --ext .ts,.tsx`
- `deploy-check`는 이미 `npm run audit:prod`를 배포 게이트에 포함

## 추천 패키지 조합

실제 적용 시 `~` 범위로 고정한다.

| 패키지 | 추천 |
|---|---|
| `next` | `~16.2.6` |
| `react` | `~19.2.6` |
| `react-dom` | `~19.2.6` |
| `@types/react` | `~19.2.14` |
| `@types/react-dom` | `~19.2.3` |
| `eslint-config-next` | `~16.2.6` |
| `eslint` | `~9.39.4` |
| `typescript` | `~5.9.3` |

TypeScript 6과 ESLint 10은 더 최신이지만, 이번 업그레이드의 목표는 Next 보안 차단 해소이므로 한 번에 불필요한 메이저 리스크를 늘리지 않는다.

## 승인 후 실행 순서

```powershell
npm install next@~16.2.6 react@~19.2.6 react-dom@~19.2.6
npm install -D @types/react@~19.2.14 @types/react-dom@~19.2.3 eslint@~9.39.4 eslint-config-next@~16.2.6 typescript@~5.9.3
npm run check
npm run audit:prod
npm run build
npm run play:ready
```

## 확인할 위험 지점

- React 19 타입 변경으로 TSX 타입 오류가 나는지
- ESLint 9 전환으로 `.eslintrc.json` 유지가 되는지, flat config가 필요한지
- Next 16 Turbopack 기본 build에서 CSS/Tailwind가 정상 처리되는지
- 정적 공유 이미지 `public/play-store/feature-graphic-1024x500.png`가 Next 16 빌드에서 정상 참조되는지
- Web Worker import가 production build에서 정상 동작하는지

## 성공 기준

- `npm run check` 통과
- `npm run audit:prod` high 이상 취약점 없음
- `npm run build` 통과
- 로컬 dev 서버 재시작 후 메인 화면, 생성 화면, 퍼즐 생성, 스타일/설정 저장 확인
- `npm run play:ready`에서 Next 취약점 차단이 사라짐

## 공식 문서

- Next 16 upgrade guide: https://nextjs.org/docs/app/guides/upgrading/version-16
- Next ESLint config: https://nextjs.org/docs/app/api-reference/config/eslint
