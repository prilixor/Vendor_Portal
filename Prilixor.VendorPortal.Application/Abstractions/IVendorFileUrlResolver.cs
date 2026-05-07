namespace Prilixor.VendorPortal.Application.Abstractions;

/// <summary>
/// Maps stored file references from the database to URLs usable by browsers (presigned S3 or absolute API URLs).
/// </summary>
public interface IVendorFileUrlResolver
{
    string Resolve(string storedFileReference);
}
