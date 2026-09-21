# BlinksMed Twilio registration — Senior handoff

**Audience:** Technical / Senior (Twilio + India SMS setup)  
**Goal:** Create a **BlinksMed-owned** Twilio account (not personal), complete India compliance, then return the credential package below.  
**Dev team will plug values into Production** — you do not need to change application code.

---

## What you must create (summary)

| Item | Why |
|------|-----|
| Paid Twilio account under BlinksMed | Personal/trial accounts are not acceptable for Production |
| Business Profile approved | Trust / compliance |
| India DLT (PE + Header + Templates) | Required for SMS to Indian mobiles |
| **Verify Service** (`VA...`) | OTP SMS (register / phone verify / forgot password) |
| **Messaging Service** (`MG...`) or From number | Transactional SMS (orders, account alerts) |
| India (+91) geo permission | SMS delivery to India |

---

## Step-by-step registration

### 1. Create BlinksMed Twilio account

1. Open [https://console.twilio.com](https://console.twilio.com).
2. Register with a **BlinksMed company email** (not personal Gmail).
3. Enter legal company name **BlinksMed** (as on incorporation / GST).
4. Use company address and company contact number.
5. Turn on **2FA** for the Twilio login.
6. Add billing under BlinksMed finance ownership.

---

### 2. Upgrade to paid (leave Trial)

1. Console → **Billing** → **Upgrade**.
2. Add payment method and complete upgrade.
3. Confirm account status is **not Trial**.

Trial accounts cannot send real free-form Production SMS reliably for India.

---

### 3. Complete Business Profile (Trust Hub)

1. Console → **Trust Hub** / **Business Profile**.
2. Submit:
   - Legal business name
   - Address, website (e.g. `https://blinksmed.com`)
   - Registration / GST / PAN as requested
   - Authorized representative (name, email, phone)
3. Upload required documents.
4. Wait until status is **Approved**.

---

### 4. India DLT compliance (mandatory)

Without DLT approval, SMS to +91 numbers will fail or be blocked.

1. Register **Principal Entity (PE)** = BlinksMed on the required DLT portal(s).
2. Register **Sender ID / Header** for BlinksMed.
3. Register **content templates** for transactional SMS (order updates, account alerts, etc.).
4. Complete whatever Twilio India asks to link DLT + sender to Messaging / Verify.
5. Keep screenshots + approved template IDs.

Also complete any Twilio checklist for **Verify SMS to India**.

---

### 5. Create Verify Service (OTP) → get `VA...`

1. Console → **Verify** → **Services** → **Create**.
2. Name: `BlinksMed OTP`.
3. Enable channel: **SMS**.
4. Code length: **6 digits**.
5. Copy **Service SID** (`VA...`).

This is used for OTP only (customer/vendor register, phone verify, forgot-password SMS).

---

### 6. Create Messaging sender (transactional SMS) → get `MG...` or `+...`

**Preferred:** Messaging Service

1. Console → **Messaging** → **Services** → **Create**.
2. Name: `BlinksMed Transactional`.
3. Attach India-capable sender / number per Twilio + DLT approval.
4. Copy **Messaging Service SID** (`MG...`).

**Alternative:** Use a single Twilio From number in E.164 (`+...`) that can SMS India.

---

### 7. Enable India geo permissions

1. Console → Messaging settings → **Geo permissions** (or equivalent).
2. Allow SMS to **India (+91)**.
3. Confirm Verify can send SMS to India.

---

### 8. Copy API credentials

1. Console → Account → **Account SID** (`AC...`) and **Auth Token**.
2. Store Auth Token in a password manager.
3. Do **not** put secrets in email/chat long-term; use secure handoff (1Password / encrypted note).

---

### 9. Console self-test (before sharing)

From Twilio Console, using a real Indian test mobile (`+91XXXXXXXXXX`):

1. **Verify:** send a test OTP SMS → receive code on phone.  
2. **Messaging:** send a short test SMS via Messaging Service / From number → receive on phone.

Only share the package below after both succeed.

---

## Return this package to Dev (fill completely)

Copy, fill, and share securely:

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

### Optional (if available)

```text
Messaging Service friendly name: ________________
Verify Service friendly name: ________________
DLT PE ID: ________________
DLT Header / Sender ID: ________________
Approved template IDs (list): ________________
Staging/subaccount used? (Y/N): ________________
```

---

## What Dev will do with your package (FYI only)

Dev will set Production API config like:

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

Then restart the API and run OTP / SMS smoke tests.  
**You only need to complete registration and return the filled package above.**

---

## Done when

- [ ] BlinksMed paid Twilio account exists  
- [ ] Business Profile approved  
- [ ] India DLT PE + Header + Templates approved  
- [ ] India geo permission enabled  
- [ ] `AC` / Auth Token / `VA` / `MG` (or From) ready  
- [ ] Console OTP + Messaging tests passed to +91  
- [ ] Filled package shared securely to Dev  
