# Prilixor Customer Mobile

Flutter app for **customers** (`com.prilixor.prilixor_mobile`).

## Production URLs (Web Option 2 parity)

| Use | URL |
|-----|-----|
| API | `https://api.blinksmed.com/api` |
| Portal web (terms / privacy) | `https://blinksmed.com` |

Defined in `lib/core/config/app_urls.dart` and wired through `ApiClient`.

For local API only, temporarily override `ApiClient.baseUrl` to `https://localhost:5001/api` (keep commented in source).

## Run

```bash
cd Prilixor.MobileApp
flutter pub get
flutter run
```

Use a **customer** account. Login sends `role: customer`.

## Rebuild after URL changes

Old installs keep the previous API host until you ship a new APK/IPA.
