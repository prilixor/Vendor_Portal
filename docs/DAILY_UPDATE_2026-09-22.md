# Daily update — 22 Sep 2026

**Task 1: Admin Orders list load**
- New `GET /admin/orders/summaries` — paged slim rows (search, status, stats)
- Admin Orders page uses summaries only
- Old `GET /admin/orders` left unchanged (bell, Notifications, Order detail)
- Commit: `db88803` on `fix/admin-orders-list-load`

**Task 2: Admin Vendors list load**
- New `GET /admin/vendors/summaries` — one paged query (name, email, status, doc/listing counts)
- Removed 3 extra calls per vendor card
- Old `GET /admin/vendors` left unchanged (Dashboard, Notifications, Verification detail, bell)
- After order-status change, also refresh the new Orders list cache
- Commit: `258254d`

**Task 3: Admin Verification list load**
- New `GET /admin/vendors/verification-summaries` — paged list with business name + stage
- Removed full vendor dump + one profile call per vendor
- Review dialog still loads docs / bank / profile / areas for that vendor only
- Commit: `ac41c93` (also on `origin/develop`)

**Task 4: Safety — no break in other apps**
- Customer Web / Customer Mobile / Vendor Web / Vendor Mobile unchanged
- Mobile `/mobile/vendors` still uses original `GetVendorsAsync`
- Fat admin dumps kept for shell badge, Dashboard, Notifications, Order/Vendor detail
- Checked after Orders + Vendors before starting Verification

**Task 5: R&D — India SMS/OTP vs Twilio (pricing)**
- Compared Twilio India cost vs local CPaaS for OTP + order SMS
- Shortlisted **2Factor** (MSG91 noted) as lower-cost India options
- OTP ≈ ₹0.17, transactional SMS ≈ ₹0.15 (2Factor, ≤100K/mo, excl. GST)
- Keep Twilio as backup; WhatsApp later, not now

**Task 6: Branch strategy — protect Twilio, start 2Factor**
- Twilio baseline: `backup/twilio-before-2factor` + tag `twilio-baseline-2026-09-22`
- Working branch: `feature/2factor-sms-otp` (from Twilio line)
- Swap provider behind existing OTP/SMS interfaces — no mobile rewrite

**Task 7: 2Factor account path (Personal Use trial)**
- Business signup blocked by GST / PE-ID — not available yet
- Personal Use for OTP trial only
- Production customer SMS still needs Business + DLT later
- `SenderId` empty until DLT header approved

**Task 8: 2Factor implementation (`feature/2factor-sms-otp`)**
- `Sms:Provider = 2Factor | Twilio` + `TwoFactorOptions`
- OTP: `TwoFactorPhoneVerificationService` (AUTOGEN send + session verify)
- Transactional SMS gated off (`TransactionalSmsEnabled: false`)
- Admin “configured” check accepts Twilio or 2Factor
- Guide: `docs/TWOFACTOR_SETUP_AND_IMPLEMENTATION.md`
- Adapter code is local; 2Factor commit still pending

**Task 9: OTP smoke test findings**
- App correctly calls OTP send on login / phone verify
- Manual AUTOGEN URL works, but 2Factor delivered **Voice**, not SMS
- Next: force SMS-only in 2Factor dashboard; Personal account may block SMS/DLT
