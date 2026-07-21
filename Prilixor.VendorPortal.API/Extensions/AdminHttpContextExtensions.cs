using System.Security.Claims;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.Extensions;

public static class AdminHttpContextExtensions
{
    /// <summary>
    /// Resolves the acting admin user id from JWT subject. Falls back to body adminUserId for transition only.
    /// </summary>
    public static string? ResolveAdminUserId(this HttpContext httpContext, string? bodyAdminUserId = null)
    {
        var sub = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrWhiteSpace(sub) && Guid.TryParse(sub, out _))
        {
            var role = httpContext.User.FindFirstValue(ClaimTypes.Role);
            if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
            {
                return sub;
            }
        }

        return string.IsNullOrWhiteSpace(bodyAdminUserId) ? null : bodyAdminUserId.Trim();
    }

    public static bool HasAdminPermission(this HttpContext httpContext, string permission) =>
        httpContext.User.HasClaim(AdminPermissions.ClaimType, permission);

    public static string? GetAdminRoleCode(this HttpContext httpContext) =>
        httpContext.User.FindFirstValue(AdminPermissions.AdminRoleClaimType);
}
