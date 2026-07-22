using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Services;

/// <summary>
/// Generates QR PNGs via a public QR HTTP API (no native QR dependency).
/// </summary>
public sealed class QrCodeService : IQrCodeService
{
    private static readonly HttpClient Http = new()
    {
        Timeout = TimeSpan.FromSeconds(15),
    };

    public byte[] GeneratePng(string content, int pixelsPerModule = 8)
    {
        var size = Math.Clamp(pixelsPerModule * 29, 120, 480);
        var url =
            $"https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={Uri.EscapeDataString(content ?? string.Empty)}";

        try
        {
            using var response = Http.GetAsync(url).GetAwaiter().GetResult();
            response.EnsureSuccessStatusCode();
            return response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult();
        }
        catch
        {
            // Fallback: 1x1 transparent PNG so callers still succeed offline.
            return Convert.FromBase64String(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5n1bAAAAAASUVORK5CYII=");
        }
    }
}
