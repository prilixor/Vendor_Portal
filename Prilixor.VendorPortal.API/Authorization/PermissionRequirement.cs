using Microsoft.AspNetCore.Authorization;

namespace Prilixor.VendorPortal.API.Authorization;

public sealed class PermissionRequirement(string permission) : IAuthorizationRequirement
{
    public string Permission { get; } = permission;
}

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.User.HasClaim(Application.Onboarding.AdminPermissions.ClaimType, requirement.Permission)
            || context.User.HasClaim(Application.Onboarding.AdminPermissions.AdminRoleClaimType, "super_admin")
            || context.User.IsInRole("super_admin"))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
