# ResortPro — Security Plan (Ethical Hacker Perspective)

> এই plan টি একজন ethical hacker হিসেবে চিন্তা করে তৈরি — attack করার আগেই defend করো।

---

## Current Security Status

| Layer | Status | বিস্তারিত |
|-------|--------|-----------|
| Helmet | ✅ আছে | CSP disabled — fix দরকার |
| CORS | ✅ আছে | origin whitelist আছে |
| Rate Limiting | ⚠️ Weak | 100 req/min global — auth-এ আলাদা limit নেই |
| JWT Auth | ✅ আছে | 15m access + refresh token |
| Role-based Access | ✅ আছে | requireRole() middleware |
| Input Validation | ⚠️ Partial | Zod আছে কিন্তু সব route-এ না |
| SQL Injection | ✅ Safe | Prisma ORM — parameterized queries |
| File Upload | ⚠️ Weak | type/size check নেই properly |
| Secrets in Code | ⚠️ Risk | JWT fallback 'dev-secret-change-in-production' |
| Swagger/Docs | 🔴 Exposed | /docs public — production-এ বন্ধ করতে হবে |
| Multi-tenancy | ⚠️ Risk | tenantId check সব route-এ নেই কিনা verify দরকার |

---

## Attack Surface Map

```
Internet
    │
    ▼
Cloudflare (DDoS, WAF) ← first line of defense
    │
    ▼
resortpro-api.webcoronet.com (port 4001)
    │
    ├── /api/auth/*          ← Brute force, credential stuffing
    ├── /api/admin/*         ← Privilege escalation
    ├── /api/bookings/*      ← IDOR (Insecure Direct Object Reference)
    ├── /api/payments/*      ← Payment manipulation
    ├── /api/upload/*        ← Malicious file upload
    ├── /site/*              ← Public — XSS, injection
    ├── /embed/*             ← CSRF, clickjacking
    ├── /docs                ← API schema leakage (production-এ বন্ধ!)
    └── /health              ← Info disclosure (minimal, ok)
```

---

## Threat Model — Top 10 Risks

### 🔴 CRITICAL

#### T1 — Tenant Data Leakage (IDOR)
**Attack:** User A-র token দিয়ে User B-র data access।
```
GET /api/bookings/BOOKING_ID_OF_ANOTHER_TENANT
→ যদি tenantId check না থাকে → data leak
```
**Fix:**
```typescript
// প্রতিটি query-তে tenantId enforce করো
const booking = await prisma.booking.findFirst({
  where: { id: bookingId, tenantId: user.tenantId } // ← mandatory
})
if (!booking) return reply.status(404).send(...)
```

#### T2 — JWT Secret Weak/Exposed
**Attack:** Default secret `dev-secret-change-in-production` দিয়ে fake token তৈরি।
```
→ attacker যেকোনো userId + tenantId দিয়ে token forge করতে পারবে
```
**Fix:**
- `.env`-এ minimum 64-char random secret
- Production-এ কখনো default secret না
- Secret rotation plan

#### T3 — Brute Force on Auth
**Attack:** `/api/auth/login` এ password brute force।
**Fix:**
```typescript
// auth route-এ separate strict rate limit
await app.register(rateLimit, {
  max: 5,           // শুধু 5 attempts
  timeWindow: '15 minutes',
  keyGenerator: (req) => req.body?.email ?? req.ip,
  ban: 10,          // 10 fail → 24h ban
})
```

---

### 🟠 HIGH

#### T4 — Swagger Docs Public in Production
**Attack:** `/docs` endpoint থেকে সব API schema, parameters, security model দেখা যায়।
**Fix:**
```typescript
// app.ts এ
if (process.env.NODE_ENV !== 'production') {
  await app.register(swaggerUi, { routePrefix: '/docs' })
}
```

#### T5 — File Upload — Malicious Files
**Attack:** `.php`, `.exe`, `.svg` (XSS), reverse shell upload।
**Current:** শুধু 5MB size limit — type check নেই।
**Fix:**
```typescript
// upload route-এ
const ALLOWED_MIME = ['image/jpeg','image/png','image/webp','image/gif','application/pdf']
if (!ALLOWED_MIME.includes(file.mimetype)) {
  return reply.status(400).send({ error: 'File type not allowed' })
}
// filename sanitize করো
const safeFilename = crypto.randomUUID() + path.extname(file.filename)
```

#### T6 — Admin Route — No IP Restriction
**Attack:** `/api/admin/*` internet থেকে accessible।
**Fix:** Cloudflare Access দিয়ে admin API-কে IP/email restricted করো।

#### T7 — Password Reset Token Timing Attack
**Attack:** Token comparison timing দিয়ে valid token guess।
**Fix:**
```typescript
import { timingSafeEqual } from 'crypto'
const isValid = timingSafeEqual(
  Buffer.from(providedToken),
  Buffer.from(storedToken)
)
```

---

### 🟡 MEDIUM

#### T8 — Content Security Policy Disabled
**Current:** `helmet({ contentSecurityPolicy: false })`
**Attack:** XSS যদি কোথাও user input render হয়।
**Fix:**
```typescript
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Next.js এর জন্য
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.resortpro.site"],
    }
  }
})
```

#### T9 — Refresh Token Rotation Missing
**Attack:** Stolen refresh token দিয়ে unlimited session।
**Fix:** Refresh token use করলে পুরনো টা invalidate → নতুন দাও (rotation)।

#### T10 — Demo Login — No Abuse Prevention
**Attack:** `/api/auth/demo-login` spam করে server load করা।
**Fix:**
```typescript
// demo-login এ strict rate limit
await app.register(rateLimit, {
  max: 10,
  timeWindow: '1 hour',
  keyGenerator: (req) => req.ip,
})
```

