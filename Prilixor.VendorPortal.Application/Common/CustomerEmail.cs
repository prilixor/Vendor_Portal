namespace Prilixor.VendorPortal.Application.Common;

/// <summary>Normalize customer emails for storage and uniqueness checks.</summary>
public static class CustomerEmail
{
    /// <summary>
    /// Trim, strip wrapping quotes, drop zero-width chars, lowercase.
    /// Returns null when empty after normalization.
    /// </summary>
    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var s = value.Trim();

        // Strip accidental wrapping quotes from copy/paste or tooling.
        while (s.Length >= 2
               && ((s[0] == '\'' && s[^1] == '\'')
                   || (s[0] == '"' && s[^1] == '"')))
        {
            s = s[1..^1].Trim();
        }

        s = s
            .Replace("\u200B", string.Empty, StringComparison.Ordinal)
            .Replace("\uFEFF", string.Empty, StringComparison.Ordinal)
            .Trim()
            .ToLowerInvariant();

        return string.IsNullOrWhiteSpace(s) ? null : s;
    }

    public static bool TryNormalize(string? value, out string normalized)
    {
        normalized = Normalize(value) ?? string.Empty;
        return !string.IsNullOrEmpty(normalized);
    }
}
