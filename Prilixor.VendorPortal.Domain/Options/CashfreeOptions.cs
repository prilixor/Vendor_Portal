namespace Prilixor.VendorPortal.Domain.Options;

public sealed class CashfreeOptions
{
    public const string SectionName = "Cashfree";

    /// <summary>Sandbox or Production Client ID / App ID from Cashfree Secure ID</summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>Client Secret from Cashfree Secure ID</summary>
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>Base URL for verification API (Default: https://sandbox.cashfree.com/verification)</summary>
    public string BaseUrl { get; set; } = "https://sandbox.cashfree.com/verification";

    /// <summary>Whether verification service is active</summary>
    public bool Enabled { get; set; } = true;
}
