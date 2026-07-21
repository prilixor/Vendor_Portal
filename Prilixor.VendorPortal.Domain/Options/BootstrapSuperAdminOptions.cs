namespace Prilixor.VendorPortal.Domain.Options;

/// <summary>
/// Optional bootstrap for the first SuperAdmin when none exist.
/// Prefer setting Email/Password via environment variables in production.
/// </summary>
public sealed class BootstrapSuperAdminOptions
{
    public const string SectionName = "BootstrapSuperAdmin";

    /// <summary>When true, create SuperAdmin on startup if fewer than MaxSuperAdmins and no system SuperAdmin exists.</summary>
    public bool Enabled { get; set; }

    public string Email { get; set; } = "superadmin@prilixor.local";
    public string FullName { get; set; } = "System Super Admin";
    /// <summary>Initial password. Leave empty to skip bootstrap. Force change on first login.</summary>
    public string Password { get; set; } = string.Empty;
}

public static class SuperAdminRules
{
    public const string RoleCode = "super_admin";
    public const int MaxSuperAdmins = 2;
}
