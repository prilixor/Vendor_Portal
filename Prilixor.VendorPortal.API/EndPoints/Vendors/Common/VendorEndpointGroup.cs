using FastEndpoints;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public sealed class VendorOnboardingGroup : Group
{
    public VendorOnboardingGroup()
    {
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
        Configure("admin", ep => { ep.AllowAnonymous(); });
    }
}

public class AdminUserIdRequest
{
    public string AdminUserId { get; set; } = string.Empty;
}
