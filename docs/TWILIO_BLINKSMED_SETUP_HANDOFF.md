# BlinksMed Twilio setup guide (for Technical / Senior)

Share this as-is. It matches **how BlinksMed Vendor Portal actually uses Twilio** today (`feature/twilio-integration`).

Related: [TWILIO_INTEGRATION_PLAN.md](./TWILIO_INTEGRATION_PLAN.md)

---

## A. What our product uses (must understand first)

We use **two Twilio products**:

| Product | Purpose in BlinksMed | Config key |
|--------|----------------------|------------|
| **Twilio Verify** | OTP SMS for Customer/Vendor register, Settings phone verify, Forgot-password SMS | `VerifyServiceSid` (`VA...`) |
| **Twilio Programmable Messaging** | Transactional SMS (orders, account alerts, etc.) | `FromNumberOrMessagingServiceSid` (`MG...` or `+E.164`) |

**Phone format in app:** Indian 10-digit mobile → sent to Twilio as **E.164** `+91XXXXXXXXXX`.

**OTP is NOT gated by Admin SMS toggles.**  
If Verify is configured, OTP works even when all Admin event flags are OFF.

**Transactional SMS is gated by ALL of:**

1. `Twilio:Enabled = true` + Messaging credentials set
2. Admin → **SMS / Twilio** master + per-event flag ON
3. User phone **verified** (`phone_verified_at`)
4. User SMS preference ON (and new-order / expiration prefs where applicable)

**Admin users:** email-only — **no** Admin phone OTP / Admin SMS.

**Trial vs Paid:**

- Trial: app can use `UseTrialSmsTemplates: true` (Twilio sample body keys).
- Production BlinksMed: **upgrade account**, set `UseTrialSmsTemplates: false`, send real BlinksMed text from `SmsTemplates.cs`.

### API endpoints that call Twilio Verify

- `POST /auth/phone/send-otp`
- `POST /auth/phone/verify-otp`
- `POST /auth/forgot-password/sms/send-otp`
- `POST /auth/forgot-password/sms/verify-otp`
- `POST /auth/forgot-password/sms/reset` (uses short-lived app reset token after Verify succeeds — not a second Twilio check)

### Config keys (C# `TwilioOptions`)

| Key | Required for | Notes |
|-----|--------------|--------|
| `Enabled` | Both | Master switch |
| `AccountSid` | Both | `AC...` |
| `AuthToken` | Both | Secret — never commit |
| `VerifyServiceSid` | OTP | `VA...` — Verify enabled when this + AC + token set |
| `FromNumberOrMessagingServiceSid` | Transactional SMS | `MG...` or E.164 From number |
| `OtpResendCooldownSeconds` | OTP | Default `45` |
| `UseTrialSmsTemplates` | Transactional | `false` on paid Production |
| `DevFallbackOtp` | Dev only | e.g. `000000` — empty/disabled in Production |

---

## B. Step-by-step: create BlinksMed Twilio (not personal)

### Step 1 — Create company-owned Twilio account

