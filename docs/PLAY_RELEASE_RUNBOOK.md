# Google Play 실행 런북

이 문서는 출시 당일 그대로 따라가기 위한 순서표다. 정책 숫자는 2026-05-20에 공식 문서 기준으로 다시 확인했다.

## 현재 확정된 방향

- Android 포장 방식: TWA + Bubblewrap
- 앱 형태: 무료 퍼즐 게임
- 광고: 없음
- 인앱 결제: 없음
- 로그인: 없음
- 서버 데이터 수집: 없음
- 공개 개인정보 처리방침: `/privacy-policy.html`
- Play Console 입력값 표: `docs/PLAY_CONSOLE_VALUES.md`

## 현재 정책상 주의할 점

- Google Play에 새 앱 또는 업데이트를 올릴 때 Android 15, API level 35 이상을 target 해야 한다.
- 2023-11-13 이후 만든 개인 개발자 계정은 production 신청 전에 closed test가 필요할 수 있다.
- 그 closed test는 최소 12명의 테스터가 14일 연속 opt-in 상태여야 한다.

## 아직 사람이 정해야 하는 값

| 값 | 예시 | 정해지기 전 막히는 것 |
|---|---|---|
| 실제 도메인 | `https://alcazar.example.com` | TWA, 개인정보 처리방침 URL, assetlinks |
| Android 패키지명 | `com.example.alcazar` | Bubblewrap 프로젝트, assetlinks |
| 연락 이메일 | `support@example.com` | Play Store listing, privacy policy |
| Play Console 계정 종류 | 개인 또는 조직 | closed test 필요 여부 판단 |
| 앱 서명 SHA-256 | `AA:BB:...` | assetlinks 최종 공개 |

## 1. 웹앱 보안 게이트 통과

현재 차단 요소는 Next 14 high 취약점이다. 같은 Next 14 라인에서는 해결 패치가 없어서 Next 16 메이저 업그레이드가 필요하다.
업그레이드 계획과 승인 후 실행 명령은 `docs/NEXT16_UPGRADE_PLAN.md`에서 관리한다.

실행 순서:

```powershell
npm run check
npm run audit:prod
```

`npm run audit:prod`가 high 취약점 없이 통과해야 다음 단계로 간다.

## 2. 공개 웹 배포

실제 도메인을 정한 뒤 `.env` 또는 배포 환경변수에 넣는다.

```powershell
npm run release:info -- https://실제-도메인 support@example.com
```

이 명령은 문서와 개인정보 처리방침을 갱신하고, git에 올라가지 않는 `.env.production`에 `NEXT_PUBLIC_SITE_URL`도 함께 쓴다.

그 다음:

```powershell
npm run deploy-check
```

확인할 URL:

- `https://실제-도메인/`
- `https://실제-도메인/manifest.webmanifest`
- `https://실제-도메인/privacy-policy.html`
- `https://실제-도메인/play-store/feature-graphic-1024x500.png`

## 3. Bubblewrap Android 프로젝트 생성

도메인과 패키지명이 정해진 뒤 별도 Android 작업 폴더에서 실행한다.

```powershell
npm view @bubblewrap/cli version
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://실제-도메인/manifest.webmanifest
bubblewrap build
```

생성 중 선택값:

- package name: 실제 Android 패키지명
- display mode: standalone
- orientation: portrait
- output: Android App Bundle, `.aab`
- target SDK: API 35 이상인지 확인

## 4. assetlinks 연결

Bubblewrap/Play App Signing에서 SHA-256 fingerprint를 얻은 뒤에만 공개 파일을 만든다.

1. 실제 package name과 SHA-256 fingerprint를 확인한다.
2. 아래 명령으로 `public/.well-known/assetlinks.json`을 생성한다.
3. 웹에 배포한다.
4. `https://실제-도메인/.well-known/assetlinks.json`이 200인지 확인한다.

```powershell
npm run assetlinks:write -- com.실제.패키지명 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
```

템플릿 값이 공개 파일에 남아 있으면 안 된다.

## 5. Play Console 등록

Play Console에서 새 앱을 만든 뒤 아래 순서로 채운다.

1. 앱 정보: 게임, 퍼즐, 무료, 광고 없음
2. 개인정보 처리방침 URL
3. Data safety form: `docs/PLAY_DATA_SAFETY.md` 기준
4. Store listing: `docs/PLAY_STORE_LISTING.md`, `docs/PLAY_CONSOLE_VALUES.md` 기준
5. App bundle: Bubblewrap이 만든 `.aab`
6. Content rating 설문
7. Target audience 설문
8. Internal test 업로드
9. 필요 시 closed test 12명 14일 진행
10. Production access 신청

## 6. 출시 직전 확인

- 앱이 주소창 없는 전체화면 TWA로 열리는가
- 뒤로가기와 홈 복귀가 어색하지 않은가
- 진동 설정이 Android에서 실제로 동작하는가
- 퍼즐 생성 중 로딩이 멈춘 것처럼 보이지 않는가
- 앱을 껐다 켜도 이어하기가 가능한가
- Data safety 답변과 실제 권한 목록이 일치하는가
- 스토어 스크린샷에 임시 값이나 개발용 URL이 보이지 않는가

## 공식 확인 링크

- Target API level: https://developer.android.com/google/play/requirements/target-sdk
- TWA 개요: https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities
- Bubblewrap Quick Start: https://developer.chrome.com/docs/android/trusted-web-activity/quick-start
- Digital Asset Links: https://developer.chrome.com/docs/android/trusted-web-activity/android-for-web-devs
- 테스트 트랙: https://support.google.com/googleplay/android-developer/answer/9845334
- 신규 개인 계정 테스트 요구사항: https://support.google.com/googleplay/android-developer/answer/14151465
