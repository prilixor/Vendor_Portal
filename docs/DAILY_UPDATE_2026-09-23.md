# Daily update — 23 Sep 2026

**Task 1: 2Factor provider implementation (done)**
- Added `Sms:Provider` switch (`2Factor` | `Twilio`) behind existing OTP/SMS interfaces
- Implemented `TwoFactorPhoneVerificationService` and `TwoFactorSmsService`
- Config: `SenderId` `BLNKSM`, `OtpTemplateName` `SmsTemp1`, transactional OTP send path
- Sample Dev/Prod JSON + setup docs committed on `feature/2factor-sms-otp` (`f5f3485`)

**Task 2: Personal Use account testing (done)**
- Wired Personal API key locally; login/send-otp calls 2Factor successfully
- App returns Success / “Verification code sent”
- AUTOGEN path often delivered **Voice call**, not SMS text
- Switched trial OTP to **Transactional TSMS** (`SmsTemp1` + `VAR1`) so SMS template is used
- Dev OTP logged in API console for local verify when SMS does not arrive

**Task 3: Delivery failure root cause (confirmed)**
- 2Factor Transactional Logs: status **`DLT-CNT-REJECT`**, Delivered At empty, Credits 0
- API Success ≠ SMS on phone — India DLT rejects content without PE/Header/template on telco DLT
- Personal Use can accept API calls but cannot complete reliable India SMS delivery

**Task 4: Business account blocked (blocker)**
- Business signup needs GST / company KYC / authorized person docs (not available yet)
- Without Business + **PE ID** + DLT-approved Header (`BLNKSM`) + templates, full OTP & transactional SMS flow cannot go live
- Documented collect checklist + PE steps: `docs/TWOFACTOR_BUSINESS_DATA_COLLECTION.md`

**Task 5: Full OTP & SMS flow status (not complete)**
- End-to-end **SMS OTP to mobile** — blocked (`DLT-CNT-REJECT` / Personal)
- Order / transactional SMS — off (`TransactionalSmsEnabled: false`) until Business + DLT
- Local app flow (send → enter code from DEV log → verify) — works for code testing only

**Task 6: Branch hygiene**
- Merged latest `origin/develop` into `feature/2factor-sms-otp` (`b93e03e4`, no conflicts)
- Brought in admin slim list paging + product minimum rental days from develop

**Task 7: Next (when Business docs ready)**
- Open 2Factor Business → get PE ID on Jio/Airtel/Vi DLT
- Approve Header + OTP/order templates → map in 2Factor
- Replace Personal API key → retest until log status is Delivered (not `DLT-CNT-REJECT`)
- Then enable transactional SMS flags gradually
