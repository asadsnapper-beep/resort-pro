# Turning on SMS (and later WhatsApp) for guests

Written 2026-09-14. The code is done and on staging: test buttons send for
real, booking confirmations reach guests, the monthly allowance is enforced
and resets, and every message is logged in `guest_notifications`.

Resorts choose in Settings → SMS & WhatsApp:

- **ResortPro's account** ("platform") — nothing for the resort to set up;
  100 SMS and 50 WhatsApp a month are included. Needs step 1 below.
- **Their own account** ("own") — they enter their own SSL Wireless or Twilio
  credentials. Works today, nothing needed from ResortPro.

---

## Step 1 — ResortPro's SSL Wireless account (the founder)

1. Open an account with SSL Wireless (sslwireless.com), the bulk SMS side.
2. Apply for a **sender ID / masking name** — for example `ResortPro`. This is
   approved by the provider and can take days. Without it messages go from a
   number rather than a name.
3. From their panel copy the **API token**.

## Step 2 — put it on staging first (Portainer)

Add to the stack's environment variables, then redeploy:

```
SSL_WIRELESS_API_KEY=…
SSL_WIRELESS_SENDER_ID=ResortPro
```

## Step 3 — prove it on staging

1. Settings → SMS & WhatsApp → keep **ResortPro's account**, switch SMS on.
2. "Send Test SMS" to your own phone.
3. It worked if the phone receives it **and** the toast says sent.

If the toast shows an error, it is the provider's own reason — send it back
as it is. **This first real message also confirms the one piece not yet
checked against a live response: how SSL Wireless reports acceptance**
(`sslWirelessSend` in `apps/api/src/services/messaging.ts`).

Then make a booking for a guest whose phone is yours: the confirmation SMS
should arrive once.

## Step 4 — production (Coolify)

Same two variables on the **`api`** service's environment in Coolify's stored
compose, save, redeploy. The worker does not need them — it only resets
usage.

---

## WhatsApp, later

Meta only delivers a free-text message within 24 hours of the guest writing
to the business. A booking confirmation is sent first, so it needs a
**Meta-approved message template**. That means a Meta Business account,
business verification, and a template approved per message type. Until then
WhatsApp works for resorts using their own account when the guest has
messaged them recently, and everything else is refused and logged with that
explanation.

## Still to build

- The other five events: payment received, check-in reminder, check-out
  reminder, cancellation, invoice sent.
- A page for the resort to read its delivery log.
- WhatsApp templates.
