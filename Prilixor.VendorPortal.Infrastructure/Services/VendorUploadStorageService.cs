using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

internal sealed class VendorUploadStorageService(
    IWebHostEnvironment environment,
    IOptions<S3StorageOptions> s3Options,
    IOptions<VendorPortalAssetUrlOptions> assetUrlOptions,
    IAmazonS3? amazonS3) : IVendorUploadStorageService
{
    public async Task<VendorFilePersistResult> PersistVendorUploadAsync(
        string vendorId,
        string originalFileName,
        string? contentType,
        Stream stream,
        Uri requestPublicBaseUri,
        CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(originalFileName);
        var storedFileName = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}_{Guid.NewGuid():N}{extension}";
        var relativePath = VendorStoragePaths.RelativeVendorUploadPath(vendorId, storedFileName);

        var opts = s3Options.Value;
        if (amazonS3 is not null && opts.Enabled && !string.IsNullOrWhiteSpace(opts.BucketName))
        {
            var key = VendorStoragePaths.CombineS3Key(opts.KeyPrefix, relativePath);
            await using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, cancellationToken);
            ms.Position = 0;

            await amazonS3.PutObjectAsync(new PutObjectRequest
            {
                BucketName = opts.BucketName,
                Key = key,
                InputStream = ms,
                ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
                ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256
            }, cancellationToken);

            var expiryMinutes = Math.Clamp(opts.PresignedUrlExpiryMinutes, 1, 10080);
            var urlRequest = new GetPreSignedUrlRequest
            {
                BucketName = opts.BucketName,
                Key = key,
                Verb = HttpVerb.GET,
                Expires = DateTime.UtcNow.AddMinutes(expiryMinutes)
            };
            var browserUrl = amazonS3.GetPreSignedURL(urlRequest);
            return new VendorFilePersistResult(relativePath, browserUrl);
        }

        var uploadsRoot = Path.Combine(
            environment.ContentRootPath,
            "wwwroot",
            "uploads",
            "vendors",
            VendorStoragePaths.SanitizeVendorSegment(vendorId));
        Directory.CreateDirectory(uploadsRoot);
        var filePath = Path.Combine(uploadsRoot, storedFileName);

        await using (var fs = File.Create(filePath))
        {
            await stream.CopyToAsync(fs, cancellationToken);
        }

        var baseUrl = !string.IsNullOrWhiteSpace(assetUrlOptions.Value.PublicApiBaseUrl)
            ? assetUrlOptions.Value.PublicApiBaseUrl.TrimEnd('/')
            : $"{requestPublicBaseUri.Scheme}://{requestPublicBaseUri.Authority}";
        var absoluteUrl = $"{baseUrl}/{relativePath}";
        return new VendorFilePersistResult(absoluteUrl, absoluteUrl);
    }

    public async Task DeleteStoredFileAsync(string storedFileReference, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(storedFileReference))
            return;

        var s = storedFileReference.Trim();
        if (s.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            s.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            TryDeleteLegacyLocalFromAbsoluteUrl(s);
            return;
        }

        var opts = s3Options.Value;
        if (amazonS3 is not null && opts.Enabled && !string.IsNullOrWhiteSpace(opts.BucketName))
        {
            var key = VendorStoragePaths.CombineS3Key(opts.KeyPrefix, s);
            await amazonS3.DeleteObjectAsync(opts.BucketName, key, cancellationToken);
            return;
        }

        TryDeleteLocalRelativePath(s);
    }

    private void TryDeleteLocalRelativePath(string relativePath)
    {
        relativePath = relativePath.TrimStart('/', '\\').Replace('\\', '/');
        if (!relativePath.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
            return;

        var wwwrootFull = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "wwwroot"));
        var combined = Path.Combine(environment.ContentRootPath, "wwwroot", relativePath.Replace('/', Path.DirectorySeparatorChar));
        var fullPath = Path.GetFullPath(combined);
        if (!fullPath.StartsWith(wwwrootFull, StringComparison.OrdinalIgnoreCase))
            return;

        if (File.Exists(fullPath))
            File.Delete(fullPath);
    }

    private void TryDeleteLegacyLocalFromAbsoluteUrl(string absoluteUrl)
    {
        if (!Uri.TryCreate(absoluteUrl, UriKind.Absolute, out var uri))
            return;

        var relativeFromUri = uri.AbsolutePath.TrimStart('/');
        TryDeleteLocalRelativePath(relativeFromUri);
    }
}
