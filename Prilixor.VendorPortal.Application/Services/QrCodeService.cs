using Prilixor.VendorPortal.Application.Abstractions;
using QRCoder;

namespace Prilixor.VendorPortal.Application.Services;

/// <summary>
/// Generates QR PNGs locally. Falls back to a public QR HTTP API if the local encoder fails.
/// </summary>
public sealed class QrCodeService : IQrCodeService
{
    private static readonly HttpClient Http = new()
    {
        Timeout = TimeSpan.FromSeconds(15),
    };

    public byte[] GeneratePng(string content, int pixelsPerModule = 8)
    {
        var module = Math.Clamp(pixelsPerModule, 4, 20);
        var payload = content ?? string.Empty;

        try
        {
            using var generator = new QRCodeGenerator();
            using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.Q);
            var png = new PngByteQRCode(data);
            // Teal-on-white scans reliably and is less likely to be inverted by dark-mode mail clients.
            return png.GetGraphic(module, [15, 118, 110], [255, 255, 255], drawQuietZones: true);
        }
        catch
        {
            return GenerateViaHttp(payload, module);
        }
    }

    private static byte[] GenerateViaHttp(string content, int pixelsPerModule)
    {
        var size = Math.Clamp(pixelsPerModule * 29, 120, 480);
        var url =
            $"https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&margin=2&data={Uri.EscapeDataString(content)}";

        try
        {
            using var response = Http.GetAsync(url).GetAwaiter().GetResult();
            response.EnsureSuccessStatusCode();
            return response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult();
        }
        catch
        {
            return Convert.FromBase64String(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5n1bAAAAAASUVORK5CYII=");
        }
    }
}
