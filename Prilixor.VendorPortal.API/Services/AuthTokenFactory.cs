using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.API.Services;

public static class AuthTokenFactory
{
    public static (string AccessToken, List<Claim> Claims) CreateAccessToken(
        JwtOptions jwt,
        string userId,
        string email,
        string portalRole,
        string? adminRoleCode = null,
        IEnumerable<string>? permissions = null,
        IEnumerable<Claim>? extraClaims = null,
        int? expirationMinutesOverride = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, portalRole),
        };

        if (!string.IsNullOrWhiteSpace(adminRoleCode))
            claims.Add(new Claim(AdminPermissions.AdminRoleClaimType, adminRoleCode));

        if (permissions is not null)
        {
            foreach (var p in permissions.Distinct(StringComparer.OrdinalIgnoreCase))
                claims.Add(new Claim(AdminPermissions.ClaimType, p));
        }

        if (extraClaims is not null)
            claims.AddRange(extraClaims);

        var now = DateTime.UtcNow;
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey));
        var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
        var minutes = expirationMinutesOverride ?? jwt.ExpirationMinutes;

        var token = new JwtSecurityToken(
            issuer: jwt.Issuer,
            audience: jwt.Audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(minutes),
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), claims);
    }

    public static string CreateRefreshTokenValue() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
}
