# Turning on card billing (Stripe)

For resorts outside Bangladesh who pay for ResortPro by card. Bangladeshi
resorts keep paying by bKash, and nothing here changes that.

Written 2026-09-14. The code side is done: the webhook now tells Stripe to retry
when it fails (commit af23bb0), with tests. What is left needs a Stripe account,
and only the founder can do that part — keys are never typed in by Claude.

**Order matters: test mode on staging first, live mode on production last.**
A mistake in test mode costs nothing.

---

## Step 0 — a Stripe account (the founder)

Stripe does not open accounts for businesses registered in Bangladesh, as far
as is known. Check <https://stripe.com/global> for the current list. The usual
route is a company in a supported country — for example a US company through
Stripe Atlas.

Everything below assumes the account exists.

---

## Step 1 — in the Stripe dashboard, TEST mode (the founder)

Turn on **Test mode** (top right) first.

### 1a. Six prices

Products → Add product. Three products, each with a monthly and a yearly
recurring price in **USD**. These match `PLAN_PRICING` in
`packages/types/src/plans.ts`:

| Product name        | Monthly | Yearly | Environment variables it fills |
|---------------------|--------:|-------:|---|
| Solo                | $10     | $100   | `STRIPE_PRICE_FREE`, `STRIPE_PRICE_FREE_ANNUAL` |
| Independent Resort  | $19     | $190   | `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_STARTER_ANNUAL` |
| Resort Group        | $59     | $590   | `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PRO_ANNUAL` |

Each price has an id starting `price_…`. Copy all six.

Enterprise is sold by hand, never through checkout — no Stripe price for it.

### 1a-2. One coupon, for owners with several resorts

Product → Coupons → New.

| Field | Value |
|---|---|
| Discount | **Percentage**, `10` |
| Duration | **Forever** |
| Name | Group price |

Copy its id into **`STRIPE_COUPON_GROUP10`** alongside the prices.

This is the 10% every resort after an owner's first one pays — see
[../multi-resort.md](../multi-resort.md) §9. bKash already applies it by
arithmetic and needs nothing set up. Until this coupon exists, a card checkout
for a discounted resort still goes through, but at **full price**, and the API
logs `Group discount is due but STRIPE_COUPON_GROUP10 is unset`. Grep for that
line if an owner says they were overcharged.

### 1b. The webhook

Developers → Webhooks → Add endpoint.

- **Endpoint URL**
  - staging: `https://resortpro-api.webcoronet.com/api/stripe/webhook`
  - production (later, in live mode): `https://api.resortpro.site/api/stripe/webhook`
- **Events** — exactly these six:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

Then open the endpoint and copy its **Signing secret** (`whsec_…`).

### 1c. The customer portal

Settings → Billing → Customer portal → activate it. The "Manage subscription"
button in ResortPro opens this portal; if it is not activated, that button
fails.

### 1d. The secret key

Developers → API keys → **Secret key** (`sk_test_…` in test mode).

You now have: 1 secret key, 1 webhook secret, 6 price ids.

---

## Step 2 — put them on STAGING (Portainer)

Staging reads these from the Portainer stack's environment variables. Add all
eight, then redeploy the stack:

```
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_FREE=price_…
STRIPE_PRICE_FREE_ANNUAL=price_…
STRIPE_PRICE_STARTER=price_…
STRIPE_PRICE_STARTER_ANNUAL=price_…
STRIPE_PRICE_PRO=price_…
STRIPE_PRICE_PRO_ANNUAL=price_…
STRIPE_COUPON_GROUP10=…
```

---

## Step 3 — buy a plan on staging with a fake card

1. Sign up a new test resort on staging.
2. Billing → choose **Independent Resort**, monthly.
3. On Stripe's page pay with card `4242 4242 4242 4242`, any future date, any
   CVC.
4. You land back on ResortPro.

It worked if **all three** are true:

- ResortPro's Billing page shows **Independent Resort, active**
- Stripe dashboard → Webhooks → the endpoint shows the events with **200**
- "Manage subscription" opens Stripe's portal

If any event shows **500**, that is the new behaviour working — Stripe will
retry. Report the event type and the API log line starting
`Stripe webhook handler failed`.

---

## Step 4 — only then, PRODUCTION (Coolify, live mode)

Repeat step 1 with **Test mode off**: live prices, a live webhook pointing at
`https://api.resortpro.site/api/stripe/webhook`, live signing secret, live
portal, `sk_live_…` key.

Production's compose lives in Coolify, not git. In Coolify → resortpro →
Configuration → Docker Compose, on the **`api`** service's `environment:`,
add the same eight lines with the live values. Save, redeploy.

Check without exposing a value:

```bash
docker exec $(docker ps -qf 'name=api-') sh -c 'for v in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_FREE STRIPE_PRICE_FREE_ANNUAL STRIPE_PRICE_STARTER STRIPE_PRICE_STARTER_ANNUAL STRIPE_PRICE_PRO STRIPE_PRICE_PRO_ANNUAL; do eval "x=\$$v"; case "$x" in "") echo "$v MISSING";; sk_live_*|whsec_*|price_*) echo "$v ok";; sk_test_*) echo "$v IS A TEST KEY";; *) echo "$v unexpected";; esac; done'
```

Every line must say `ok`. `IS A TEST KEY` on production means real customers
would be sent to a checkout that takes no money.

The first real customer's purchase is the real test: confirm their plan
switched on and the webhook shows 200.
