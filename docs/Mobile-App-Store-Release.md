# BlinksMed mobile apps — going live on Google Play and the App Store

**Audience:** leadership and the team preparing the public release  
**Date:** 25 September 2026  
**Apps:** BlinksMed (customers) and BlinksMed Vendor (vendors)  
**Status:** Android-only code work is in progress on branch `develop` (not committed). iPhone work is waiting. The apps are not on the stores yet.

### Engineering status (25 September 2026)

Done in the working copy, Android first:

- Release signing is wired for both apps. Upload keystores for this PC are outside git, in `D:\Prilixor\Vendor_Portal\android-upload-keys\`. Passwords are in `PASSWORDS-SAVE-THIS.txt` in that folder. Back that folder up. Losing it blocks future Play updates. `android/key.properties` points at those files and is gitignored.
- Android store builds target API 36 and no longer allow plain HTTP.
- Account deletion is in both apps (Profile on customer, Settings on vendor) and on the website at `/delete-account`. The API must be deployed before that button works on a live phone.

Still not done: Google Play and Apple accounts, store screenshots and descriptions, reviewer logins, and the actual `.aab` upload. iPhone location permission and the iPhone build are deferred until after Android.

This document explains what “publish the apps” means, what it costs, what is already done, what is still blocking, and the order of work.

---

## What we are publishing

We have **two separate apps**. Each one must be listed on **two stores**. That is **four store listings**, not one upload.

| | Customer app | Vendor app |
|---|---|---|
| Name on the phone | BlinksMed | BlinksMed Vendor |
| Who uses it | Patients / customers | Vendors |
| Android package name | `com.prilixor.prilixor_mobile` | `com.prilixor.vendor` |
| iPhone bundle id | `com.prilixor.prilixorMobile` | `com.prilixor.vendor` |
| Version today | 1.0.0 (build 1) | 1.0.0 (build 1) |
| Live API | `https://api.blinksmed.com/api` | `https://api.blinksmed.com/api` |
| Related website | `https://blinksmed.com` | `https://vendor.blinksmed.com` |

The package name and bundle id **cannot be changed after the first upload**. They are already set in the projects. Keep them.

A phone install of either app already uses the production API. It does not point at a developer machine.

---

## Cost and accounts

One Google account can publish both Android apps. One Apple account can publish both iPhone apps.

