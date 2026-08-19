# Prilixor Vendor Mobile

Separate Flutter APK for **vendors** (`com.prilixor.vendor`).  
Does **not** modify the Customer app (`Prilixor.MobileApp`).

## Sync sources (always)

| Source | Use for |
|--------|---------|
| **Vendor Web** `seller-sparkle-ui/.../vendor/` + `vendorNav.ts` | Pages, filters, actions, API flows |
| **Customer Mobile** `Prilixor.MobileApp/` | Search, filter sheets/chips, list/detail UX, auth/theme patterns |

Goal: **all Vendor Portal web pages** on mobile, with Customer-like mobile UX (filters etc.), without breaking Customer or web.

## Run

```bash
cd Prilixor.VendorMobileApp
flutter pub get
flutter run -d web-server --web-port=3001
```

Open [http://localhost:3001](http://localhost:3001). Run Customer web on **3000** in parallel (see `Prilixor.MobileApp/README.md`).

Use a **vendor** account (same as web Vendor portal). Login sends `role: vendor`.

## Production URLs (Web Option 2 parity)

| Use | URL |
|-----|-----|
| API | `https://api.blinksmed.com/api` |
| Portal web (terms / privacy) | `https://vendor.blinksmed.com` |

Defined in `lib/core/config/app_urls.dart` and wired through `ApiClient`.

**API base URL** must be `https://api.blinksmed.com/api` (same as Customer), not `localhost:5001`, unless your local API is running. Rebuild APK/IPA after URL changes.

## Web → Mobile parity

| Web page | Mobile | Status |
|----------|--------|--------|
| Auth (login / register / forgot / verify) | Auth screens | Done |
| Order Requests | Requests tab | Done — refine grouping like web |
| Orders + Detail | Orders tab + detail | Done — search/filter; photo-request upload (max 5) when customer asks |
| Expirations | Home “Due in 7 days” + Orders timer | Done — 7/15/30 + search |
| Notifications | Alerts tab | Done — unread badge, mark read, web deep links |
| Chats (legacy customer↔vendor) | — | Removed — customers chat with Admin; vendors use BlinksMed Support |
| BlinksMed Support | Home FAB (scroll-aware) + Profile badge + onboarding help | Done — Vendor ↔ Admin (AI + tickets) |
| Settings / Profile | Profile → Settings | Done (owner name, phone, password) |
| Pending approval banner | Shell banner | Done |
| Dashboard | Home tab | Done — KPI strip, activity, top listings |
| Onboarding | Profile → Onboarding | Done — profile, docs, bank, submit |
| Service Areas | Profile → Service Areas | Done — CRUD + radius |
| Products | Profile → Products | Done — create, edit, delete, photos |
| Inventory | Profile → Inventory | Done — stock edit, serials, track |
| Working Hours / Availability | — | Skip (disabled on web) |

## Phased delivery

| Phase | Status | Focus |
|-------|--------|--------|
| **0 – Auth** | Done | Welcome, login, register, verify email, forgot, session |
| **1 – Tab shell** | Done | Requests / Orders / Alerts / Profile |
| **2 – Orders ops** | Done | Live requests + orders + detail/status |
| **2b – Filter parity** | Done | Customer search + filter sheet; web status tabs; request grouping |
| **3 – Alerts + Expirations** | Done | Notifications inbox + expirations (7/15/30 + search) |
| **4 – Chat / Settings** | Done | BlinksMed Support (Vendor↔Admin), settings/password, pending banner |
| **5 – Catalog** | Done | Products + inventory (web parity) |
| **6 – Onboarding / areas / dashboard** | Done | Dashboard home + onboarding + service areas |
| **7 – Catalog depth** | Done | Edit/delete listings, photos, equipment stock edit, serial tracking |
| **8 – Alert deep links** | Done | Web-matched notification tap routing (orders, onboarding, products, inventory) |

## Safety

- New project only under `Prilixor.VendorMobileApp`
- Same API base URL as Customer app
- Do not change Customer MobileApp or backend for routine mobile pages
