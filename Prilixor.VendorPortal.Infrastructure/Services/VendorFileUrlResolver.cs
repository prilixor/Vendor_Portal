using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

internal sealed class VendorFileUrlResolver(
    IOptions<S3StorageOptions> s3Options,
    IOptions<VendorPortalAssetUrlOptions> assetUrlOptions,
    IAmazonS3? amazonS3) : IVendorFileUrlResolver
{
    public string Resolve(string storedFileReference)
    {
        if (string.IsNullOrWhiteSpace(storedFileReference))
            return storedFileReference;

        var s = storedFileReference.Trim();
        if (s.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            s.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return s;

        var opts = s3Options.Value;
        if (amazonS3 is not null && opts.Enabled && !string.IsNullOrWhiteSpace(opts.BucketName))
        {
            var key = VendorStoragePaths.CombineS3Key(opts.KeyPrefix, s);
            var expiryMinutes = Math.Clamp(opts.PresignedUrlExpiryMinutes, 1, 10080);
            var request = new GetPreSignedUrlRequest
            {
                BucketName = opts.BucketName,
                Key = key,
                Verb = HttpVerb.GET,
                Expires = DateTime.UtcNow.AddMinutes(expiryMinutes)
            };
            return amazonS3.GetPreSignedURL(request);
        }

        var baseUrl = assetUrlOptions.Value.PublicApiBaseUrl?.TrimEnd('/') ?? string.Empty;
        if (!string.IsNullOrEmpty(baseUrl))
            return $"{baseUrl}/{s.TrimStart('/')}";
        return "/" + s.TrimStart('/');
    }
}