| Store | Where to enroll | Cost | Account type we should use |
|---|---|---|---|
| Google Play | [play.google.com/console](https://play.google.com/console) | **USD 25, one time** | **Company / organization** if possible |
| Apple App Store | [developer.apple.com/programs](https://developer.apple.com/programs/) | **USD 99 per year** | **Organization** (not an individual) |

### Why the account type matters

- **Google, personal Gmail account.** Google requires a closed test with **at least 12 testers for 14 continuous days** before a new personal account can release to the public. That adds two weeks after the apps are otherwise ready.
- **Google, organization account.** That 14-day / 12-tester rule usually does not apply. Prefer this.
- **Apple Organization.** Apple asks for a **D-U-N-S number** (a free business identifier from Dun & Bradstreet). Apple’s check of that number often takes several days to a couple of weeks. Start this first. It is the longest wait and does not depend on code.

### Machines

- **Android** can be built on the current Windows development PC.
- **iPhone cannot be built on Windows.** We need a Mac with Xcode, or a rented cloud Mac. There is no workaround.

---

## What is already in place

- Customer and vendor apps exist as separate Flutter apps.
- Home-screen names and icons are set (BlinksMed / BlinksMed Vendor).
- On a real phone, both apps call `https://api.blinksmed.com/api`.
- Privacy policy and terms already exist on the website:
  - `https://blinksmed.com/privacy-policy`
  - `https://blinksmed.com/terms-and-conditions`
  - Contact: `https://blinksmed.com/contact-us`
- Customer iPhone permission text exists for location and the photo library.
- Vendor iPhone permission text exists for camera and the photo library.

---

## What must be finished before the first upload

Uploading today would be rejected, or the install would not update correctly later.

### 1. Android release signing (both apps)

Release builds are still signed with a **debug key**. Google Play refuses that file.

We must create one **upload key** per app, store the file and passwords offline (password manager plus a backup), and **never commit them to git**. Losing an upload key blocks every future update of that app.

### 2. Account deletion (both apps)

Both apps let a person register. Google and Apple both require a way to **delete the account inside the app**. Google also wants a **public web page** where a user can request deletion. This screen does not exist yet.

### 3. Vendor iPhone location permission

The vendor app uses location (onboarding and service areas). The iPhone project has no location permission message. On iPhone that crashes the app or gets the app rejected. The customer app already has this message.

### 4. Reviewer logins on the live site

Store reviewers will not complete OTP, document upload, or vendor approval by themselves. Before we submit, create and write down:

- one working **customer** account, and
- one **vendor** account that is already **approved**

Put the email and password in the store review notes. Use dedicated test accounts, not a real patient’s account.

### 5. Android “cleartext HTTP” flag

Production traffic is already HTTPS. The Android config still allows plain HTTP. Play’s security form will ask about that. It should be turned off for the store build.

These five items are an engineering pass. They are not a store-console task.

---

## Store page materials (needed from the business)

Prepare this **once per app** (customer and vendor). The same text and images are reused on Google and Apple.

- Short description (Google allows 80 characters) and a full description.
- App icon, 512×512 PNG. The in-app icon already exists in the projects.
- Screenshots from a real phone, taken **after login**, so the screen is not empty: login, home, an order, profile.
  - Google: at least 2 phone screenshots.
  - Apple: 6.7-inch iPhone screenshots (for example 1290×2796).
- Google only: a feature graphic, 1024×500.
- Privacy policy URL: `https://blinksmed.com/privacy-policy`
- Support email and support URL (`https://blinksmed.com/contact-us` is fine).
- A public account-deletion URL, after that page exists.
- Country for the first release: **India** is the sensible start.

### How to describe the product

Category: Health & Fitness or Medical.

Say clearly that BlinksMed is a **marketplace for renting medical equipment**. It does **not** diagnose or treat patients. That wording reduces extra medical-device review.

### Payments

Equipment rental is a physical service. Checkout stays on the existing flow (website / Razorpay). Do **not** add Apple or Google in-app purchases for rentals. Those in-app systems are for digital goods (subscriptions to digital content, coins, and similar).

### Data we must declare (both stores)

Answer the privacy forms honestly. Both apps handle:

- Account data: name, email, phone
- Location: delivery address (customer) or service area (vendor)
- Photos and files: prescriptions (customer); order photos and business documents (vendor)
- Health-related information: prescriptions and medical-equipment orders
- Transmission: over HTTPS to `api.blinksmed.com`
- Deletion: in the app and on the web, once those screens exist

There is no advertising SDK in these apps. Mark ads as **no**.

---

## Android release steps

Do this twice: once in `Prilixor.MobileApp`, once in `Prilixor.VendorMobileApp`. Use a **different keystore file** for each app.

### A. Create the upload key (once per app)

From that app’s folder, in PowerShell:

```powershell
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Save the `.jks` file and the passwords outside the git repository.

### B. Attach that key to the release build

Add a `key.properties` file (not committed) and point `android/app/build.gradle.kts` at it. Today that file still signs release builds with the debug key.

### C. Build the file Google accepts

Google wants an **Android App Bundle** (`.aab`), not an APK.

```powershell
flutter build appbundle --release
```

Output:

`build/app/outputs/bundle/release/app-release.aab`

### D. Upload in Play Console

1. Create the app. Use the package name in the table above. It cannot be changed later.
2. Complete **App content**: privacy policy, ads = no, content rating questionnaire, target audience, data safety.
3. Upload the `.aab` to **Internal testing** first.
4. Install from the Play test link on a real Android phone. Log in against the live API. Check an order, photos, and location.
5. Move to closed testing only if the account type requires it, then to **Production**.
6. When asked, turn on **Play App Signing**. Google holds the final app signing key. We keep only the upload key.

Internal testing is **not** public. Only Production shows the app to everyone.

If Play Console says the Android target version is too old, we raise it and rebuild. The customer project already compiles against API 36.

---

## iPhone release steps

Requires an active Apple Organization account and a Mac with Xcode and Flutter.

### A. Create the apps in App Store Connect

[appstoreconnect.apple.com](https://appstoreconnect.apple.com)

| App | Bundle id |
|---|---|
| BlinksMed | `com.prilixor.prilixorMobile` |
| BlinksMed Vendor | `com.prilixor.vendor` |

### B. Signing in Xcode

Open `ios/Runner.xcworkspace`, select the Runner target, and set **Team** to the company Apple team. Let Xcode manage signing. Bundle ids must match the table above.

### C. Build and upload

```bash
flutter build ipa --release
```

Upload with Xcode (Organizer → Distribute App → App Store Connect) or Apple’s Transporter app.

### D. Finish the listing and submit

1. Screenshots, description, privacy policy, support URL, age rating.
2. **App Privacy**: location, photos, contact info, health-related data.
3. Encryption: the apps use normal HTTPS only. Answer that we do **not** use custom encryption. That avoids extra export paperwork.
4. **App Review Information**: the demo customer login, or the approved vendor login.
5. Submit.

First review is often **1–3 days**. Health-related apps are sometimes slower. A rejection comes back with a written reason. We fix that item and resubmit. Every new upload needs a higher build number in `pubspec.yaml` (`1.0.0+1`, then `1.0.0+2`, and so on). The same build number cannot be uploaded twice.

---

## Recommended order

| Step | Who | What | Depends on |
|---|---|---|---|
| 1 | Leadership | Start **Apple Organization** enrollment (D-U-N-S) and **Google Play** company account | Nothing. Do this first. |
| 2 | Engineering | Release signing, in-app account deletion, public deletion page, vendor iPhone location text, turn off cleartext HTTP | Can start immediately |
| 3 | Operations | Create live reviewer accounts: one customer, one **approved** vendor. Save the passwords for the review forms | Live site |
| 4 | Business | Descriptions, screenshots, 512×512 icon, Google feature graphic, support email | A phone build we can screenshot |
| 5 | Engineering | Android `.aab` → Play **internal testing**. Install both apps on a real phone | Steps 2 and 3 |
| 6 | Engineering | After the Apple account is active, build on a Mac and submit both iPhone apps | Steps 1, 2, 3, 4 |
| 7 | Leadership | Promote Android from testing to **Production** after the test installs work | Step 5 |

Account approval is the long pole. Code fixes can run in parallel with enrollment.

---

## Decisions needed from leadership

1. **Legal entity name** on the Google and Apple accounts (the name users see as the developer).
2. Confirm we enroll Apple as an **Organization** and start the D-U-N-S application now.
3. Confirm Google Play is a **company** account, so we are not forced into the 14-day / 12-tester wait.
4. **Support email** that will be public on both stores.
5. First country: **India only**, or more countries on day one.
6. Who owns the keystore passwords and the Apple/Google logins. These must not live only on one developer’s laptop.

---

## After the apps are public

- Every update is a new build number, a new `.aab` (Android) and a new upload (iPhone), then a short store review.
- Android updates are often live within hours after review. iPhone updates go through App Review again.
- The upload keys and the Apple/Google accounts are company assets. Treat them like production server access.
