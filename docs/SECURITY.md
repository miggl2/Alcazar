# SECURITY — 보안/시크릿/어뷰즈 작업 가이드

이 문서는 AI가 **결제/인증/시크릿/어뷰즈 방지** 관련 작업을 시작할 때만 읽습니다.
평소 작업에는 읽지 마세요 (토큰 절약).

---

## 시크릿 보호 절대 룰

1. **API 키, 비밀번호, DB 자격증명을 코드에 하드코딩 금지**
   - 항상 `.env`에서 읽기: `process.env.MY_SECRET`
   - `.env`는 `.gitignore`에 박혀있음 — 절대 commit 금지
2. **`NEXT_PUBLIC_` 접두사 = 브라우저 노출**
   - 시크릿 키에 절대 `NEXT_PUBLIC_` 붙이지 말 것
   - Supabase: `NEXT_PUBLIC_SUPABASE_ANON_KEY` OK, `SUPABASE_SERVICE_ROLE_KEY` 절대 NEXT_PUBLIC X
3. **commit 전 자동 차단**
   - `.husky/pre-commit`이 시크릿 패턴 (sk-..., AKIA..., AIza... 등) 자동 스캔
   - 시크릿 매치되면 commit 실패

---

## API 라우트 안전 원칙

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 입력 스키마 — 클라이언트가 보낸 값은 무조건 검증
const SignupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  nickname: z.string().min(2).max(20),
});

export async function POST(req: NextRequest) {
  // 1. rate-limit — 민감한 API를 만들 때 같은 route 안에 구현
  // 2. 입력 검증 — 클라이언트 신뢰 X
  const body = await req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  // 3. 비밀번호 해싱 (bcrypt/argon2) — 절대 평문 저장 X
  // 4. 중복 검사
  // 5. 저장 → 200
}
```

**핵심**: 현재 Alcazar 앱에는 API route가 없다. 새 API를 만들 때만 해당 route 안에 rate-limit, 입력 검증, 서버 권한 검사를 같이 넣는다.

---

## 결제 (Stripe/토스 등)

### 절대 룰: 클라이언트 금액 신뢰 금지
```ts
// ❌ 클라이언트가 보낸 금액으로 결제
const { amount } = await req.json();
await stripe.charges.create({ amount });

// ✅ 서버에서 상품 ID로 금액 조회 후 결제
const { productId } = await req.json();
const product = await db.products.findUnique({ where: { id: productId } });
if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 });
await stripe.charges.create({ amount: product.priceInCents });
```

### 웹훅 서명 검증 필수
```ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text(); // raw body (json X)

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }
  // 검증된 이벤트만 처리
}
```

---

## 어뷰즈 방어 체크리스트

- [ ] 모든 회원가입/로그인 API에 strict rate-limit
- [ ] 캡차 또는 이메일 인증 (대량 가입 시도 시)
- [ ] 외부 유료 API를 붙이면 사용자별 일일 호출 한도 구현
- [ ] 게임 점수 API를 만들면 시간/맥락을 서버에서 검증
- [ ] 게임 점수: 동일 사용자 짧은 시간 내 다중 제출 차단
- [ ] CORS 화이트리스트 (`*` 절대 금지)

---

## 사용자 데이터 안전

- 비밀번호: bcrypt (cost 12+) 또는 argon2id
- PII (이름/전화번호/주민번호): 암호화 저장 권장
- 세션 토큰: HttpOnly + Secure + SameSite=Lax 쿠키
- 로그아웃 시 서버 측 세션 무효화

---

## 작업 후 체크

```bash
npm run check          # 시크릿 패턴 자동 스캔
npm run deploy-check   # 배포 전 환경변수/노출 검증
```
