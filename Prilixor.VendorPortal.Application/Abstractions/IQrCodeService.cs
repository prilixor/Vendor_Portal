namespace Prilixor.VendorPortal.Application.Abstractions;

public interface IQrCodeService
{
    /// <summary>Generate a PNG QR code for the given content.</summary>
    byte[] GeneratePng(string content, int pixelsPerModule = 8);
}
