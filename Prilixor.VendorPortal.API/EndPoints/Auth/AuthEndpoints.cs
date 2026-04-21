using FastEndpoints;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.IdentityModel.Tokens;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Infrastructure.Persistence;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Prilixor.VendorPortal.API.EndPoints.Auth;

public sealed class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "vendor"; // vendor | admin
}

public sealed record AuthUserDto(string Id, string Email, string Name, string Role);

public sealed record LoginResponse(string Token, AuthUserDto User);

public sealed class LoginEndpoint(
    IConfiguration configuration,
    IVendorOnboardingRepository repository,
    IPasswordHasherService passwordHasher)
    : Endpoint<LoginRequest, Results<Ok<LoginResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/login");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<LoginResponse>, ProblemHttpResult>> ExecuteAsync(LoginRequest req, CancellationToken ct)
    {
        var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();
        var role = (req.Role ?? "vendor").Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(req.Password))
        {
            return TypedResults.Problem(title: "auth.invalid_credentials", detail: "Email and password are required.", statusCode: 400);
        }

        if (role != "vendor" && role != "admin")
        {
            return TypedResults.Problem(title: "auth.invalid_role", detail: "Role must be 'vendor' or 'admin'.", statusCode: 400);
        }

        string userId;
        string name;

        if (role == "admin")
        {
            var admin = await repository.GetAdminUserByEmailAsync(email, ct);
            if (admin is null || admin.IsDeleted || !admin.IsActive || !passwordHasher.VerifyPassword(req.Password, admin.PasswordHash))
            {
                return TypedResults.Problem(title: "auth.invalid_credentials", detail: "Invalid email or password.", statusCode: 401);
            }

            userId = admin.Id.ToString();
            name = admin.FullName;
        }
        else
        {
            var vendor = await repository.GetVendorByEmailAsync(email, ct);
            if (vendor is null || vendor.IsDeleted || !passwordHasher.VerifyPassword(req.Password, vendor.PasswordHash))
            {
                return TypedResults.Problem(title: "auth.invalid_credentials", detail: "Invalid email or password.", statusCode: 401);
            }

            userId = vendor.Id.ToString();
            var profile = await repository.GetVendorProfileAsync(vendor.Id, ct);
            name = profile?.OwnerName ?? email;
        }

        var jwt = configuration.GetSection("JwtOptions").Get<JwtOptions>() ?? new JwtOptions();
        if (string.IsNullOrWhiteSpace(jwt.SigningKey))
        {
            return TypedResults.Problem(title: "auth.misconfigured", detail: "JWT signing key is not configured.", statusCode: 500);
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role),
        };

        var now = DateTime.UtcNow;
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey));
        var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwt.Issuer,
            audience: jwt.Audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(jwt.ExpirationMinutes),
            signingCredentials: creds);

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

        return TypedResults.Ok(new LoginResponse(tokenString, new AuthUserDto(userId, email, name, role)));
    }
}

