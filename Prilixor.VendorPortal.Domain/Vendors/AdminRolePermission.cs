namespace Prilixor.VendorPortal.Domain.Vendors;

public class AdminRolePermission
{
    public Guid RoleId { get; set; }
    public Guid PermissionId { get; set; }

    public AdminRole? Role { get; set; }
    public AdminPermission? Permission { get; set; }
}
