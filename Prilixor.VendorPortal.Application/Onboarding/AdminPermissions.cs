namespace Prilixor.VendorPortal.Application.Onboarding;

/// <summary>Stable permission codes for Admin RBAC (screens + dangerous actions).</summary>
public static class AdminPermissions
{
    public const string ClaimType = "permission";
    public const string AdminRoleClaimType = "admin_role";

    public const string DashboardView = "dashboard.view";
    public const string NotificationsView = "notifications.view";
    public const string OrdersView = "orders.view";
    public const string OrdersManage = "orders.manage";
    public const string VendorsView = "vendors.view";
    public const string VendorsVerify = "vendors.verify";
    public const string VendorsManage = "vendors.manage";
    public const string VendorsImpersonate = "vendors.impersonate";
    public const string CatalogManage = "catalog.manage";
    public const string AdminsManage = "admins.manage";
    public const string RolesManage = "roles.manage";
    public const string CustomersView = "customers.view";
    public const string CustomersPlaceOrder = "customers.place_order";
    public const string CustomersImpersonate = "customers.impersonate";
    public const string AuditView = "audit.view";
    public const string SupportManage = "support.manage";

    public static readonly IReadOnlyList<(string Code, string Name, string Category, string? Description)> Catalog =
    [
        (DashboardView, "View Dashboard", "Overview", "Access admin dashboard"),
        (NotificationsView, "View Notifications", "Overview", "Access admin notifications"),
        (OrdersView, "View Orders", "Orders", "View all orders"),
        (OrdersManage, "Manage Orders", "Orders", "Update status, reassign, cancel/refund, extensions"),
        (VendorsView, "View Vendors", "Vendors", "List and view vendor details"),
        (VendorsVerify, "Verify Vendors", "Vendors", "Verification queue, approve/reject documents"),
        (VendorsManage, "Manage Vendors", "Vendors", "Suspend, ban, reactivate, force reset password"),
        (VendorsImpersonate, "Impersonate Vendor", "Vendors", "Open Vendor Portal as a vendor"),
        (CatalogManage, "Manage Catalog", "Catalog", "Products and chemicals management"),
        (AdminsManage, "Manage Admin Users", "System", "Create and manage admin accounts"),
        (RolesManage, "Manage Roles", "System", "Create roles and assign permissions"),
        (CustomersView, "View Customers", "Customers", "Customer directory"),
        (CustomersPlaceOrder, "Place Order for Customer", "Customers", "Create orders on behalf of customers"),
        (CustomersImpersonate, "Impersonate Customer", "Customers", "Open Customer Portal as a customer"),
        (AuditView, "View Audit Logs", "System", "Read admin audit logs"),
        (SupportManage, "Manage Support", "System", "Admin support tickets"),
    ];

    public static readonly IReadOnlyList<string> AllCodes = Catalog.Select(x => x.Code).ToArray();

    public static readonly IReadOnlyDictionary<string, string[]> SystemRolePermissions = new Dictionary<string, string[]>
    {
        ["super_admin"] = AllCodes.ToArray(),
        ["verifier"] =
        [
            DashboardView, NotificationsView, VendorsView, VendorsVerify, AuditView
        ],
        ["operations_admin"] =
        [
            DashboardView, NotificationsView, OrdersView, OrdersManage, VendorsView,
            CustomersView, CustomersPlaceOrder, CustomersImpersonate, SupportManage, AuditView
        ],
    };
}
