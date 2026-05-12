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
        CancellationToken cancellationToken,
        VendorFileFolderType folderType = VendorFileFolderType.Documents)
    {
        var extension = Path.GetExtension(originalFileName);
        var storedFileName = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}_{Guid.NewGuid():N}{extension}";
        var localRelativePath = VendorStoragePaths.LocalVendorUploadPath(vendorId, storedFileName, folderType);

        var opts = s3Options.Value;
        if (amazonS3 is not null && opts.Enabled && !string.IsNullOrWhiteSpace(opts.BucketName))
        {
            var key = VendorStoragePaths.CombineS3Key(opts.KeyPrefix, VendorStoragePaths.S3VendorUploadKey(vendorId, storedFileName, folderType));
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
            return new VendorFilePersistResult(localRelativePath, browserUrl);
        }

        var folderName = folderType switch
        {
            VendorFileFolderType.ProductImages => "product-images",
            VendorFileFolderType.ProductDocuments => "product-documents",
            _ => "documents"
        };
        var uploadsRoot = Path.Combine(
            environment.ContentRootPath,
            "wwwroot",
            "uploads",
            "vendors",
            VendorStoragePaths.SanitizeVendorSegment(vendorId),
            folderName);
        Directory.CreateDirectory(uploadsRoot);
        var filePath = Path.Combine(uploadsRoot, storedFileName);

        await using (var fs = File.Create(filePath))
        {
            await stream.CopyToAsync(fs, cancellationToken);
        }

        var baseUrl = !string.IsNullOrWhiteSpace(assetUrlOptions.Value.PublicApiBaseUrl)
            ? assetUrlOptions.Value.PublicApiBaseUrl.TrimEnd('/')
            : $"{requestPublicBaseUri.Scheme}://{requestPublicBaseUri.Authority}";
        var absoluteUrl = $"{baseUrl}/{localRelativePath}";
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
            if (TryDeleteLegacyLocalFromAbsoluteUrl(s))
                return;

            var s3Opts = s3Options.Value;
            if (amazonS3 is not null && s3Opts.Enabled && !string.IsNullOrWhiteSpace(s3Opts.BucketName) &&
                Uri.TryCreate(s, UriKind.Absolute, out var absoluteUri))
            {
                var s3RelativeKey = absoluteUri.AbsolutePath.TrimStart('/', '\\').Replace('\\', '/');
                while (s3RelativeKey.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
                    s3RelativeKey = s3RelativeKey["uploads/".Length..];

                var key = VendorStoragePaths.CombineS3Key(s3Opts.KeyPrefix, s3RelativeKey);
                await amazonS3.DeleteObjectAsync(s3Opts.BucketName, key, cancellationToken);
            }
            return;
        }

        var opts = s3Options.Value;
        if (amazonS3 is not null && opts.Enabled && !string.IsNullOrWhiteSpace(opts.BucketName))
        {
            var s3RelativeKey = s;
            while (s3RelativeKey.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
                s3RelativeKey = s3RelativeKey["uploads/".Length..];

            var key = VendorStoragePaths.CombineS3Key(opts.KeyPrefix, s3RelativeKey);
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

    private bool TryDeleteLegacyLocalFromAbsoluteUrl(string absoluteUrl)
    {
        if (!Uri.TryCreate(absoluteUrl, UriKind.Absolute, out var uri))
            return false;

        var relativeFromUri = uri.AbsolutePath.TrimStart('/');
        var beforeDelete = File.Exists(Path.GetFullPath(Path.Combine(environment.ContentRootPath, "wwwroot", relativeFromUri.Replace('/', Path.DirectorySeparatorChar))));
        TryDeleteLocalRelativePath(relativeFromUri);
        return beforeDelete;
    }
}
