using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Infrastructure.Exceptions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace Prilixor.VendorPortal.Infrastructure.Services;

internal sealed class VendorUploadStorageService(
    IWebHostEnvironment environment,
    IOptions<S3StorageOptions> s3Options,
    IOptions<VendorPortalAssetUrlOptions> assetUrlOptions,
    IAmazonS3? amazonS3) : IVendorUploadStorageService
{
    private const int ThumbnailMaxWidth = 400;
    private const int ThumbnailJpegQuality = 80;

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
        if (string.IsNullOrWhiteSpace(extension) && !string.IsNullOrWhiteSpace(contentType))
        {
            extension = contentType.Trim().ToLowerInvariant() switch
            {
                "application/pdf" => ".pdf",
                "image/png" => ".png",
                "image/jpeg" => ".jpg",
                "image/jpg" => ".jpg",
                "image/webp" => ".webp",
                "image/gif" => ".gif",
                _ => extension
            };
        }
        var storedFileName = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}_{Guid.NewGuid():N}{extension}";
        var localRelativePath = VendorStoragePaths.LocalVendorUploadPath(vendorId, storedFileName, folderType);

        // Buffer once so we can upload original + optional thumbnail.
        await using var sourceMs = new MemoryStream();
        await stream.CopyToAsync(sourceMs, cancellationToken);
        sourceMs.Position = 0;

        byte[]? thumbnailBytes = null;
        string? thumbnailFileName = null;
        if (folderType == VendorFileFolderType.ProductImages && LooksLikeImage(contentType, extension))
        {
            thumbnailBytes = TryCreateThumbnailJpeg(sourceMs);
            sourceMs.Position = 0;
            if (thumbnailBytes is { Length: > 0 })
            {
                thumbnailFileName = $"{Path.GetFileNameWithoutExtension(storedFileName)}_thumb.jpg";
            }
        }

        var opts = s3Options.Value;
        if (amazonS3 is not null && opts.Enabled && !string.IsNullOrWhiteSpace(opts.BucketName))
        {
            try
            {
                var s3RelativeKey = VendorStoragePaths.S3VendorUploadKey(vendorId, storedFileName, folderType);
                var key = VendorStoragePaths.CombineS3Key(opts.KeyPrefix, s3RelativeKey);

                await amazonS3.PutObjectAsync(new PutObjectRequest
                {
                    BucketName = opts.BucketName,
                    Key = key,
                    InputStream = sourceMs,
                    ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
                    ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256
                }, cancellationToken);

                string? thumbRelativeKey = null;
                string? thumbBrowserUrl = null;
                if (thumbnailBytes is not null && thumbnailFileName is not null)
                {
                    thumbRelativeKey = VendorStoragePaths.S3VendorUploadKey(vendorId, thumbnailFileName, folderType);
                    var thumbKey = VendorStoragePaths.CombineS3Key(opts.KeyPrefix, thumbRelativeKey);
                    await using var thumbMs = new MemoryStream(thumbnailBytes);
                    await amazonS3.PutObjectAsync(new PutObjectRequest
                    {
                        BucketName = opts.BucketName,
                        Key = thumbKey,
                        InputStream = thumbMs,
                        ContentType = "image/jpeg",
                        ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256
                    }, cancellationToken);
                    thumbBrowserUrl = CreatePresignedGetUrl(opts.BucketName, thumbKey, opts.PresignedUrlExpiryMinutes);
                }

                var browserUrl = CreatePresignedGetUrl(opts.BucketName, key, opts.PresignedUrlExpiryMinutes);
                return new VendorFilePersistResult(s3RelativeKey, browserUrl, thumbRelativeKey, thumbBrowserUrl);
            }
            catch (Exception ex)
            {
                throw new S3StorageException("S3 upload failed. The file storage service is currently unavailable. Please try again later.", ex);
            }
        }

        var folderName = folderType switch
        {
            VendorFileFolderType.ProductImages => "product-images",
            VendorFileFolderType.ProductDocuments => "product-documents",
            VendorFileFolderType.Support => "support",
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
            await sourceMs.CopyToAsync(fs, cancellationToken);
        }

        var baseUrl = !string.IsNullOrWhiteSpace(assetUrlOptions.Value.PublicApiBaseUrl)
            ? assetUrlOptions.Value.PublicApiBaseUrl.TrimEnd('/')
            : $"{requestPublicBaseUri.Scheme}://{requestPublicBaseUri.Authority}";
        var absoluteUrl = $"{baseUrl}/{localRelativePath}";

        string? thumbLocalRelative = null;
        string? thumbAbsoluteUrl = null;
        if (thumbnailBytes is not null && thumbnailFileName is not null)
        {
            var thumbPath = Path.Combine(uploadsRoot, thumbnailFileName);
            await File.WriteAllBytesAsync(thumbPath, thumbnailBytes, cancellationToken);
            thumbLocalRelative = VendorStoragePaths.LocalVendorUploadPath(vendorId, thumbnailFileName, folderType);
            thumbAbsoluteUrl = $"{baseUrl}/{thumbLocalRelative}";
        }

        return new VendorFilePersistResult(absoluteUrl, absoluteUrl, thumbAbsoluteUrl, thumbAbsoluteUrl);
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
                try
                {
                    var s3RelativeKey = absoluteUri.AbsolutePath.TrimStart('/', '\\').Replace('\\', '/');
                    while (s3RelativeKey.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
                        s3RelativeKey = s3RelativeKey["uploads/".Length..];

                    var key = VendorStoragePaths.CombineS3Key(s3Opts.KeyPrefix, s3RelativeKey);
                    await amazonS3.DeleteObjectAsync(s3Opts.BucketName, key, cancellationToken);
                }
                catch (Exception ex)
                {
                    throw new S3StorageException("S3 deletion failed. The file storage service is currently unavailable. Please try again later.", ex);
                }
            }
            return;
        }

        var opts = s3Options.Value;
        if (amazonS3 is not null && opts.Enabled && !string.IsNullOrWhiteSpace(opts.BucketName))
        {
            try
            {
                var s3RelativeKey = s;
                while (s3RelativeKey.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
                    s3RelativeKey = s3RelativeKey["uploads/".Length..];

                var key = VendorStoragePaths.CombineS3Key(opts.KeyPrefix, s3RelativeKey);
                await amazonS3.DeleteObjectAsync(opts.BucketName, key, cancellationToken);
            }
            catch (Exception ex)
            {
                throw new S3StorageException("S3 deletion failed. The file storage service is currently unavailable. Please try again later.", ex);
            }
            return;
        }

        TryDeleteLocalRelativePath(s);
    }

    private string CreatePresignedGetUrl(string bucketName, string key, int expiryMinutes)
    {
        var clamped = Math.Clamp(expiryMinutes, 1, 10080);
        var urlRequest = new GetPreSignedUrlRequest
        {
            BucketName = bucketName,
            Key = key,
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.AddMinutes(clamped)
        };
        return amazonS3!.GetPreSignedURL(urlRequest);
    }

    private static bool LooksLikeImage(string? contentType, string? extension)
    {
        var ct = (contentType ?? string.Empty).Trim().ToLowerInvariant();
        if (ct.StartsWith("image/", StringComparison.Ordinal))
            return true;
        var ext = (extension ?? string.Empty).Trim().ToLowerInvariant();
        return ext is ".jpg" or ".jpeg" or ".png" or ".webp" or ".gif" or ".bmp";
    }

    private static byte[]? TryCreateThumbnailJpeg(Stream source)
    {
        try
        {
            using var image = Image.Load(source);
            var width = image.Width;
            var height = image.Height;
            if (width <= 0 || height <= 0)
                return null;

            if (width > ThumbnailMaxWidth)
            {
                var newHeight = (int)Math.Round(height * (ThumbnailMaxWidth / (double)width));
                image.Mutate(x => x.Resize(ThumbnailMaxWidth, Math.Max(1, newHeight)));
            }

            using var outMs = new MemoryStream();
            image.Save(outMs, new JpegEncoder { Quality = ThumbnailJpegQuality });
            return outMs.ToArray();
        }
        catch
        {
            // Non-image or corrupt payload — skip thumbnail; original upload still succeeds.
            return null;
        }
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
