using FastEndpoints;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public sealed class VendorOnboardingGroup : Group
{
    public VendorOnboardingGroup()
    {
        // Most vendor onboarding endpoints remain open for registration; authenticated
        // vendor-scoped routes should call Policies("VendorOnly") individually.
        Configure("vendors", ep => { ep.AllowAnonymous(); });
    }
}

public class VendorIdRequest
{
    public string VendorId { get; set; } = string.Empty;
}

public sealed class AdminApiGroup : Group
{
    public AdminApiGroup()
    {
        Configure("admin", ep =>
        {
            ep.Policies("AdminOnly");
        });
    }
}

public class AdminUserIdRequest
{
    /// <summary>Deprecated: actor is taken from JWT. Kept for request body compatibility.</summary>
    public string AdminUserId { get; set; } = string.Empty;
}
