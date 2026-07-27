# RDP manual deploy — fresh databases + SuperAdmin (step by step)

Use this when you publish on your PC, then copy folders to the RDP server (IIS + local PostgreSQL).

**Warning:** Steps 4–5 **delete all data** in the four portal databases. Only continue if that is intentional.

---

## Overview

| Step | Where | What |
|------|--------|------|
| 1 | Your PC | Publish API + build UI (as usual) |
| 2 | Your PC | Copy DB setup pack (scripts + SQL) |
| 3 | RDP | Copy API/UI into IIS folders (as usual) |
| 4 | RDP | Stop API / app pool |
| 5 | RDP | Run fresh DB script (`psql`) |
| 6 | RDP | Enable `BootstrapSuperAdmin` on deployed API |
| 7 | RDP | Start API once → SuperAdmin created |
| 8 | RDP | Disable bootstrap; restart API |
| 9 | Browser | Login Admin UI; change password |

---

## Step 1 — Publish on your PC (same as always)

```powershell
# Example — adjust paths/projects to your usual commands
cd D:\Prilixor\Vendor_Portal\Prilixor.VendorPortal
dotnet publish Prilixor.VendorPortal.API\Prilixor.VendorPortal.API.csproj -c Release -o C:\Deploy\publish_api
# Build / export Admin + Vendor + Customer UIs the way you normally do
```

---

## Step 2 — Prepare the DB setup pack on your PC

Copy these from the repo into a folder you will take to RDP, e.g. `C:\Deploy\db-setup\`:

```text
db-setup\
  scripts\
    setup-fresh-databases.ps1
  Prilixor.VendorPortal.Infrastructure\
    Database\
      Scripts\
        Schema\          (master_fresh_setup.sql + 040–055 needed files)
        Migrations\      (026 + 055–061)
```

Minimum required tree (keep folder names exactly):

- `scripts\setup-fresh-databases.ps1`
- `Prilixor.VendorPortal.Infrastructure\Database\Scripts\Schema\` (at least `master_fresh_setup.sql`, `040`–`055` used by master)
- `Prilixor.VendorPortal.Infrastructure\Database\Scripts\Migrations\` (at least `026`, `055`–`061`)

Easiest: copy entire `Schema\` and `Migrations\` folders. You do **not** need legacy `001`–`034` for this path.

`master_fresh_setup.sql` covers full flows: catalog, orders, chat, medical, chemicals (common+vendor), variants/inventory, assets, favorites, refresh tokens, Admin RBAC.
---

## Step 3 — Copy to RDP (manual)

On the RDP machine:

1. Copy published API into your IIS API folder (e.g. `C:\inetpub\wwwroot\prilixor-root\api`), or use `deploy-api.ps1` if you use that.
2. Copy UI builds into their IIS sites (admin / vendor / customer) as usual.
3. Copy `db-setup` to e.g. `C:\Deploy\db-setup\` on the RDP.

Confirm Production connection strings in the **deployed** API `appsettings.Production.json` still point at:

- `admin_portal_db`
- `common_portal_db`
- `vendor_portal_db`
- `customer_portal_db`

---

## Step 4 — Stop the API on RDP

In IIS Manager (or PowerShell):

```powershell
Import-Module WebAdministration
Stop-WebAppPool -Name "DefaultAppPool"   # use your real app pool name
```

Also close pgAdmin / any open `psql` sessions on those databases.

---

## Step 5 — Recreate fresh databases on RDP

Requirements on RDP:

- PostgreSQL installed
- `psql` on PATH (open a new PowerShell and run `psql --version`)

```powershell
cd C:\Deploy\db-setup
.\scripts\setup-fresh-databases.ps1 `
  -PgHost localhost `
  -Port 5432 `
  -User postgres `
  -Password 'YOUR_PROD_POSTGRES_PASSWORD'
```

Use the same Postgres password as in Production connection strings.

Success looks like: `Fresh databases applied successfully.` and SQL echoes ending with RBAC applied.

This does **not** create the SuperAdmin **user** yet — only schemas + `super_admin` **role**.

---

## Step 6 — Enable SuperAdmin bootstrap on the deployed API

Edit the **live** file on RDP, e.g.:

`C:\inetpub\wwwroot\prilixor-root\api\appsettings.Production.json`

Set (use your real email / name / temporary password, min 8 characters):

```json
"BootstrapSuperAdmin": {
  "Enabled": true,
  "Email": "you@yourdomain.com",
  "FullName": "Your Full Name",
  "Password": "TempPasswordAtLeast8"
}
```

Prefer setting these via environment variables on the IIS app pool instead of leaving the password in the file long-term:

```text
BootstrapSuperAdmin__Enabled=true
BootstrapSuperAdmin__Email=you@yourdomain.com
BootstrapSuperAdmin__FullName=Your Full Name
BootstrapSuperAdmin__Password=TempPasswordAtLeast8
```

---

## Step 7 — Start API once (creates SuperAdmin)

```powershell
Start-WebAppPool -Name "DefaultAppPool"
```

Check API / IIS stdout or your log folder for:

`BootstrapSuperAdmin created you@yourdomain.com`

If you see `skipped; N SuperAdmin(s) already exist`, a SuperAdmin row is already present.

If you see `super_admin role not found`, Step 5 did not finish — re-run the DB script.

---

## Step 8 — Disable bootstrap immediately

In the same `appsettings.Production.json` (or env):

```json
"BootstrapSuperAdmin": {
  "Enabled": false,
  "Email": "you@yourdomain.com",
  "FullName": "Your Full Name",
  "Password": ""
}
```

Recycle the app pool again:

```powershell
Restart-WebAppPool -Name "DefaultAppPool"
```

---

## Step 9 — Login

1. Open Admin UI (`https://admin.blinksmed.com` or your URL).
2. Login with the bootstrap email/password and role **admin**.
3. Change password when prompted (`MustChangePassword`).

---

## If you do NOT want to wipe data

Skip Steps 4–5 wipe. Instead, on RDP apply only RBAC migrations with `psql` against existing DBs (see [SUPERADMIN_RBAC.md](./SUPERADMIN_RBAC.md) — “Apply migrations (existing DBs only)”), then do Steps 6–9.

---

## Checklist

- [ ] API published and copied to IIS
- [ ] UI copied to IIS
- [ ] `db-setup` folder on RDP with scripts + SQL
- [ ] App pool stopped
- [ ] `setup-fresh-databases.ps1` succeeded
- [ ] Bootstrap enabled with real email/password
- [ ] App pool started; log shows SuperAdmin created
- [ ] Bootstrap disabled; password cleared
- [ ] Logged in and changed password
