using System.Text;

namespace Prilixor.VendorPortal.Domain.Vendors;

/// <summary>
/// Slug helper for rental icon names. Admin can create any icon (Good, Premium, etc.).
/// </summary>
public static class RentalDurationValueTiers
{
    public const int MaxLength = 32;

    public static string FromName(string? name)
    {
        var source = (name ?? string.Empty).Trim().ToLowerInvariant();
        if (source.Length == 0)
            return "icon";

        var builder = new StringBuilder(source.Length);
        var pendingUnderscore = false;
        foreach (var ch in source)
        {
            if (char.IsLetterOrDigit(ch))
            {
                if (pendingUnderscore && builder.Length > 0)
                    builder.Append('_');
                builder.Append(ch);
                pendingUnderscore = false;
            }
            else
            {
                pendingUnderscore = true;
            }
        }

        var slug = builder.ToString().Trim('_');
        if (slug.Length == 0)
            return "icon";
        if (slug.Length > MaxLength)
            slug = slug[..MaxLength].Trim('_');
        return string.IsNullOrEmpty(slug) ? "icon" : slug;
    }

    public static string Normalize(string? value, string? nameFallback = null)
    {
        if (!string.IsNullOrWhiteSpace(value))
            return FromName(value);
        return FromName(nameFallback);
    }

    public static string DisplayLabel(string? value, string? name = null)
    {
        if (!string.IsNullOrWhiteSpace(name))
            return name.Trim();

        var key = (value ?? string.Empty).Trim().ToLowerInvariant().Replace('-', '_');
        return key switch
        {
            "good" => "Good",
            "better" => "Better",
            "best_value" => "Best Value",
            "maximum_savings" => "Maximum Savings",
            "" => "",
            _ => Humanize(key),
        };
    }

    private static string Humanize(string slug)
    {
        var parts = slug.Split('_', StringSplitOptions.RemoveEmptyEntries);
        for (var i = 0; i < parts.Length; i++)
        {
            var part = parts[i];
            parts[i] = char.ToUpperInvariant(part[0]) + part[1..];
        }
        return string.Join(' ', parts);
    }
}
