# SuperAdmin / Admin RBAC bootstrap

## Apply migrations

Run against **admin_portal_db**:

```bash
psql "$ADMIN_PORTAL_CONNECTION" -f Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/058_admin_rbac.sql
psql "$ADMIN_PORTAL_CONNECTION" -f Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/060_customer_impersonation.sql
psql "$ADMIN_PORTAL_CONNECTION" -f Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/061_superadmin_protection.sql
```

Run against **customer_portal_db**:

```bash
psql "$CUSTOMER_PORTAL_CONNECTION" -f Prilixor.VendorPortal.Infrastructure/Database/Scripts/Migrations/059_customer_orders_placed_by_admin.sql
```

## SuperAdmin policy (locked)

- Max **2** active SuperAdmin accounts
- System SuperAdmin users (`is_system_user=true`) are **protected**:
  - Non–SuperAdmin cannot modify them
  - Cannot demote/deactivate the **last** SuperAdmin
  - `super_admin` **role** permissions are always full / immutable
- SuperAdmin **may** update own name, email, and password (`PATCH /api/admin/me`)
- Second SuperAdmin can be created by an existing SuperAdmin until the cap of 2

## Bootstrap first SuperAdmin (recommended)

In `appsettings` or environment:

```json
"BootstrapSuperAdmin": {
  "Enabled": true,
  "Email": "superadmin@yourdomain.com",
  "FullName": "System Super Admin",
  "Password": "set-via-env-not-committed"
}
```

On API startup, if **zero** SuperAdmins exist, the hosted service creates one system SuperAdmin with `MustChangePassword=true`.

Then set `Enabled: false` (or remove password from config).

## Login

Admin UI posts `role: "admin"`. JWT carries:

- `role` = `admin` (portal)
- `admin_role` = DB role code (e.g. `super_admin`)
- `permission` claims for RBAC
- login DTO may include `mustChangePassword`

## Impersonation

### Vendor
1. Vendor detail → **Open as Vendor** (`vendors.impersonate`)
2. One-time code → `/impersonation/consume`
3. Banner → **Exit to Admin**

### Customer
1. Customer detail → **Open as Customer** (`customers.impersonate`)
2. Same exchange flow → customer JWT
3. Banner → **Exit to Admin**
