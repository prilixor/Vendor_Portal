namespace Prilixor.VendorPortal.Domain.Options;

public sealed class S3StorageOptions
{
    public const string SectionName = "S3Storage";

    /// <summary>When true, uploads go to S3 and DB stores object keys (not public URLs).</summary>
    public bool Enabled { get; set; }

    public string? BucketName { get; set; }

    public string Region { get; set; } = "us-east-1";

    /// <summary>Optional prefix for object keys (no leading/trailing slashes).</summary>
    public string? KeyPrefix { get; set; }

    /// <summary>Lifetime for presigned GET URLs returned to clients.</summary>
    public int PresignedUrlExpiryMinutes { get; set; } = 120;

    /// <summary>Optional explicit credentials; omit to use IAM role or environment credentials.</summary>
    public string? AccessKeyId { get; set; }

    public string? SecretAccessKey { get; set; }

    /// <summary>Session token for temporary AWS credentials (required when using temporary credentials).</summary>
    public string? SessionToken { get; set; }
}
