namespace Prilixor.VendorPortal.Application.Abstractions;

public interface IQrCodeService
{
    /// <summary>Generate a PNG QR code for the given content.</summary>
    byte[] GeneratePng(string content, int pixelsPerModule = 8);

    /// <summary>Branded Doctor Reference Card (same asset Admin downloads and email attaches).</summary>
    byte[] GenerateDoctorReferenceCardPng(
        string fullName,
        string uniqueCode,
        string? specialization,
        string pageUrl);
}
