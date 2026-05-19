# OPS — 배포/도메인/모니터링 가이드

AI가 **배포/도메인/SSL/모니터링** 작업 시작 시에만 읽습니다.

---

## 배포 (Vercel 권장)

비코더 친화 순서:

1. GitHub에 repo push (private OK)
2. https://vercel.com 가입 → "Add New Project"
3. GitHub repo 선택 → Import
4. 환경변수 입력:
   - `NEXT_PUBLIC_SITE_URL` = 배포 도메인 (예: `https://mygame.vercel.app`)
5. Deploy → 3분 후 도메인 받음

**배포 전 무조건:**
```bash
npm run deploy-check
```

---

## 무료 티어 한도

무료 한도는 자주 바뀐다. AI는 숫자를 외워서 말하지 말고, 배포 시점에 각 서비스의 공식 요금표를 확인한다.

확인할 항목:

| 서비스 | 확인할 것 | 넘으면 생기는 일 |
|---|---|---|
| Vercel | 대역폭, 함수 사용량, 빌드 시간 | 차단 또는 유료 전환 |

**1순위 행동**: 무료 한도 80% 도달 시 알림을 받게 설정한다.

## 모니터링 셋업 (필수)

### A. UptimeRobot (사이트 다운 알림 — 무료)
1. https://uptimerobot.com 가입
2. "+ Add New Monitor" → HTTP(s)
3. URL: 배포된 도메인
4. 모니터링 간격: 5분
5. 알림: 본인 이메일/카카오톡 봇
6. 끝

5분 안에 다운 감지 + 알림.

### B. Sentry (에러 자동 추적 — 필요 시)
1. https://sentry.io 가입 → 새 Next.js 프로젝트
2. 터미널: `npx @sentry/wizard@latest -i nextjs`
3. 자동으로 `instrumentation.ts`, `sentry.client.config.ts` 등 셋업됨
4. `.env`에 `NEXT_PUBLIC_SENTRY_DSN` 등 자동 입력
5. `app/error.tsx`의 에러 로그를 Sentry 전송으로 바꿀지 확인

---

## 도메인 / SSL 안전

### 자동 갱신되는 것 (안심)
- Vercel: SSL 자동 갱신
- Cloudflare: SSL 자동 갱신

### 수동 갱신 (위험)
- 도메인 등록 (가비아, Namecheap 등): **자동결제 카드 만료 주의**
- 카드 만료 30일 전 알림 받게 카드사에 설정

### DKIM/SPF (메일 발송 시)
- SendGrid/Resend 등 사용 시 도메인 인증 필요
- 갱신 알림 받게 설정 (해당 서비스 자동 알림 ON)

---

## 사고 났을 때 (런북)

### 사이트 다운
1. `npm run rollback` — 최근 작업 되돌리기
2. Vercel Dashboard → 이전 배포 → "Promote to Production"
3. 그래도 안 되면 — 본인 SNS에 "잠시 점검 중" 공지

### 트래픽/비용 폭주
1. Vercel Dashboard에서 사용량과 함수 로그 확인
2. 필요하면 프로젝트를 잠시 Pause하거나 이전 배포로 Promote
3. 원인 파악: Vercel logs → AI에게 "최근 1시간 로그 분석해줘"

### 시크릿 노출 (.env 푸시됨)
1. **즉시** 노출된 키 무효화 (해당 서비스 대시보드에서)
2. 새 키 발급 → `.env` 갱신
3. git 히스토리에서 제거: `git filter-repo` 또는 BFG Repo Cleaner
4. force push (위험하지만 필요)

---

## 배포 빈도 권장

- 매일 작업 → 매일 배포 (작은 단위)
- 큰 변경 → 별도 staging 환경 (Vercel은 PR마다 자동 preview URL 제공)
- 절대 금지: 금요일 저녁 배포, 새벽 배포 (사고 나면 못 고침)