---

## Security Implementation Plan

### Phase 1 — Critical Fixes (এখনই — 1 session)

- [ ] **T1** — সব route-এ `tenantId` enforcement audit করো
- [ ] **T2** — JWT secret validation — startup-এ check করো
- [ ] **T3** — Auth route-এ strict rate limiting (5/15min)
- [ ] **T4** — `/docs` production-এ disable করো
- [ ] **T5** — File upload MIME type whitelist

```typescript
// apps/api/src/index.ts — startup security check
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET ?? ''
  if (secret.length < 32 || secret === 'dev-secret-change-in-production') {
    console.error('🔴 FATAL: JWT_SECRET is weak or default. Refusing to start.')
    process.exit(1)
  }
}
```

### Phase 2 — High Priority (এই সপ্তাহে — 1 session)

- [ ] **T6** — Cloudflare Access → admin API restrict
- [ ] **T7** — Timing-safe token comparison
- [ ] **T8** — CSP enable করো (Next.js compatible)
- [ ] **T9** — Refresh token rotation implement
- [ ] **T10** — Demo login rate limit

### Phase 3 — Hardening (এই মাসে)

- [ ] Security headers audit (HSTS, X-Frame-Options, etc.)
- [ ] Dependency vulnerability scan (`pnpm audit`)
- [ ] Secrets scanning — GitHub secret scanning enable করো
- [ ] Log sensitive action masking (password, token না লিখতে)
- [ ] DB connection SSL enforce করো
- [ ] Redis password protect করো (production)

### Phase 4 — Monitoring & Response

- [ ] Failed login attempt alerting (5+ fails → admin notify)
- [ ] Unusual tenant data access pattern detection
- [ ] Stripe webhook signature verification (already আছে — verify করো)
- [ ] Error messages — stack trace production-এ hide করো

---

## Multi-tenancy Security Checklist

প্রতিটি route-এ এই checklist follow করো:

```typescript
// ✅ CORRECT — tenantId enforce
const rooms = await prisma.room.findMany({
  where: { tenantId: user.tenantId }
})

// ❌ WRONG — tenantId missing
const rooms = await prisma.room.findMany() // সব tenant-এর data!

// ✅ CORRECT — ownership verify before update
const booking = await prisma.booking.findFirst({
  where: { id: req.params.id, tenantId: user.tenantId }
})
if (!booking) return reply.status(404).send(...)
await prisma.booking.update({ where: { id: booking.id }, data: ... })

// ❌ WRONG — no ownership check
await prisma.booking.update({
  where: { id: req.params.id }, // attacker can update any tenant's booking!
  data: ...
})
```

---

## Environment Variables Security

```bash
# .env.production — minimum requirements
JWT_SECRET=<64+ random chars>          # openssl rand -base64 48
DATABASE_URL=postgresql://...          # SSL mode=require
REDIS_URL=redis://:password@...        # password required
STRIPE_WEBHOOK_SECRET=whsec_...        # must verify signatures

# Never commit to git:
# .env, .env.production, .env.local
```

`.gitignore` check:
```
.env
.env.*
!.env.example
```

---

## Cloudflare Security Config

Cloudflare dashboard-এ enable করো:

| Setting | Value | কারণ |
|---------|-------|------|
| SSL/TLS | Full (strict) | MITM prevent |
| Always HTTPS | ON | HTTP redirect |
| HSTS | ON | Browser enforce HTTPS |
| Bot Fight Mode | ON | Bot traffic block |
| WAF Rules | ON | OWASP top 10 |
| Rate Limiting | 1000 req/10min | DDoS prevent |
| Hotlink Protection | ON | Image bandwidth theft |

---

## Security Testing

### Manual Tests (প্রতি release-এ)
```bash
# 1. IDOR test — অন্য tenant-এর resource access করার চেষ্টা
curl -H "Authorization: Bearer TENANT_A_TOKEN" \
  https://api.resortpro.site/api/bookings/TENANT_B_BOOKING_ID

# 2. Auth brute force test
for i in {1..10}; do
  curl -X POST https://api.resortpro.site/api/auth/login \
    -d '{"email":"test@test.com","password":"wrong'$i'"}'
done

# 3. File upload test
curl -X POST https://api.resortpro.site/api/upload \
  -F "file=@malicious.php"

# 4. JWT tampering test
# Decode token → change tenantId → re-encode with wrong secret
```

### Automated (CI/CD-এ যোগ করো)
```yaml
# .github/workflows/security.yml
- name: Dependency audit
  run: pnpm audit --audit-level=high

- name: Secret scanning
  uses: trufflesecurity/trufflehog@main
```

---

## Incident Response Plan

কোনো breach হলে:

1. **Detect** — unusual API pattern, failed logins spike
2. **Contain** — affected tenant suspend, JWT secret rotate করো
3. **Assess** — কোন data exposed হয়েছে
4. **Notify** — affected tenant-কে 72 hours-এর মধ্যে (GDPR requirement)
5. **Fix** — vulnerability patch করো
6. **Review** — post-mortem, plan update করো

---

## Security Score (Current vs Target)

| Category | Current | Target |
|----------|---------|--------|
| Authentication | 7/10 | 9/10 |
| Authorization | 6/10 | 9/10 |
| Input Validation | 6/10 | 9/10 |
| Secrets Management | 5/10 | 9/10 |
| Network Security | 7/10 | 9/10 |
| Monitoring | 3/10 | 8/10 |
| **Overall** | **5.7/10** | **8.8/10** |
