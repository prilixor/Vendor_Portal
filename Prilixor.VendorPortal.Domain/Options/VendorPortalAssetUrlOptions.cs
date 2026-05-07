namespace Prilixor.VendorPortal.Domain.Options;

public sealed class VendorPortalAssetUrlOptions
{
    public const string SectionName = "VendorPortalAssetUrls";

    /// <summary>
    /// Public base URL for this API (no trailing slash), used when building absolute URLs for wwwroot uploads.
    /// Set this behind reverse proxies where request Host/scheme differ from the public URL.
    /// </summary>
    public string? PublicApiBaseUrl { get; set; }
}
