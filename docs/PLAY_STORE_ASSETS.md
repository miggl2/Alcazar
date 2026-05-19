# Google Play 이미지 자료 목록

Google Play Console에 올릴 이미지 자료와 저장 위치를 고정한다. 실제 이미지는 마지막에 캡처하거나 제작한다.

## 필요한 파일

| 용도 | 파일 경로 | 크기 | 형식 |
|---|---|---|---|
| 앱 아이콘 | `public/play-store/icon-512.png` | 512x512 | PNG |
| 피처 그래픽 | `public/play-store/feature-graphic-1024x500.png` | 1024x500 | PNG 또는 JPG |
| 휴대폰 스크린샷 1 | `public/play-store/phone-1.png` | 휴대폰 세로 화면 | PNG 또는 JPG |
| 휴대폰 스크린샷 2 | `public/play-store/phone-2.png` | 휴대폰 세로 화면 | PNG 또는 JPG |

`npm run play:ready`는 현재 PNG 파일 기준으로 아래를 검사한다.

- 앱 아이콘: 512x512, 32-bit PNG with alpha, 1024KB 이하
- 피처 그래픽: 1024x500, 알파 없는 24-bit PNG
- 휴대폰 스크린샷: 알파 없는 PNG, 최소 320px, 최대 3840px, 긴 변이 짧은 변의 2배 이하

## 추천 스크린샷

- 메인 메뉴
- 퍼즐 생성 패널이 열린 화면
- 실제 퍼즐 플레이 화면
- 클리어 팝업 화면

## 촬영 기준

- 개발용 주소, 에러, 콘솔, 임시 문구가 보이지 않아야 한다.
- 앱 안에 글자가 없는 현재 디자인 방향을 유지한다.
- 같은 스타일과 같은 화면비로 촬영한다.
- 개인정보나 실제 이메일 주소가 화면에 나오지 않아야 한다.

## 앱 아이콘

현재 보관 중인 원본은 `public/app-icon.svg`다. Play Store 제출에는 512x512 32-bit PNG with alpha가 필요하므로 최종 제출 전에 `public/play-store/icon-512.png`로 렌더링한다.

## 공식 문서

- Preview assets: https://support.google.com/googleplay/android-developer/answer/9866151
