namespace Prilixor.VendorPortal.Application.Abstractions;

public sealed record VendorFilePersistResult(
    /// <summary>Value persisted in DB: absolute URL for local disk mode, or S3 object key path for S3 mode.</summary>
    string StoredReference,
    /// <summary>URL safe to open in a browser immediately after upload.</summary>
    string BrowserAccessibleUrl);

public interface IVendorUploadStorageService
{
    Task<VendorFilePersistResult> PersistVendorUploadAsync(
        string vendorId,
        string originalFileName,
        string? contentType,
        Stream stream,
        Uri requestPublicBaseUri,
        CancellationToken cancellationToken);

    Task DeleteStoredFileAsync(string storedFileReference, CancellationToken cancellationToken);
}
