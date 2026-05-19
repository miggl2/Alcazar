# DB_SAFETY — 데이터베이스 작업 안전 가이드

AI가 **DB 마이그레이션 / 스키마 / 쿼리** 작업 시 읽습니다.
**가장 위험한 작업**이므로 룰 엄격히 따를 것.

---

## 절대 금지 명령 (사용자가 직접 입력해야 실행됨)

다음은 **절대 자동 실행 금지**:

- `DROP TABLE`, `DROP SCHEMA`, `DROP DATABASE`
- `TRUNCATE` (테이블 비우기)
- Prisma: `prisma migrate reset`, `prisma db push --force-reset`
- Drizzle: `drizzle-kit push` 후 데이터 삭제 동반
- 모든 `--force` 플래그

**대신 이렇게**: AI가 명령어를 알려주고, 사용자가 직접 터미널에 친다.
출력 형식:
> "이 명령을 실행해야 해요. 실행 전 진짜 데이터가 다 지워져도 되는지 확인하세요:
> ```
> npx prisma migrate reset
> ```
> 정말 실행할 거면 위 명령을 직접 복사해서 터미널에 붙여넣으세요."

---

## 환경 분리 (필수)

```
.env              → 로컬 개발 (dev DB)
.env.production   → 프로덕션 (절대 로컬에서 사용 X)
```

**룰**:
- 개발 중에는 로컬 DB만 (Docker Postgres 권장)
- 프로덕션 DB는 Vercel 대시보드의 env로만 접근
- `DATABASE_URL`이 dev DB임을 매번 확인

---

## 마이그레이션 안전 순서

### 1. 로컬에서 먼저 시도
```bash
npx prisma migrate dev --name add_high_score
```
- `migrate dev`는 로컬 DB만 영향
- 결과 확인 후 다음 단계

### 2. 마이그레이션 파일 검토
- `prisma/migrations/*/migration.sql` 파일 생성됨
- AI에게: "이 마이그레이션 파일 위험한 게 있는지 한국어로 설명해줘"
- 위험 패턴: `DROP COLUMN`, `ALTER COLUMN TYPE`, `NOT NULL` 추가

### 3. 로컬에서 빈 DB로 끝까지 적용 테스트
```bash
# 임시 DB 만들고 처음부터 다 적용
DATABASE_URL=postgresql://temp npx prisma migrate deploy
```

### 4. 프로덕션 적용 (작은 단위로)
```bash
# Vercel CI/CD에서 자동 또는 수동
npx prisma migrate deploy
```

**절대 X**: 프로덕션에서 `migrate dev` 또는 `db push --force-reset`

---

## 백업 (매우 중요)

### Supabase (무료 플랜)
- Point-in-Time Recovery는 유료. 무료는 본인이 백업해야.
- 주 1회 수동 백업:
  ```bash
  pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
  ```
- 큰 변경 직전에는 항상 백업

### Vercel Postgres / Neon
- 자동 일일 백업 (7일 보관)
- 사용자가 별도 설정 불필요

---

## 위험한 변경 패턴

### `ALTER COLUMN TYPE` (타입 변경)
- 데이터 손실 가능
- 대신: 새 컬럼 추가 → 데이터 복사 → 옛 컬럼 삭제 (3단계)

### `DROP COLUMN`
- 데이터 영구 손실
- 먼저 deprecated 표시 후 1주 뒤 삭제

### `NOT NULL` 추가
- 기존 NULL 데이터 있으면 실패
- 먼저 DEFAULT 값 + UPDATE → 그 다음 NOT NULL

### 인덱스 추가 (대량 테이블)
- `CREATE INDEX CONCURRENTLY` 사용 (Postgres) — 락 안 걸림

---

## ORM 별 안전 룰

### Prisma
- `migrate dev` = 로컬만
- `migrate deploy` = 프로덕션 (안전)
- `migrate reset` = **로컬에서만** 절대 prod X
- `db push` = 마이그레이션 파일 없이 바로 적용 — **프로토타입 단계만**

### Drizzle
- `drizzle-kit generate` = SQL 파일만 생성 (안전)
- `drizzle-kit migrate` = 적용
- `drizzle-kit push` = 직접 푸시 (위험, 프로토타입만)

---

## 클라이언트에서 DB 직접 호출 금지

```ts
// ❌ Supabase service_role을 브라우저에서
const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY);

// ✅ Server-only — API route 안에서만
// app/api/posts/route.ts
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
```

브라우저에는 `anon_key`만. 모든 권한 작업은 API route 거치게.

---

## 작업 후 체크

```bash
npm run check          # 시크릿 패턴 (DB URL 노출 등)
npm run deploy-check   # NEXT_PUBLIC_으로 service_role 노출 안 됐는지
```

---

## 사고 시 (런북)

### "데이터가 사라졌어요"
1. 즉시 작업 중단 (추가 손실 막기)
2. 최근 백업 확인 (`pg_dump` 파일)
3. Supabase/Vercel 대시보드 → Point-in-Time Recovery (유료 플랜)
4. AI에게: "최근 마이그레이션 로그 분석해줘. 어디서 데이터 손실 발생했는지"

### "마이그레이션이 락 걸렸어요"
- Postgres: `SELECT pg_cancel_backend(pid)` 또는 `pg_terminate_backend(pid)`
- 절대 강제로 DB 재시작 X (데이터 손상 위험)
