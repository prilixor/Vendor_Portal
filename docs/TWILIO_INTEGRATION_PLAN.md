# Twilio Integration Plan (WebApps First)

**Scope:** Customer, Vendor, and Admin web apps (`seller-sparkle-ui`) via shared API.  
**Status:** Phase 1–3 Web SMS/OTP complete (delivery logs + Admin Twilio UI still open in Phase 4–5).  
**Date:** 2026-08-13

---

## Current state (baseline)

| Area | Today | Twilio gap |
|------|--------|------------|
| Auth | Email + password; email verification links | No phone OTP |
| Phone storage | Vendor `SupportPhone` (required); Customer `Phone` (optional) | Not verified |
| Notifications | In-app + email + web push | `sms` channel mentioned but unused |
| Helpers already present | `IndianMobileInput`, `IndianMobilePhone`, `input-otp` UI | Ready to reuse |
| Login | Vendor can be resolved by phone in auth | No SMS login yet |
| Twilio SDK / config | None | Need Phase 1 foundation |

**Principle:** Twilio lives in the **API only**. WebApps call endpoints and show OTP / preference UI. Mobile apps reuse the same API later. Do not invent parallel `/api/mobile` SMS routes.

---

## Where Twilio fits by portal

### Customer Web (`/customer/...`)

| Flow | Why Twilio | Priority |
|------|------------|----------|
| Register / add phone → SMS OTP verify | Phone optional today; must verify before SMS alerts | **P0** |
| Forgot password → SMS OTP (optional alongside email) | Faster recovery | P1 |
| Order placed / confirmed / cancelled / status change | Transactional SMS | **P0** |
| Dispatch failed / “no vendor found” | Critical UX | P1 |
| Rental expiring soon (`order_expiring_soon`) | Already have in-app type | P1 |
| Deposit / refund updates | Preference already exists | P2 |
| Support chat reply | Prefer in-app; SMS only if urgent | P2 |

### Vendor Web (`/vendor/...`)

| Flow | Why Twilio | Priority |
|------|------------|----------|
| Register phone → SMS OTP verify | Phone required; not verified today | **P0** |
| Settings: change `SupportPhone` → re-verify OTP | Prevent hijack / wrong number | **P0** |
| New order / dispatch offer | Time-sensitive; email alone is slow | **P0** |
| Order status / photos requested / expiring soon | Operational alerts | P1 |
| Admin approve / reject / suspend / ban / reactivate | Keep email; SMS secondary | P2 — done (account-alert SMS) |
| Admin verifies docs / bank / service area | Ops alerts when profile pieces change | **P1** — done |
| Login by phone (passwordless) | Optional later | P2 |

### Admin Web (`/admin/...`)

| Flow | Why Twilio | Priority |
|------|------------|----------|
| Do **not** SMS end-users from Admin UI directly | Admin actions use shared backend notification service | — |
| Optional: Admin 2FA SMS on login | Privileged account security | P2 |
| Settings: Twilio health / templates / delivery logs | Ops visibility | P1 |
| Manual “resend SMS” on order/vendor detail | Support tooling (like doctor email resend) | P2 |
| Doctor invite | Keep email; WhatsApp later if needed | Skip v1 |

---

## Recommended Twilio products (India)

1. **Twilio Verify** — OTP for phone verify / login / reset (preferred over storing OTPs yourself).
2. **Twilio Programmable Messaging (SMS)** — transactional order/vendor alerts.
3. **WhatsApp via Twilio** — Phase 2 (high open rates in India); needs approved templates.

---

## Begin → end phases

### Phase 0 — Decisions

- Channels: SMS only for v1 (WhatsApp later).
- Roles: Customer + Vendor SMS; Admin email-only + optional 2FA later.
- Phone format: store E.164 (`+91XXXXXXXXXX`); keep Indian mobile normalizer.
- Consent: SMS only if phone verified **and** preference enabled.
- Compliance: India DND / TRAI — use Twilio India-compliant sender / registered templates where required.

### Phase 1 — Backend foundation (API first)

Build once, use everywhere:

1. Config: `Twilio:AccountSid`, `AuthToken`, `FromNumber` / MessagingServiceSid, `VerifyServiceSid`.
2. Abstractions (mirror `IEmailService`):
   - `ISmsService`
   - `IPhoneVerificationService`
3. Implementation: `TwilioSmsService`, `TwilioVerifyService`.
4. Database:
   - `phone_verified_at` on Customer + Vendor
   - `sms_notifications_enabled` on customer + vendor prefs
   - optional `notification_delivery_logs` (to, type, sid, status)
5. Shared dispatcher:
   - When creating in-app notification, optionally also email / push / **SMS** based on type + prefs + verified phone.
6. Endpoints (shared under `/auth` or `/users`):
   - `POST /auth/phone/send-otp`
   - `POST /auth/phone/verify-otp`
   - Prefer Twilio Verify so OTPs are not stored in-app.

### Phase 2 — Customer Web (auth + settings)

1. Register / Settings: after phone enter → OTP screen (reuse `input-otp`).
2. Block “SMS alerts” until phone verified.
3. Preferences UI: toggle SMS for order status / expirations.
4. Wire transactional SMS to existing events:
   - `order_pending`
   - `order_confirmed`
   - `order_cancelled`
   - `order_status_updated`
   - `order_expiring_soon`
   - `order_dispatch_failed`

### Phase 3 — Vendor Web (auth + ops alerts)

