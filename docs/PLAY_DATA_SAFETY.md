# Google Play Data Safety 초안

이 문서는 Play Console의 Data safety form을 채울 때 기준으로 삼는 초안이다. 실제 제출 전에는 앱 코드, TWA Android manifest, 사용 중인 SDK를 다시 확인한다.

## 현재 앱 기준 판단

- 로그인: 없음
- 광고: 없음
- 결제: 없음
- 서버 API: 없음
- 위치 권한: 없음
- 카메라/마이크 권한: 없음
- 연락처/파일 권한: 없음
- 앱 내 계정 생성: 없음
- 사용자 입력 데이터 전송: 없음
- 저장 데이터: 진행 중인 퍼즐, 설정, 기록, 시드가 브라우저 localStorage에만 저장됨

## Data collection

현재 웹앱 기준으로는 개발자 서버로 사용자 데이터를 수집하지 않는다.

Play Console 답변 초안:

| 질문 | 초안 |
|---|---|
| 앱이 사용자 데이터를 수집하거나 공유하는가 | 아니오 |
| 수집되는 개인 정보 | 없음 |
| 위치 정보 | 없음 |
| 금융 정보 | 없음 |
| 건강/피트니스 | 없음 |
| 메시지 | 없음 |
| 사진/동영상/오디오 | 없음 |
| 파일/문서 | 없음 |
| 캘린더/연락처 | 없음 |
| 앱 활동 | 수집 안 함 |
| 웹 탐색 기록 | 수집 안 함 |
| 앱 정보 및 성능 | 수집 안 함 |
| 기기 또는 기타 ID | 수집 안 함 |

## Local-only data

아래 데이터는 사용자의 기기 안에만 저장된다.

- 진행 중인 퍼즐 상태
- 타이머 시작 시각
- 그은 선과 잠금 상태
- 최고 기록
- 스타일 선택
- 진동 설정
- 커스텀 시드

이 데이터는 개발자에게 전송되지 않는다.

## Privacy policy 반영 문장

```text
Alcazar stores puzzle progress, settings, seed values, and best times locally on your device. This data is not transmitted to the developer or third parties.
```

## TWA 빌드 후 재확인 항목

Bubblewrap/Android 프로젝트가 생성되면 아래를 다시 확인한다.

- AndroidManifest 권한 목록
- 사용된 Android SDK/라이브러리가 analytics, crash reporting, advertising ID를 포함하는지
- Play Console App bundle explorer의 permission 목록
- TWA가 별도 계정/로그인/결제 SDK를 포함하지 않는지

## 제출 전 주의

Sentry, Firebase Analytics, AdMob, Play Billing, 로그인 SDK를 추가하면 이 문서는 더 이상 맞지 않는다. 그 경우 Data safety form과 개인정보 처리방침을 다시 작성해야 한다.
