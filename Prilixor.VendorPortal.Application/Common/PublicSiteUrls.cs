using System.Net;
using Microsoft.Extensions.Configuration;

namespace Prilixor.VendorPortal.Application.Common;

/// <summary>
/// Public, internet-reachable site URLs for emails, QR payloads, and patient share pages.
/// Local/dev FrontendUrl values (localhost) must never be sent to a doctor's inbox.
/// </summary>
public static class PublicSiteUrls
{
    public const string DefaultCustomerPortal = "https://blinksmed.com";
    public const string SupportEmail = "support@blinksmed.in";

    public static string CustomerPortalBase(IConfiguration configuration)
    {
        var configured = FirstNonEmpty(
            configuration["CustomerPortalUrl"],
            configuration["PublicFrontendUrl"],
            configuration["FrontendUrl"]);
        return ToPublicAbsoluteBase(configured, DefaultCustomerPortal);
    }

    public static string DoctorSharePage(IConfiguration configuration, string uniqueCode) =>
        $"{CustomerPortalBase(configuration)}/dr/{(uniqueCode ?? string.Empty).Trim()}";

    public static string ToPublicAbsoluteBase(string? url, string fallback)
    {
        var candidate = (url ?? string.Empty).Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(candidate) || !IsPubliclyReachable(candidate))
            return fallback.Trim().TrimEnd('/');
        return candidate;
    }

    public static bool IsPubliclyReachable(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return false;
        if (uri.Scheme is not ("http" or "https"))
            return false;

        var host = uri.Host;
        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
            || host is "127.0.0.1" or "::1" or "[::1]"
            || host.EndsWith(".local", StringComparison.OrdinalIgnoreCase))
            return false;

        return !IPAddress.TryParse(host, out var ip) || !IPAddress.IsLoopback(ip);
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));
}
