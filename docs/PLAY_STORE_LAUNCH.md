# Google Play 출시 계획

이 문서는 Alcazar를 Google Play에 올리기 위한 실행 순서다. 현재 앱은 웹 기반 Next.js 앱이므로 Android 네이티브 재작성 대신 TWA(Trusted Web Activity) 방식으로 출시한다.

## 현재 결론

- 출시 방식: TWA + Bubblewrap
- Android 패키지명: 미정
- 공개 도메인: 미정
- Play Console 계정 종류: 미정
- 개인정보 처리방침 URL 후보: `/privacy-policy.html`
- 현재 기술 차단 요소: `next@14.2.35` audit high 취약점. Next 16 메이저 업그레이드 승인 후 해결해야 한다.
- 실행 당일 순서표: `docs/PLAY_RELEASE_RUNBOOK.md`
- Next 16 업그레이드 계획: `docs/NEXT16_UPGRADE_PLAN.md`

## 2026-05-20 공식 문서 기준 주의사항

- Google Play 새 앱과 업데이트는 Android 15, API level 35 이상을 target 해야 한다.
- 2023-11-13 이후 만든 개인 개발자 계정은 production 신청 전에 closed test가 필요할 수 있다.
- 개인 계정 closed test가 필요한 경우 최소 12명의 테스터가 14일 연속 opt-in 상태여야 한다.

## 사용자가 정해야 하는 값

| 항목 | 예시 | 필요한 이유 |
|---|---|---|
| Play Console 계정 | 개인 또는 조직 | 개인 신규 계정이면 closed testing 요구가 더 빡빡할 수 있다 |
| 앱 패키지명 | `com.example.alcazar` | Android 앱의 영구 ID다. 나중에 바꾸기 어렵다 |
| 실제 도메인 | `https://alcazar.example.com` | TWA 검증과 Play Store 개인정보 처리방침 URL에 필요하다 |
| 연락 이메일 | `support@example.com` | 스토어 등록, 개인정보 처리방침, 테스트 피드백에 필요하다 |
| 앱/개발자 표시명 | `Alcazar` | Play Store listing에 표시된다 |

## 1단계: 웹앱 배포 준비

- [ ] Next 16 업그레이드 승인 및 적용
- [ ] `npm run release:info -- https://실제-도메인 support@example.com` 실행
- [ ] `npm run check` 통과
- [ ] `npm run audit:prod` high 이상 통과
- [ ] 실제 도메인으로 배포
- [ ] 배포 환경변수 `NEXT_PUBLIC_SITE_URL`을 실제 HTTPS 도메인으로 설정
- [ ] `npm run deploy-check` 통과
- [ ] `/manifest.webmanifest` 200 확인
- [ ] `/play-store/feature-graphic-1024x500.png` 200 확인
- [ ] `/privacy-policy.html` 200 확인

## 2단계: TWA Android 프로젝트 생성

Bubblewrap을 사용한다.

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://실제-도메인/manifest.webmanifest
bubblewrap build
```

생성 시 확인할 값:

- 패키지명
- 앱 이름
- 시작 URL `/`
- 화면 방향 portrait
- 앱 아이콘
- Android target SDK가 API 35 이상인지
- 출력물이 `.aab`인지

## 3단계: Digital Asset Links 연결

TWA가 주소창 없는 전체화면으로 열리려면 앱과 웹사이트 소유권 연결이 필요하다.

웹사이트에 아래 경로가 있어야 한다.

```text
/.well-known/assetlinks.json
```

필요한 값:

- Android package name
- 앱 서명 키 SHA-256 fingerprint

초안은 `docs/ASSETLINKS_TEMPLATE.json`에 있다. 이 파일은 템플릿이므로 그대로 `public/.well-known/assetlinks.json`에 복사하면 안 된다.

Play App Signing을 쓰면 upload key와 app signing key가 다를 수 있으므로, 실제 출시 전에는 Play Console의 app signing fingerprint를 기준으로 다시 확인한다.

실제 값이 정해진 뒤 작업:

1. `public/.well-known/assetlinks.json` 생성
2. package name을 실제 Android 패키지명으로 변경
3. SHA-256 fingerprint를 실제 app signing key 값으로 변경
4. 배포 후 `https://실제-도메인/.well-known/assetlinks.json` 200 확인
5. Android 앱 실행 시 주소창 없는 TWA로 열리는지 확인

## 4단계: Play Console 등록

- [ ] Play Console 개발자 계정 준비
- [ ] 새 앱 생성
- [ ] 기본 언어 선택
- [ ] 앱/게임: 게임
- [ ] 카테고리: 퍼즐
- [ ] 무료 앱으로 설정
- [ ] 광고 없음으로 설정
- [ ] 개인정보 처리방침 URL 입력
- [ ] Data safety form 작성
- [ ] 콘텐츠 등급 설문 작성
- [ ] 타겟 연령층/어린이 대상 여부 작성
- [ ] 앱 액세스 제한 없음으로 작성
- [ ] 스토어 등록 자료 입력

## 5단계: 스토어 자료

스토어 등록 문구와 이미지 체크리스트는 `docs/PLAY_STORE_LISTING.md`에 따로 관리한다.

## 6단계: 테스트와 출시

- [ ] 내부 테스트 트랙에 `.aab` 업로드
- [ ] Android 기기에서 설치 확인
- [ ] TWA가 Custom Tab이 아니라 전체화면으로 열리는지 확인
- [ ] 배포 도메인과 `assetlinks.json` 검증
- [ ] closed testing 필요 시 테스터 모집
- [ ] 테스트 피드백 반영
- [ ] production 신청

## 공식 문서

- TWA 개요: https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities
- Bubblewrap Quick Start: https://developer.chrome.com/docs/android/trusted-web-activity/quick-start
- Digital Asset Links: https://developer.chrome.com/docs/android/trusted-web-activity/android-for-web-devs
- Google Play target API: https://developer.android.com/google/play/requirements/target-sdk
- Play testing tracks: https://support.google.com/googleplay/android-developer/answer/9845334
- Data safety form: https://support.google.com/googleplay/android-developer/answer/10787469
