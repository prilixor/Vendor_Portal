namespace Prilixor.VendorPortal.Infrastructure.Exceptions;

/// <summary>
/// Thrown when an S3 storage operation fails (upload, delete, etc).
/// The API should return this as a 503 or 400 error response, not a 500.
/// </summary>
public sealed class S3StorageException : Exception
{
    public S3StorageException(string message) : base(message) { }

    public S3StorageException(string message, Exception innerException)
        : base(message, innerException) { }
}
