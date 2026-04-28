using FastEndpoints;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.IdentityModel.Tokens;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Auth;
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
    public string Email { get; set; } = string.Empty;
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public sealed record ChangePasswordResponse(bool Success, string Message, DateTimeOffset UpdatedAt);

public sealed class ForgotPasswordRequest
{
    public string Email { get; set; } = string.Empty;
}

public sealed record ForgotPasswordResponse(bool Success, string Message);

public sealed class ResetPasswordRequest
{
    public string Token { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
    public string ConfirmPassword { get; set; } = string.Empty;
}

public sealed record ResetPasswordResponse(bool Success, string Message);

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

        if (role != "vendor" && role != "admin" && role != "super_admin" && role != "verifier" && role != "operations_admin")
        {
            return TypedResults.Problem(title: "auth.invalid_role", detail: "Role must be 'vendor', 'admin', 'super_admin', 'verifier', or 'operations_admin'.", statusCode: 400);
        }

        string userId;
        string name;

        if (role == "admin" || role == "super_admin" || role == "verifier" || role == "operations_admin")
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
        AllowAnonymous();
    }

    public override async Task<Results<Ok<ChangePasswordResponse>, ProblemHttpResult>> ExecuteAsync(ChangePasswordRequest req, CancellationToken ct)
    {
        var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(req.CurrentPassword) || string.IsNullOrWhiteSpace(req.NewPassword))
        {
            return TypedResults.Problem(title: "auth.invalid_input", detail: "Email, current password, and new password are required.", statusCode: 400);
        }

        if (req.NewPassword.Length < 8)
        {
            return TypedResults.Problem(title: "auth.invalid_password", detail: "New password must be at least 8 characters.", statusCode: 400);
        }

        // Try admin first
        var admin = await repository.GetAdminUserByEmailAsync(email, ct);
        if (admin != null && !admin.IsDeleted && admin.IsActive)
        {
            if (!passwordHasher.VerifyPassword(req.CurrentPassword, admin.PasswordHash))
            {
                return TypedResults.Problem(title: "auth.invalid_password", detail: "Current password is incorrect.", statusCode: 400);
            }

            admin.PasswordHash = passwordHasher.HashPassword(req.NewPassword);
            await repository.SaveChangesAsync(ct);
            return TypedResults.Ok(new ChangePasswordResponse(true, "Password updated successfully.", DateTimeOffset.UtcNow));
        }

        // Try vendor
        var vendor = await repository.GetVendorByEmailAsync(email, ct);
        if (vendor is null || vendor.IsDeleted)
        {
            return TypedResults.Problem(title: "auth.user_not_found", detail: "User not found.", statusCode: 404);
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

public sealed class ForgotPasswordEndpoint(
    IVendorOnboardingRepository repository,
    IEmailService emailService)
    : Endpoint<ForgotPasswordRequest, Results<Ok<ForgotPasswordResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/forgot-password");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<ForgotPasswordResponse>, ProblemHttpResult>> ExecuteAsync(ForgotPasswordRequest req, CancellationToken ct)
    {
        var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(email))
        {
            return TypedResults.Problem(title: "auth.invalid_email", detail: "Email is required.", statusCode: 400);
        }

        // Check if email exists in vendors or admin_users
        var vendor = await repository.GetVendorByEmailAsync(email, ct);
        var admin = await repository.GetAdminUserByEmailAsync(email, ct);

        if (vendor != null || admin != null)
        {
            // Generate secure token
            var token = Guid.NewGuid().ToString();
            var resetToken = new PasswordResetToken
            {
                Id = Guid.NewGuid(),
                Email = email,
                Token = token,
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(15),
                IsUsed = false,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await repository.AddPasswordResetTokenAsync(resetToken, ct);
            await repository.SaveChangesAsync(ct);

            // Send reset link email
            var resetLink = $"http://localhost:5173/reset-password?token={token}";
            var subject = "Reset Your Password";
            var body = $@"
                <h2>Password Reset Request</h2>
                <p>You requested a password reset for your account.</p>
                <p>Click the link below to reset your password:</p>
                <p><a href='{resetLink}'>Reset Password</a></p>
                <p>This link will expire in 15 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            ";

            try
            {
                await emailService.SendEmailAsync(email, subject, body, ct);
            }
            catch
            {
                // Log error but don't fail the request
            }
        }

        // Always return success (don't reveal if email exists)
        return TypedResults.Ok(new ForgotPasswordResponse(true, "If the email exists, a reset link has been sent."));
    }
}

public sealed class ResetPasswordEndpoint(
    IVendorOnboardingRepository repository,
    IPasswordHasherService passwordHasher)
    : Endpoint<ResetPasswordRequest, Results<Ok<ResetPasswordResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/reset-password");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<ResetPasswordResponse>, ProblemHttpResult>> ExecuteAsync(ResetPasswordRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Token))
        {
            return TypedResults.Problem(title: "auth.invalid_token", detail: "Token is required.", statusCode: 400);
        }

        if (string.IsNullOrWhiteSpace(req.NewPassword) || string.IsNullOrWhiteSpace(req.ConfirmPassword))
        {
            return TypedResults.Problem(title: "auth.invalid_password", detail: "New password and confirm password are required.", statusCode: 400);
        }

        if (req.NewPassword.Length < 8)
        {
            return TypedResults.Problem(title: "auth.invalid_password", detail: "Password must be at least 8 characters.", statusCode: 400);
        }

        if (req.NewPassword != req.ConfirmPassword)
        {
            return TypedResults.Problem(title: "auth.password_mismatch", detail: "Passwords do not match.", statusCode: 400);
        }

        // Validate token
        var resetToken = await repository.GetPasswordResetTokenAsync(req.Token, ct);
        if (resetToken == null)
        {
            return TypedResults.Problem(title: "auth.invalid_token", detail: "Invalid or expired token.", statusCode: 400);
        }

        if (resetToken.IsUsed)
        {
            return TypedResults.Problem(title: "auth.token_used", detail: "This token has already been used.", statusCode: 400);
        }

        if (resetToken.ExpiresAt < DateTimeOffset.UtcNow)
        {
            return TypedResults.Problem(title: "auth.token_expired", detail: "Token has expired.", statusCode: 400);
        }

        // Find user by email
        var vendor = await repository.GetVendorByEmailAsync(resetToken.Email, ct);
        var admin = await repository.GetAdminUserByEmailAsync(resetToken.Email, ct);

        if (vendor != null)
        {
            vendor.PasswordHash = passwordHasher.HashPassword(req.NewPassword);
            await repository.UpdateVendorAsync(vendor, ct);
        }
        else if (admin != null)
        {
            if (admin.IsDeleted || !admin.IsActive)
            {
                return TypedResults.Problem(title: "auth.user_not_found", detail: "User not found or inactive.", statusCode: 404);
            }
            admin.PasswordHash = passwordHasher.HashPassword(req.NewPassword);
            await repository.SaveChangesAsync(ct);
        }
        else
        {
            return TypedResults.Problem(title: "auth.user_not_found", detail: "User not found.", statusCode: 404);
        }

        // Mark token as used
        await repository.MarkPasswordResetTokenAsUsedAsync(req.Token, ct);
        await repository.SaveChangesAsync(ct);

        return TypedResults.Ok(new ResetPasswordResponse(true, "Password reset successfully."));
    }
}
