using Microsoft.AspNetCore.WebUtilities;
using System.Security.Cryptography;

namespace Prilixor.VendorPortal.Application.Services;

public static class VerificationTokenGenerator
{
    public static string GenerateSecureToken(int byteLength = 32)
    {
        var bytes = RandomNumberGenerator.GetBytes(byteLength);
        return WebEncoders.Base64UrlEncode(bytes);
    }
}