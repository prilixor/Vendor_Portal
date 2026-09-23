# 2Factor setup & implementation guide (BlinksMed)

**Branch for code:** `feature/2factor-sms-otp` (based on `feature/twilio-integration`)  
**Twilio backup:** `backup/twilio-before-2factor` + tag `twilio-baseline-2026-09-22`  
**Status (2026-09-22):** Proceeding with **Personal Use** 2Factor account for **OTP trial only** (no GST / PE yet).  
Business + DLT PE required later for Production customer SMS.

**Business data checklist:** [`docs/TWOFACTOR_BUSINESS_DATA_COLLECTION.md`](./TWOFACTOR_BUSINESS_DATA_COLLECTION.md)

**Pricing (published, excl. GST):** OTP ≈ **₹0.17**, Transactional SMS ≈ **₹0.15** (≤100K/mo).  
Source: [2Factor pricing](https://2factor.in/v4/pricing.html)

---

## Current decision: Personal Use (trial)

| Item | Choice |
|------|--------|
| Account type | **Personal Use** (temporary) |
| Scope | OTP send/verify smoke tests on your own +91 number |
| Order / transactional SMS | **Off** until Business + GST + PE/DLT |
| Production customers | **Do not** use Personal API key in live Production |

### What you do in the Personal dashboard

1. Open 2Factor → copy **API Key** (do **not** paste it into chat).
2. Confirm **SMS OTP** balance &gt; 0.
3. Optional: run console OTP test to your phone.
4. **Local Dev** — put the key in gitignored `appsettings.Development.json` or user-secrets:

```json
"Sms": { "Provider": "2Factor" },
"TwoFactor": {
  "Enabled": true,
  "ApiKey": "<your-personal-api-key>",
  "TransactionalSmsEnabled": false
},
"Twilio": { "Enabled": false }
```

5. **AWS Production** — merge the same shape into server `appsettings.Production.json` (see `appsettings.Production.sample.json`). Replace `ApiKey`, keep `TransactionalSmsEnabled: false` until Business + DLT, restart API.

6. Test OTP on **your** phone only.

When BlinksMed has GST + PE, create **Business** account, map DLT, switch secrets to Business key, set `TransactionalSmsEnabled: true`.

---

## How BlinksMed uses messaging today

| Need | Today (Twilio) | With 2Factor |
|------|----------------|--------------|
| OTP (register / phone verify / forgot password) | Twilio Verify | 2Factor OTP API |
| Order + account SMS | Twilio Messaging | 2Factor Transactional SMS |
| Admin SMS event toggles | Already built | **Keep as-is** |
| Vendor / Customer / Admin / Mobile | Same API | Same API — no mobile rewrite |
| WhatsApp | Not built | **Future phase** |

OTP is **not** controlled by Admin SMS toggles.  
Transactional SMS requires: provider enabled + Admin flag ON + phone verified + user SMS prefs.

---

# Part A — Account creation (Ops / Senior) — do this first

## A1. Create BlinksMed 2Factor account

1. Open [https://2factor.in](https://2factor.in) (or [https://2factor.in/v4/](https://2factor.in/v4/)).
2. Sign up with a **BlinksMed company email** (not personal Gmail).
3. Company name: **BlinksMed** (legal entity name).
4. Fill company address, GST (if available), contact phone.
5. Enable dashboard 2FA if offered.
6. Confirm account ownership sits with BlinksMed ops/finance.

**Deliverable:** 2Factor console login under BlinksMed.

---

## A2. Choose plan / wallet

1. Prefer **Growth** or pay-as-you-go wallet with enough credits for testing + early Production.
2. Add payment / top-up wallet (UPI / card / NEFT as offered).
3. Confirm GST invoice is available for BlinksMed.

Optional: start with free test credits only for sandbox, then top up for live +91 tests.

**Deliverable:** Wallet funded (or test credits ready).

---

## A3. DLT registration (mandatory for India SMS)

2Factor assists with DLT (Principal Entity + Header + Templates).

**PE ID is created on a telco DLT portal (Jio / Airtel / Vi / BSNL), not inside 2Factor alone.**  
Full step-by-step: [`docs/TWOFACTOR_BUSINESS_DATA_COLLECTION.md`](./TWOFACTOR_BUSINESS_DATA_COLLECTION.md) → **Section 6. How to get PE ID**.

1. Collect company KYC (PAN, GST, authorized person, LOA).  
2. Register as **Principal Entity** on one portal (e.g. https://trueconnect.jio.com).  
3. After approval, copy **PE / Entity ID** from email or dashboard.  
4. On the same portal: approve **Header** + **Templates**.  
5. In 2Factor Business → **Map Entity** → enter PE ID + Header.  
6. Keep screenshots / IDs.

Without DLT approval, live SMS to Indian mobiles will fail or fall back (e.g. Voice only).

**Deliverable:** DLT PE + Header + templates approved.

---

## A4. Register message templates (map to our app)

Register DLT templates that match (or closely match) these bodies from `SmsTemplates.cs`:

### OTP templates
- Customer / Vendor phone verification OTP  
- Forgot-password OTP  
(Use 2Factor OTP product / AUTOGEN flow; still need DLT-compliant OTP template as required by 2Factor.)

### Customer transactional
- Order placed  
- Order confirmed by vendor  
- Order cancelled  
- Order status update (in transit / delivered / returned / etc.)  
- Dispatch failed / re-book  
- Order expiring soon  

### Vendor transactional
- New order / dispatch offer  
- Account approved / rejected / suspended / banned / reactivated  
- Bank verified / rejected  
- Document approved / rejected  
- Service area radius updated  

**Deliverable:** Template IDs listed and approved.

---

## A5. Enable OTP + Transactional SMS products

In 2Factor dashboard:

1. Enable **OTP SMS** (priority route).
2. Enable **Transactional / Bulk SMS**.
3. Note API base URLs / docs for:
   - OTP send (AUTOGEN)  
   - OTP verify  
   - Transactional SMS send (with template ID / variables)
4. Create / copy **API Key** (Auth key).
5. Restrict key access (ops + DevOps only).

**Deliverable:** API Key + Sender ID + OTP + transactional template IDs.

---

## A6. Console self-test (before coding / go-live)

Using a real Indian test mobile `+91XXXXXXXXXX`:

1. **OTP:** send OTP from console/API → receive SMS → verify code succeeds.  
2. **Transactional SMS:** send one order-style template → receive SMS.  
3. Confirm delivery reports (DLR) visible.

Only then share credentials with Dev.

---

## A7. Credential package to return to Dev

Copy, fill, share securely (1Password / encrypted note — not long-lived chat):

```text
2Factor Account (BlinksMed)
------------------------------------
Console URL / owner email: ________________
API Key / Auth Key: ________________
Sender ID / Header: ________________
OTP Template ID (if required): ________________
Transactional template IDs:
  - customer_order_placed: ________________
  - customer_order_confirmed: ________________
  - customer_order_cancelled: ________________
  - customer_order_status: ________________
  - customer_dispatch_failed: ________________
  - customer_order_expiring: ________________
  - vendor_new_order: ________________
  - vendor_account_approved: ________________
  - vendor_account_rejected: ________________
  - vendor_account_suspended: ________________
  - vendor_account_banned: ________________
  - vendor_account_reactivated: ________________
  - vendor_bank_verified: ________________
  - vendor_document_verified: ________________
  - vendor_service_area_updated: ________________
DLT PE approved? (Y/N): ________________
DLT Header approved? (Y/N): ________________
Wallet topped up? (Y/N): ________________
OTP console test passed? (Y/N): ________________
Transactional SMS console test passed? (Y/N): ________________
WhatsApp (later): not now
```

---

# Part B — Implementation (Dev) — after credentials exist

Work only on **`feature/2factor-sms-otp`**.  
Do **not** delete Twilio code yet — keep as fallback via config switch.

## B1. Design (keep existing architecture)

Keep:

- `IPhoneVerificationService` → OTP send/verify  
- `ISmsService` → transactional SMS  
- `CustomerSmsNotifier` / `VendorSmsNotifier` + Admin `platform_sms_settings` flags  
- All web + mobile calling existing `/auth/phone/*` and portal APIs  

Add:

- `TwoFactorOptions` (config)  
- `TwoFactorPhoneVerificationService`  
- `TwoFactorSmsService`  
- Provider switch: `Sms:Provider = "2Factor" | "Twilio"`

## B2. Config shape (example)

```json
"Sms": {
  "Provider": "2Factor"
},
"TwoFactor": {
  "Enabled": true,
  "ApiKey": "xxxxxxxx",
  "SenderId": "BLNKSM",
  "OtpTemplateName": "SmsTemp1",
  "UseTransactionalTemplateForOtp": true,
  "BaseUrl": "https://2factor.in/API/V1",
  "OtpResendCooldownSeconds": 45,
  "DevFallbackOtp": "",
  "TransactionalSmsEnabled": false,
  "Templates": {
    "CustomerOrderPlaced": "TEMPLATE_ID",
    "CustomerOrderConfirmed": "TEMPLATE_ID",
    "CustomerOrderCancelled": "TEMPLATE_ID",
    "CustomerOrderStatusUpdated": "TEMPLATE_ID",
    "CustomerOrderDispatchFailed": "TEMPLATE_ID",
    "CustomerOrderExpiring": "TEMPLATE_ID",
    "VendorNewOrder": "TEMPLATE_ID",
    "VendorAccountApproved": "TEMPLATE_ID",
    "VendorAccountRejected": "TEMPLATE_ID",
    "VendorAccountSuspended": "TEMPLATE_ID",
    "VendorAccountBanned": "TEMPLATE_ID",
    "VendorAccountReactivated": "TEMPLATE_ID",
    "VendorBankVerified": "TEMPLATE_ID",
    "VendorDocumentVerified": "TEMPLATE_ID",
    "VendorServiceAreaUpdated": "TEMPLATE_ID"
  }
},
"Twilio": {
  "Enabled": false
}
```

Put secrets in server/env — **never commit real API keys**.

## B3. Code tasks (checklist)

1. [x] Add `TwoFactorOptions` + `SmsOptions` in Domain/Options  
2. [x] Implement `TwoFactorPhoneVerificationService` (send AUTOGEN + verify session)  
3. [x] Implement `TwoFactorSmsService` (gated by `TransactionalSmsEnabled`; needs DLT for India)  
4. [x] Register DI in `StartupExtensions` based on `Sms:Provider`  
5. [ ] Map `SmsTemplates` / event kinds → 2Factor template IDs + variables (after Business DLT)  
6. [ ] Update Admin UI label “Twilio configured” → “SMS provider configured” (optional)  
7. [x] Keep Admin SMS toggles behavior unchanged  
8. [x] Development: allow local fallback OTP if provider disabled (same pattern as today)  
9. [ ] Unit/integration smoke tests for OTP send/verify + one order SMS  
10. [x] Do **not** change Customer/Vendor Mobile apps unless API contracts change (they shouldn’t)

## B4. Deploy / enable

1. Apply any DB scripts already required for SMS flags (if not on env).  
2. Set Production `Sms:Provider = 2Factor` + secrets.  
3. Restart API.  
4. Admin → SMS settings: leave transactional flags **OFF** initially.  
5. Test OTP only.  
6. Turn on **one** transactional flag (e.g. Customer Order placed) and verify.  
7. Enable remaining flags gradually.

## B5. Test plan

### OTP
- Customer register with phone → OTP → verify  
- Vendor register → OTP → verify  
- Settings phone change → OTP  
- Forgot password SMS → OTP → reset password  
- Wrong OTP fails; resend cooldown works  

### Transactional SMS
- Admin: master ON + Customer Order placed ON  
- Place order → customer with verified phone + SMS prefs ON gets SMS  
- Flag OFF / unverified phone / SMS pref OFF → no SMS (check logs “skipped”)  
- Vendor new order flag ON → vendor offer SMS  

### Regression
- Twilio path still selectable via config if needed  
- Admin remains email-only (no Admin phone OTP)

---

# Part C — WhatsApp (future — not now)

1. Complete SMS/OTP on 2Factor first.  
2. Later: enable WhatsApp Business API on same 2Factor account.  
3. Add channel selection in notifiers (SMS vs WhatsApp).  
4. Register WhatsApp templates separately (Meta + 2Factor).  
5. Do **not** overload current Admin SMS toggles without a clear channel model.

---

# Part D — Ownership

| Step | Owner |
|------|--------|
| A1–A7 Account, DLT, templates, credentials | Ops / Senior |
| B1–B5 Adapters, config, tests | Dev (this branch) |
| Admin flag rollout | Product / Admin |
| WhatsApp later | Product + Dev |

---

# Part E — Order of work (simple)

```text
1. Create BlinksMed 2Factor account
2. Wallet + DLT (PE / Header / Templates)
3. Console OTP + SMS tests
4. Share credential package with Dev
5. Implement adapters on feature/2factor-sms-otp
6. Config switch to 2Factor
7. OTP go-live
8. Turn Admin transactional SMS flags on gradually
9. (Later) WhatsApp
```

---

## Done when

- [x] Personal 2Factor account for OTP trial  
- [ ] Business account + DLT approved (later, needs GST)  
- [ ] OTP console + app tests passed (Personal)  
- [ ] Credential in local secrets (not chat / not git)  
- [x] `feature/2factor-sms-otp` implements 2Factor behind existing interfaces  
- [ ] OTP works in app against Personal key  
- [ ] Order SMS works with Admin toggles (after Business + DLT)  
- [x] Twilio kept as backup via `Sms:Provider`  
