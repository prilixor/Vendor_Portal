namespace Prilixor.VendorPortal.Domain.Options;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "Prilixor.VendorPortal";
    public string Audience { get; set; } = "Prilixor.VendorPortal";
    public string SigningKey { get; set; } = string.Empty;
    public int ExpirationMinutes { get; set; } = 60 * 8;
}

