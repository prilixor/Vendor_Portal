namespace Prilixor.VendorPortal.Application.Abstractions;

public enum VendorFileFolderType
{
    Documents,
    ProductImages,
    ProductDocuments,
    Support
}

public sealed record VendorFilePersistResult(
    /// <summary>Value persisted in DB: absolute URL for local disk mode, or S3 object key path for S3 mode.</summary>
    string StoredReference,
    /// <summary>URL safe to open in a browser immediately after upload.</summary>
    string BrowserAccessibleUrl,
    /// <summary>Optional thumbnail stored reference (same rules as StoredReference).</summary>
    string? ThumbnailStoredReference = null,
    /// <summary>Optional thumbnail browser URL right after upload.</summary>
    string? ThumbnailBrowserAccessibleUrl = null);

public interface IVendorUploadStorageService
{
    Task<VendorFilePersistResult> PersistVendorUploadAsync(
        string vendorId,
        string originalFileName,
        string? contentType,
        Stream stream,
        Uri requestPublicBaseUri,
        CancellationToken cancellationToken,
        VendorFileFolderType folderType = VendorFileFolderType.Documents);

    Task DeleteStoredFileAsync(string storedFileReference, CancellationToken cancellationToken);

    /// <summary>
    /// For existing originals (Prod backfill): download, create thumb if worthwhile, store beside original.
    /// Returns thumbnail stored reference, or null when skipped/failed.
    /// </summary>
    Task<string?> CreateThumbnailForExistingImageAsync(string storedImageReference, CancellationToken cancellationToken);
}
