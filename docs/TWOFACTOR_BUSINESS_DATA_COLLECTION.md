# BlinksMed — 2Factor Business account data collection checklist

**Purpose:** Collect everything needed to open a **2Factor Business** account and complete India **DLT** (PE + Header + Templates) so BlinksMed can send real OTP and transactional SMS.

**Related:** `docs/TWOFACTOR_SETUP_AND_IMPLEMENTATION.md`  
**Branch:** `feature/2factor-sms-otp`  
**Status:** Personal Use is for OTP trial only. Business + DLT is required for Production customer SMS.

---

## Why this is needed

| Path | Use |
|------|-----|
| Personal Use | Limited OTP testing only |
| **Business + DLT** | Real India SMS (OTP + order/account SMS) |

Business signup and PE registration typically need **GST, PAN, and authorized person KYC**. Without those, Business / PE will stall.

---

## 1. Company identity (must match legal name)

| Item | Collect? | Value / file |
|------|----------|--------------|
| Legal entity name (exact on PAN) | ☐ | |
| Entity type (Pvt Ltd / LLP / Partnership / Proprietorship) | ☐ | |
| Business PAN | ☐ | |
| **GSTIN** | ☐ | |
| GST registration certificate (PDF/JPG) | ☐ | |
| CIN / LLPIN / registration number | ☐ | |
| Certificate of Incorporation / LLP agreement / Partnership deed | ☐ | |
| MOA / AOA (if Pvt Ltd) | ☐ | |

---

## 2. Address and contact

| Item | Collect? | Value / file |
|------|----------|--------------|
| Registered office address | ☐ | |
| Address proof (GST / utility / rent / Shop & Establishment) | ☐ | |
| Business email (prefer company domain, e.g. `@blinksmed.com`) | ☐ | |
| Business phone (Indian mobile for OTP) | ☐ | |
| Website | ☐ | `https://blinksmed.com` |

---

## 3. Authorized person (signup + DLT OTPs)

| Item | Collect? | Value / file |
|------|----------|--------------|
| Full name | ☐ | |
| Designation (Director / Authorized Signatory) | ☐ | |
| Mobile | ☐ | |
| Email | ☐ | |
| Aadhaar / Passport / Voter ID (soft copy) | ☐ | |
| Letter of Authorization on company letterhead (if needed) | ☐ | |
| Board resolution (sometimes required for Pvt Ltd) | ☐ | |

---

## 4. Billing / wallet (2Factor Business)

| Item | Collect? | Value / file |
|------|----------|--------------|
| GSTIN for invoices | ☐ | |
| Billing address | ☐ | |
| Payment method (UPI / card / NEFT) | ☐ | |
| Finance contact name + email | ☐ | |

---

## 5. SMS brand details (for DLT after Business signup)

| Item | Collect? | Value / notes |
|------|----------|---------------|
| Preferred **Sender ID / Header** (6 characters) | ☐ | e.g. `BLNKSM` / `BLINKS` |
| Brand name in templates | ☐ | BlinksMed |
| Sample OTP text | ☐ | e.g. `Your BlinksMed OTP is {#var#}. Valid for 10 minutes.` |
| Sample order SMS texts | ☐ | Order placed / confirmed / cancelled (see app `SmsTemplates`) |
| Message purpose | ☐ | Transactional + OTP only (promo separate if ever needed) |

### Suggested OTP template (draft)

```text
Your BlinksMed verification code is {#var#}. Do not share this code. Valid for 10 minutes. - BlinksMed
```

### Suggested transactional examples (draft — align with DLT variable rules)

- Order placed  
- Order confirmed by vendor  
- Order cancelled  
- Order status update  
- Vendor new order / dispatch offer  
- Vendor account approved / rejected / suspended  

Exact wording should match approved DLT templates and `SmsTemplates.cs`.

---

## 6. How to get PE ID (Principal Entity ID)

**PE ID** is issued by a **telecom DLT portal**, not by 2Factor’s “Map Entity” screen.  
2Factor only **stores / maps** the PE ID after the telco approves you.

### Important facts

- Register as **Principal Entity (PE / Enterprise)** — **not** Telemarketer (TM).  
- You register on **one** operator portal first; PE ID is then usable across operators / SMS gateways.  
- Typical fee: about **₹5,000 + GST / year** (confirm on the portal you choose).  
- Approval: usually **2–7 business days** (can be longer if docs mismatch).  
- PE ID is often a long numeric **Entity ID** shown in the DLT dashboard and sent by email/SMS.

### DLT portals (pick one to start)

| Operator | Portal |
|----------|--------|
| **Jio** (commonly used) | https://trueconnect.jio.com |
| **Airtel** | https://dltconnect.airtel.in |
| **Vi (Vodafone Idea)** | https://www.vilpower.in |
| **BSNL** | https://ucc-bsnl.co.in (or current Smartping/BSNL DLT URL) |

