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

public sealed class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public sealed record ChangePasswordResponse(bool Success, string Message, DateTimeOffset UpdatedAt);

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

public sealed class ChangePasswordEndpoint(
    IVendorOnboardingRepository repository,
    IPasswordHasherService passwordHasher)
    : Endpoint<ChangePasswordRequest, Results<Ok<ChangePasswordResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/change-password");
    }

    public override async Task<Results<Ok<ChangePasswordResponse>, ProblemHttpResult>> ExecuteAsync(ChangePasswordRequest req, CancellationToken ct)
    {
        var userIdRaw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var roleRaw = User.FindFirstValue(ClaimTypes.Role);

        if (!Guid.TryParse(userIdRaw, out var userId))
        {
            return TypedResults.Problem(title: "auth.invalid_user", detail: "Invalid authenticated user context.", statusCode: 401);
        }

        if (string.IsNullOrWhiteSpace(req.CurrentPassword) || string.IsNullOrWhiteSpace(req.NewPassword))
        {
            return TypedResults.Problem(title: "auth.invalid_password", detail: "Current and new password are required.", statusCode: 400);
        }

        if (req.NewPassword.Length < 8)
        {
            return TypedResults.Problem(title: "auth.invalid_password", detail: "New password must be at least 8 characters.", statusCode: 400);
        }

        var role = (roleRaw ?? "vendor").Trim().ToLowerInvariant();
        if (role == "admin")
        {
            var admin = await repository.GetAdminUserByIdAsync(userId, ct);
            if (admin is null || admin.IsDeleted || !admin.IsActive)
            {
                return TypedResults.Problem(title: "auth.user_not_found", detail: "Admin user not found.", statusCode: 404);
            }

            if (!passwordHasher.VerifyPassword(req.CurrentPassword, admin.PasswordHash))
            {
                return TypedResults.Problem(title: "auth.invalid_password", detail: "Current password is incorrect.", statusCode: 400);
            }

            admin.PasswordHash = passwordHasher.HashPassword(req.NewPassword);
            await repository.SaveChangesAsync(ct);
            return TypedResults.Ok(new ChangePasswordResponse(true, "Password updated successfully.", DateTimeOffset.UtcNow));
        }

        var vendor = await repository.GetVendorByIdAsync(userId, ct);
        if (vendor is null || vendor.IsDeleted)
        {
            return TypedResults.Problem(title: "auth.user_not_found", detail: "Vendor user not found.", statusCode: 404);
        }

        if (!passwordHasher.VerifyPassword(req.CurrentPassword, vendor.PasswordHash))
        {
            return TypedResults.Problem(title: "auth.invalid_password", detail: "Current password is incorrect.", statusCode: 400);
        }

        vendor.PasswordHash = passwordHasher.HashPassword(req.NewPassword);
        await repository.UpdateVendorAsync(vendor, ct);
        await repository.SaveChangesAsync(ct);
        return TypedResults.Ok(new ChangePasswordResponse(true, "Password updated successfully.", DateTimeOffset.UtcNow));
    }
}

