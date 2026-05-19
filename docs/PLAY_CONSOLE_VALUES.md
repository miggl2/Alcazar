# Play Console 입력값 표

Play Console과 Bubblewrap에서 물어보는 값을 한 곳에 모은다. 실제 도메인, 연락 이메일, Android 패키지명, SHA-256은 정해진 뒤 교체한다.

실제 값은 아래 명령으로 이 문서와 관련 정책 파일에 함께 반영한다.

```powershell
npm run release:info -- https://실제-도메인 support@example.com
npm run assetlinks:write -- com.실제.패키지명 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
```

`release:info`는 `.env.production`도 함께 만든다. 이 파일은 git에 올라가지 않는 로컬 출시 점검용 파일이다.

## 앱 생성

| 항목 | 입력값 |
|---|---|
| 앱 이름 | Alcazar |
| 기본 언어 | 한국어 |
| 앱 또는 게임 | 게임 |
| 카테고리 | 퍼즐 |
| 가격 | 무료 |
| 광고 포함 | 아니오 |
| 앱 내 구매 | 없음 |
| 배포 국가 | 미정 |
| Play Console 계정 종류 | 미정 |

## 스토어 등록

| 항목 | 입력값 |
|---|---|
| 앱 이름 | Alcazar |
| 짧은 설명 | 격자의 모든 칸을 한 번씩 지나는 길을 찾는 퍼즐 게임. |
| 긴 설명 | `docs/PLAY_STORE_LISTING.md`의 긴 설명 사용 |
| 연락 이메일 | TODO_CONTACT_EMAIL |
| 개인정보 처리방침 | `https://실제-도메인/privacy-policy.html` |
| 앱 아이콘 | `public/play-store/icon-512.png` |
| 피처 그래픽 | `public/play-store/feature-graphic-1024x500.png` |
| 휴대폰 스크린샷 1 | `public/play-store/phone-1.png` |
| 휴대폰 스크린샷 2 | `public/play-store/phone-2.png` |

## Data safety

| 질문 | 입력값 |
|---|---|
| 앱이 사용자 데이터를 수집하거나 공유하는가 | 아니오 |
| 위치 정보 | 수집 안 함 |
| 개인 정보 | 수집 안 함 |
| 금융 정보 | 수집 안 함 |
| 건강/피트니스 | 수집 안 함 |
| 메시지 | 수집 안 함 |
| 사진/동영상/오디오 | 수집 안 함 |
| 파일/문서 | 수집 안 함 |
| 캘린더/연락처 | 수집 안 함 |
| 앱 활동 | 수집 안 함 |
| 웹 탐색 기록 | 수집 안 함 |
| 앱 정보 및 성능 | 수집 안 함 |
| 기기 또는 기타 ID | 수집 안 함 |

## 콘텐츠와 액세스

| 항목 | 입력값 |
|---|---|
| 앱 액세스 제한 | 제한 없음 |
| 로그인 필요 | 아니오 |
| 뉴스 앱 | 아니오 |
| 정부 앱 | 아니오 |
| 건강 앱 | 아니오 |
| 금융 기능 | 없음 |
| 도박/현금성 보상 | 없음 |
| 사용자 생성 콘텐츠 | 없음 |
| 채팅/소셜 기능 | 없음 |

## Bubblewrap

| 항목 | 입력값 |
|---|---|
| Web manifest URL | `https://실제-도메인/manifest.webmanifest` |
| Android package name | TODO_ANDROID_PACKAGE |
| App name | Alcazar |
| Launcher name | Alcazar |
| Start URL | `/` |
| Display mode | standalone |
| Orientation | portrait |
| Target SDK | API 35 이상 |
| Output | Android App Bundle `.aab` |

## Digital Asset Links

| 항목 | 입력값 |
|---|---|
| 공개 파일 경로 | `public/.well-known/assetlinks.json` |
| 공개 URL | `https://실제-도메인/.well-known/assetlinks.json` |
| Android package name | TODO_ANDROID_PACKAGE |
| SHA-256 fingerprint | TODO_SHA256_FINGERPRINT |

## 제출 전 점검 명령

```powershell
npm run play:ready
```