Ask **2Factor support** if they prefer a specific portal for assisted onboarding.

### Step-by-step (first-time PE — no existing Entity ID)

1. **Prepare docs** from Sections 1–3 (PAN, GST, incorporation, address, authorized person ID, LOA).  
2. Open one portal above → **Register / Sign up**.  
3. Choose **Principal Entity** / **Enterprise** (not Telemarketer).  
4. When asked *“Already registered with another operator?”* → select **No** (first time).  
5. Enter **PAN** and verify.  
6. Fill organization details exactly as on PAN / GST / incorporation:
   - Legal name  
   - Entity type / category  
   - GSTIN (verify if offered)  
   - Registered address  
   - Authorized signatory name, email, mobile  
7. **Upload KYC** (clear PDF/JPG, within size limits):
   - Business PAN  
   - GST certificate  
   - Incorporation / registration proof  
   - Authorized person ID  
   - LOA / board resolution if required  
8. Verify **email OTP** and **mobile OTP**.  
9. Pay the portal registration fee if prompted.  
10. **Submit** and wait for approval.  
11. On approval you receive **PE / Entity ID** by email/SMS — also visible after login under Entity / Profile.  
12. **Save** PE ID, portal login, and screenshots.

### If BlinksMed already has a PE ID elsewhere

1. On the new portal, select **Yes** (already registered).  
2. Enter existing **PE / Entity ID** + PAN and verify.  
3. Complete any extra KYC that portal asks.  
4. Use the **same PE ID** when mapping in 2Factor.

### After PE ID is approved — Header + Templates

1. In the **same DLT portal**, register a **Header / Sender ID** (6 characters, e.g. `BLNKSM`).  
2. Wait until Header status = **Approved**.  
3. Register **OTP** and **transactional** content templates (use `{#var#}` where required).  
4. Wait until templates = **Approved**.  
5. Note Header + Template IDs for Dev.

### Map PE ID into 2Factor

1. Login to **2Factor Business** dashboard.  
2. Open **DLT / Map Entity** (or “Map Principal Entity”).  
3. Enter:
   - **PE ID** from telco  
   - Entity / company name (must match DLT)  
   - Header / Sender ID  
4. Save / submit mapping.  
5. Confirm 2Factor shows entity **mapped / active**.  
6. Re-test OTP — expect **SMS text**, not Voice-only fallback.

### Common rejection reasons

- Legal name / PAN / GST mismatch  
- Unclear or wrong document uploads  
- Wrong entity type selected  
- Signatory mobile/email not reachable for OTP  
- LOA missing when required  

### What PE ID is *not*

| Not PE ID | Where that comes from |
|-----------|------------------------|
| 2Factor API Key | 2Factor dashboard |
| SenderId alone | DLT Header approval |
| Personal Use account id | 2Factor Personal signup |
| “MAP NEW ENTITY” without telco PE | Will not create a real PE ID |

---

## 7. Minimum pack to start Business signup

If collecting in stages, get these first:

1. Legal name + entity type  
2. **Company PAN**  
3. **GSTIN** + GST certificate PDF  
4. Registered address  
5. Authorized person name, mobile, email + Aadhaar (or Passport)  
6. LOA on letterhead (if signatory is not sole owner)  
7. Preferred 6-letter Sender ID  
8. Company email for 2Factor login  

---

## 8. After registration — return to Dev (secure handoff)

Share via 1Password / encrypted note — **not** long-lived chat or git.

```text
2Factor Account (BlinksMed Business)
Login email: ________________
Login phone: ________________

API Key: ____________________   (secret)
SenderId / Header: __________
PE ID: ______________________
DLT operator: Jio / Vi / Airtel / BSNL (circle one)

OTP template name/id: ________
Transactional template ids:
  - CustomerOrderPlaced: ____
  - CustomerOrderConfirmed: ____
  - ... (list as approved)

Wallet topped up? Y/N
Console OTP SMS test passed? Y/N   (must be SMS text, not Voice call)
Console transactional SMS test passed? Y/N
```

---

## 9. Suggested ownership

| Step | Owner |
|------|--------|
| Collect docs (Sections 1–5) | Ops / Founder / Finance |
| Create 2Factor **Business** account | Same authorized person |
| Get PE ID on telco DLT (Section 6) | Same person + 2Factor support if assisted |
| Header + Templates on DLT | Same person |
| Map PE in 2Factor dashboard | Ops |
| Put API key in AWS Production config | DevOps |
| App `Sms:Provider = 2Factor` go-live | Dev |

---

## 10. Done when

- [ ] Business account live under BlinksMed  
- [ ] PE ID issued by telco DLT and mapped in 2Factor  
- [ ] Header (SenderId) approved  
- [ ] OTP + transactional templates approved  
- [ ] Console test delivers **SMS text** (not Voice-only)  
- [ ] Credential package shared securely with Dev  
- [ ] Personal Use key retired from Production config  