1. Register + Settings: verify `SupportPhone` with OTP.
2. Prefs: `SmsNotificationsEnabled` + keep `NewOrderNotifications`.
3. SMS on:
   - `dispatch_offer` / new order (**highest business value**)
   - `order_photos_requested`
   - `order_expiring_soon`
4. Account lifecycle SMS: approve / reject / suspend / ban / reactivate (plus email).

### Phase 4 — Admin Web (control plane)

1. Admin Settings: Twilio health (configured / sandbox / live).
2. Order / Vendor detail: read-only “SMS delivered?” from logs.
3. Optional later: Admin login SMS 2FA.
4. No Twilio SDK in Admin React — only API-backed actions.

### Phase 5 — Hardening

- Rate limits on send-otp (per phone + IP).
- Idempotent SMS (no double-send on retries).
- Webhook: Twilio status callbacks → update delivery log.
- Feature flags: `Sms:Enabled`, per-environment kill switch.
- Templates centralized (like `EmailTemplates`).
- Observability: failed sends visible in audit / support tools.

### Phase 6 — After Web is stable

- Reuse same API in Customer Mobile + Vendor Mobile.
- Consider WhatsApp templates for order updates.

---

## Suggested build order (shipping slices)

```text
1) Twilio SDK + ISms / IVerify in API
2) Phone OTP verify (Customer + Vendor Web)
3) Vendor “new order / dispatch offer” SMS   ← biggest business win
4) Customer order lifecycle SMS
5) Prefs + delivery logs in Admin
6) Forgot-password SMS / login OTP (optional)
7) WhatsApp (later)
```

**First shipping slice recommendation:** Phase 1 + phone OTP (Customer/Vendor) + Vendor dispatch-offer SMS.

---

## What not to do

- Do not call Twilio from React (secrets + CORS).
- Do not invent parallel `/api/mobile` SMS routes — same `/auth/...` and notification pipeline for web + mobile.
- Do not SMS every in-app notification — only high-signal events.
- Do not enable SMS before phone verification.

---

## Codebase hooks to extend

| Layer | Files / areas |
|-------|----------------|
| Auth | `AuthEndpoints`, Register, CustomerRegister, Settings phone fields |
| Prefs | `VendorNotificationPreference`, `CustomerNotificationPreference` |
| Events | `CustomerCommands`, `CustomerDispatchCommands`, `CustomerExpirationQueries`, vendor approve/reject email commands |
| UI ready | `IndianMobileInput`, `input-otp` |
| Channel hint | Vendor notifications already accept `channel: "sms"` |
| Email pattern to mirror | `IEmailService`, `SmtpEmailService`, `EmailTemplates` |

---

## Architecture (target)

```text
WebApp (Customer / Vendor / Admin)
        │
        ▼
   VendorPortal API
        │
        ├─ IPhoneVerificationService ──► Twilio Verify (OTP)
        ├─ ISmsService ────────────────► Twilio Messaging (SMS)
        └─ Notification dispatcher
               ├─ in_app (existing)
               ├─ email (existing)
               ├─ push (existing)
               └─ sms (new; prefs + verified phone)
```

---

## Checklist (WebApps)

### Phase 1 — API
- [x] Twilio config + secrets
- [x] `ISmsService` / `IPhoneVerificationService` + Twilio impl
- [x] Phone verified columns + SMS pref flags + Admin SMS toggles  
      (incremental: `059`–`065`; **one-shot:** `Schema/twilio_sms_full_setup.sql` + `.ps1`)
- [x] `send-otp` / `verify-otp` endpoints
- [ ] Optional delivery log table

### Phase 2 — Customer Web
- [x] OTP UI on settings
- [x] SMS preference toggles
- [x] Order lifecycle SMS wiring (pending / confirmed / cancelled / status / dispatch failed)
- [x] Register: email OR phone (email-only → verify link; phone/both → SMS OTP required)
- [x] Login by email or phone; block unverified email-only accounts
- [x] SMS alerts only after phone exists + verified (Settings prompt)
- [x] Expiration reminder SMS
- [x] Forgot-password SMS OTP (email link / SMS by method)

### Phase 3 — Vendor Web
- [x] OTP UI on settings phone change
- [x] SMS preference toggles
- [x] Dispatch offer / new order SMS (when Twilio enabled + phone verified)
- [x] Admin account approve / reject SMS
- [x] Admin document / bank verify SMS
- [x] Admin service-area radius set SMS
- [x] Forgot-password SMS OTP (vendor SupportPhone)
- [x] OTP on register (required SMS OTP, then email verify) + shell gate for unverified phone
- [x] Suspend / ban / reactivate SMS
- [x] ~~Admin mobile + OTP / forgot-SMS~~ — removed (Admin is email-only)

### Phase 4 — Admin Web
- [x] Twilio transactional SMS event toggles (Admin → SMS / Twilio)
- [x] Twilio configured indicator on SMS settings page
- [ ] Delivery log views
- [ ] (Optional) Admin 2FA SMS

### Phase 5 — Hardening
- [ ] Rate limits, idempotency, webhooks, feature flag, templates

### Phase 6 — Mobile parity
- [ ] Customer Mobile + Vendor Mobile reuse same API
- [ ] WhatsApp templates (optional)

---

## Open decisions

1. Twilio Verify vs custom OTP stored in DB?
2. SMS for vendor approve/reject in v1, or email-only? → **SMS + email** (account alerts; phone verified + SMS pref)
3. Admin 2FA in v1 or defer?
4. WhatsApp in same project timeline or separate phase?
5. Exact India sender ID / DLT template registration owner?