1. Go to [https://console.twilio.com](https://console.twilio.com)
2. Sign up / create account with a **BlinksMed company email** (not personal Gmail).
3. Company name: **BlinksMed** (legal registered name as on GST/incorporation).
4. Use company address + company contact phone.
5. Enable 2FA on the Twilio login.
6. Add billing (card / invoice) under BlinksMed finance ownership.

**Deliverable:** Twilio Console login owned by BlinksMed ops/finance.

---

### Step 2 — Upgrade off Trial (required for India production)

1. Console → **Billing** / **Upgrade**.
2. Complete payment method + any geographic permissions Twilio asks for.
3. Confirm account is **not Trial** (trial cannot send free-form SMS and has destination limits).

**Deliverable:** Paid/upgraded Twilio account.

---

### Step 3 — Business Profile / Trust Hub (BlinksMed details)

1. Console → **Trust Hub** / **Business Profile** (wording may vary).
2. Create Business Profile with:
   - Legal business name (BlinksMed entity)
   - Business type, address, website (`https://blinksmed.com` or live domain)
   - Business registration / GST / PAN as Twilio requests
   - Authorized representative name + email + phone
3. Submit documents Twilio lists.
4. Wait until status is **Approved**.

**Deliverable:** Approved BlinksMed Business Profile.

---

### Step 4 — India SMS compliance (DLT) — critical

India requires **DLT registration** for A2P SMS. Without this, OTP/transactional SMS fail or get blocked.

Do this with Twilio India guidance / your telecom partner:

1. Register **Principal Entity (PE)** = BlinksMed on DLT portal(s) as required.
2. Register **Sender ID / Header** (e.g. approved brand header for BlinksMed).
3. Register **content templates** for every free-form transactional SMS we send (see Section D below).
4. Link DLT / sender / templates to the Twilio Messaging path Twilio specifies for India.
5. Keep approval screenshots + template IDs.

**Deliverable:** Approved PE + Header + Template IDs mapped for BlinksMed.

> OTP via **Verify** often has a separate Twilio India/Verify compliance path. Still complete whatever Twilio asks for **Verify → India SMS**. Do not skip.

---

### Step 5 — Create Twilio Verify Service (OTP)

1. Console → **Verify** → **Services** → **Create new**.
2. Friendly name: `BlinksMed OTP` (or similar).
3. Enable channel: **SMS**.
4. Code length: **6** (our UI expects 6 digits).
5. Optional: set friendly name shown in SMS if Twilio allows.
6. Copy **Service SID** → starts with `VA...`.

**Used by:** Customer/Vendor register OTP, Settings phone re-verify, Forgot-password SMS OTP.

**Deliverable:** `VerifyServiceSid = VA...`

---

### Step 6 — Create Messaging sender (transactional SMS)

Pick **one** approach (Messaging Service preferred):

#### Option A (recommended): Messaging Service

1. Console → **Messaging** → **Services** → Create.
2. Name: `BlinksMed Transactional`.
3. Add sender(s): India-capable number / alphanumeric sender per Twilio+DLT approval.
4. Copy **Messaging Service SID** → starts with `MG...`.

#### Option B: Single From number

1. Buy/assign Twilio phone number that can SMS Indian mobiles.
2. Copy number in E.164 (e.g. `+91xxxxxxxxxx` or Twilio-provided number).

**Our code accepts either:**

- `MG...` → uses `messagingServiceSid`
- otherwise → uses as `From` number

**Deliverable:** `FromNumberOrMessagingServiceSid = MG...` or `+...`

---

### Step 7 — Geographic permissions

1. Console → **Messaging** → **Settings** → **Geo permissions** (or similar).
2. Allow SMS to **India (+91)**.
3. Confirm Verify SMS to India is allowed.

**Deliverable:** India enabled for Verify + Messaging.

---

### Step 8 — Create API credentials for Production

1. Console → **Account** → **API keys & tokens** / Account SID & Auth Token.
2. Copy:
   - **Account SID** → `AC...`
   - **Auth Token** (store in password manager; never commit to git)
3. Prefer restricting access: only DevOps/senior holds Production token.
4. Create a **separate** Staging account or subaccount if possible (optional but recommended).

**Deliverable:** `AccountSid`, `AuthToken` (secure handoff only).

---

### Step 9 — Handoff package (give DevOps these exact values)

Fill and return securely (1Password / encrypted channel — **not** WhatsApp plaintext long-term):

```text
Twilio Account (BlinksMed Production)
------------------------------------
AccountSid: AC________________
AuthToken:  __________________
VerifyServiceSid: VA__________
FromNumberOrMessagingServiceSid: MG________   (or +E.164)
Account status: Paid/Upgraded (not Trial)
Business Profile: Approved (Y/N)
India DLT PE/Header/Templates: Approved (Y/N)
India geo permission: Enabled (Y/N)
Console URL / owner email: ________________
```

**Exact Production config our API expects:**

```json
"Twilio": {
  "Enabled": true,
  "AccountSid": "ACxxxxxxxx",
  "AuthToken": "xxxxxxxx",
  "FromNumberOrMessagingServiceSid": "MGxxxxxxxx",
  "VerifyServiceSid": "VAxxxxxxxx",
  "OtpResendCooldownSeconds": 45,
  "UseTrialSmsTemplates": false,
  "DevFallbackOtp": ""
}
```

Notes for deployer:

- Put this in **server secrets / Production config**, not git.
- `UseTrialSmsTemplates` must be **`false`** on paid BlinksMed account.
- `DevFallbackOtp` (`000000`) is **Development-only**; leave empty/disabled in Production.
- Restart API after config change.
- DB already needs Twilio schema (`Schema/twilio_sms_full_setup.sql` / incremental `059`–`065`) on vendor/customer/admin DBs if not applied.

---

## C. After credentials are ready — enable in BlinksMed app

### Step 10 — Deploy config + restart API

1. Set Production `Twilio` section (Step 9).
2. Restart `Prilixor.VendorPortal.API`.
3. Admin → **SMS / Twilio** page should show Twilio as configured (indicator).

### Step 11 — Keep transactional flags OFF initially

Defaults are OFF on purpose.  
First validate **OTP only**, then turn events on one-by-one.

Admin path: **Admin → SMS / Twilio**

| Flag group | Events |
|------------|--------|
| Master | Transactional SMS Enabled |
| Customer | Order placed, Vendor confirmed, Cancelled, Status/delivered, Dispatch failed, Order expiring |
| Vendor | New order/dispatch offer, Approved, Rejected, Suspended, Banned, Reactivated, Bank verified, Document verified, Service area updated |

---

## D. SMS texts our app sends (register these on DLT for Production)

These are the **real bodies** when `UseTrialSmsTemplates = false` (from `SmsTemplates.cs`):

### Vendor

| Event | Body pattern |
|-------|----------------|
| New order / dispatch offer | `BlinksMed: New order request {orderNumber}. Open the Vendor Portal to accept or decline.` |
| Account approved | `BlinksMed: Your vendor account is approved. You can now list products in the Vendor Portal.` |
| Account rejected | `BlinksMed: Your vendor account application was rejected...` (optional reason) |
| Account suspended | `BlinksMed: Your vendor account has been suspended...` |
| Account banned | `BlinksMed: Your vendor account has been permanently banned.` |
| Account reactivated | `BlinksMed: Your vendor account has been reactivated...` |
| Bank verified | `BlinksMed: Your bank account ending {last4} was verified.` / rejected variant |
| Document verified | `BlinksMed: Your {documentType} document was approved.` / rejected variant |
| Service area updated | `BlinksMed: Service area "{areaName}" coverage set to {radiusKm} km by admin.` |

### Customer

| Event | Body pattern |
|-------|----------------|
| Order placed | `BlinksMed: Order {orderNumber} placed. Waiting for a vendor to accept.` |
| Order confirmed | `BlinksMed: Order {orderNumber} confirmed by the vendor.` |
| Order cancelled | `BlinksMed: Order {orderNumber} was cancelled.` |
| Status update | `BlinksMed: Order {orderNumber} — {statusLabel}` |
| Dispatch failed | `BlinksMed: Order {orderNumber} could not be assigned to a vendor. Please re-book.` |
| Expiring soon | `BlinksMed: Order {orderNumber} expires in {daysLeft} day(s) on {endDate}.` |

**OTP (Verify):** Twilio Verify generates the OTP SMS — register/approve whatever Twilio+DLT requires for Verify SMS; we do not send a custom OTP body from our code.

---

## E. Test plan (must pass before full go-live)

### E1 — OTP (Verify) — do first

1. Customer register with phone → receive OTP → verify.
2. Vendor register → OTP → verify.
3. Customer/Vendor Settings change phone → OTP.
4. Forgot password SMS → OTP → set password popup → login.
5. Wrong OTP must fail; correct OTP must succeed.
6. Resend cooldown ~45 seconds.

### E2 — Transactional SMS — after OTP works

1. Admin: turn master ON + only **Vendor new order** ON.
2. Place order that creates sequential dispatch offer → vendor with verified phone + SMS pref ON gets SMS.
3. Turn on one customer flag (e.g. Order placed) → confirm SMS.
4. Confirm unverified phone / SMS pref OFF / flag OFF → **no SMS** (check API logs: “skipped”).

### E3 — Negative checks

- Personal old Twilio SIDs removed from Production.
- Trial template mode OFF.
- No secrets in GitHub.
- Admin login still email-only (no phone OTP).

---

## F. Ownership checklist (who does what)

| # | Task | Owner |
|---|------|--------|
| 1–3 | BlinksMed Twilio account + upgrade + business profile | Senior / Ops |
| 4 | India DLT PE + Header + Templates | Senior + telecom/Twilio partner |
| 5–7 | Verify Service + Messaging Service + India geo | Senior |
| 8–9 | Credentials handoff | Senior → DevOps |
| 10 | Put secrets on server + restart API | DevOps |
| 11 | Admin SMS toggles gradual enable | Product / Admin |
| E | End-to-end test | QA + Dev |

---

## G. What senior should return (minimum)

1. Paid BlinksMed Twilio account ready
2. `AC` / Auth Token / `VA` / `MG` (or From number)
3. Confirmation: Business Profile approved
4. Confirmation: India DLT + geo permissions done
5. Confirmation: Verify SMS to a real `+91` test phone works from Console
6. Confirmation: Messaging SMS to same phone works from Console

Once that package exists, DevOps only plugs values into Production config and restarts the API — **no code change required** for account ownership switch from personal → BlinksMed.

---

## H. Cutover from personal Twilio account

1. Note old personal SIDs (backup only).
2. Switch Production config to BlinksMed SIDs (Step 9).
3. Restart API.
4. Run Section E tests.
5. Rotate/revoke the personal Auth Token afterward.
6. Confirm personal account is no longer referenced anywhere in server env / secrets.
