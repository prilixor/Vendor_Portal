namespace Prilixor.VendorPortal.Infrastructure.Services;

internal static class VendorStoragePaths
{
    internal static string SanitizeVendorSegment(string vendorId) =>
        string.IsNullOrWhiteSpace(vendorId) ? "common" : vendorId.Trim();

    internal static string RelativeVendorUploadPath(string vendorId, string storedFileName)
    {
        var segment = SanitizeVendorSegment(vendorId);
        return $"uploads/vendors/{segment}/{storedFileName}";
    }

    internal static string CombineS3Key(string? prefix, string relativeKey)
    {
        relativeKey = relativeKey.Trim().TrimStart('/');
        if (string.IsNullOrWhiteSpace(prefix))
            return relativeKey;
        var p = prefix.Trim().Trim('/').Trim('\\');
        return $"{p}/{relativeKey}";
    }
}
