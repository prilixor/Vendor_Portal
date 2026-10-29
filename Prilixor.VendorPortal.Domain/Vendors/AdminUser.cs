using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class AdminUser : AuditableEntity<Guid>, ISoftDelete
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    /// <summary>10-digit Indian mobile (national digits), optional until set.</summary>
    public string? Phone { get; set; }
    public DateTimeOffset? PhoneVerifiedAt { get; set; }
    /// <summary>Legacy role code string; kept in sync with <see cref="AdminRole.Code"/>.</summary>
    public string Role { get; set; } = string.Empty;
    public Guid? RoleId { get; set; }
    /// <summary>Protected root SuperAdmin (bootstrap / designated). Max 2 system SuperAdmins.</summary>
    public bool IsSystemUser { get; set; }
    public bool MustChangePassword { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? LastLoginAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public AdminRole? AdminRole { get; set; }
    public ICollection<AdminAuditLog> AuditLogs { get; set; } = [];
}
