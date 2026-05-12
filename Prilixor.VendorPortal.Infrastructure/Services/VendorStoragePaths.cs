using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Infrastructure.Services;

internal static class VendorStoragePaths
{
    internal static string SanitizeVendorSegment(string vendorId) =>
        string.IsNullOrWhiteSpace(vendorId) ? "common" : vendorId.Trim();

    private static string GetFolderName(VendorFileFolderType folderType) => folderType switch
    {
        VendorFileFolderType.Documents => "documents",
        VendorFileFolderType.ProductImages => "product-images",
        VendorFileFolderType.ProductDocuments => "product-documents",
        _ => "documents"
    };

    internal static string LocalVendorUploadPath(string vendorId, string storedFileName, VendorFileFolderType folderType = VendorFileFolderType.Documents)
    {
        var segment = SanitizeVendorSegment(vendorId);
        var folder = GetFolderName(folderType);
        return $"uploads/vendors/{segment}/{folder}/{storedFileName}";
    }

    internal static string S3VendorUploadKey(string vendorId, string storedFileName, VendorFileFolderType folderType = VendorFileFolderType.Documents)
    {
        var segment = SanitizeVendorSegment(vendorId);
        var folder = GetFolderName(folderType);
        return $"vendors/{segment}/{folder}/{storedFileName}";
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
