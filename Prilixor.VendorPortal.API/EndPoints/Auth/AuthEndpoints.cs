using System.Collections.Concurrent;
using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.API.Services;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Common;
using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Application.Services;
using Prilixor.VendorPortal.Domain.Auth;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;
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

public sealed record AuthUserDto(
    string Id,
    string Email,
    string Name,
    string Role,
    string? AdminRole = null,
    IReadOnlyList<string>? Permissions = null,
    bool MustChangePassword = false);

public sealed record LoginResponse(string Token, string RefreshToken, AuthUserDto User);

public sealed class VerifyEmailRequest
{
    public string Token { get; set; } = string.Empty;
}

public sealed record VerifyEmailResponse(bool Success, string Message);

public sealed class ResendVerificationRequest
{
    public string Email { get; set; } = string.Empty;
    /// <summary>Optional: customer | vendor — when omitted, tries customer then vendor.</summary>
    public string? Role { get; set; }
}

public sealed record ResendVerificationResponse(bool Success, string Message);

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
    /// <summary>Optional: customer | vendor | admin — preserved on the email reset link for UI branding.</summary>
    public string? Portal { get; set; }
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
    ICustomerRepository customerRepository,
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
        var identifier = (req.Email ?? string.Empty).Trim();
        var email = identifier.ToLowerInvariant();
        var role = (req.Role ?? "vendor").Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(req.Password))
        {
            return TypedResults.Problem(title: "auth.invalid_credentials", detail: "Email and password are required.", statusCode: 400);
        }

        if (role != "vendor" && role != "customer" && role != "admin" && role != "super_admin" && role != "verifier" && role != "operations_admin")
        {
            return TypedResults.Problem(title: "auth.invalid_role", detail: "Role must be 'vendor', 'customer', 'admin', 'super_admin', 'verifier', or 'operations_admin'.", statusCode: 400);
        }

        string userId;
        string name;
        string portalRole = role;
        string? adminRoleCode = null;
        IReadOnlyList<string>? permissions = null;
        var mustChangePassword = false;

        if (role == "admin" || role == "super_admin" || role == "verifier" || role == "operations_admin")
        {
            var admin = await repository.GetAdminUserByEmailAsync(email, ct);
            if (admin is null || admin.IsDeleted || !admin.IsActive || !passwordHasher.VerifyPassword(req.Password, admin.PasswordHash))
            {
                return TypedResults.Problem(title: "auth.invalid_credentials", detail: "Invalid email or password.", statusCode: 401);
            }

            userId = admin.Id.ToString();
            name = admin.FullName;
            portalRole = "admin";
            adminRoleCode = admin.AdminRole?.Code ?? admin.Role;
            permissions = await repository.GetAdminPermissionCodesAsync(admin.Id, ct);
            // Fallback if RBAC tables not yet migrated
            if (permissions.Count == 0 && AdminPermissions.SystemRolePermissions.TryGetValue(adminRoleCode, out var seeded))
                permissions = seeded;
            mustChangePassword = admin.MustChangePassword;

            admin.LastLoginAt = DateTimeOffset.UtcNow;
            await repository.UpdateAdminUserAsync(admin, ct);
        }
        else if (role == "customer")
        {
            Customer? customer;
            if (identifier.Contains('@'))
            {
                customer = await customerRepository.GetCustomerByEmailAsync(email, ct);
            }
            else if (IndianMobilePhone.TryNormalize(identifier, out var phoneDigits))
            {
                customer = await customerRepository.GetCustomerByPhoneAsync(phoneDigits, ct);
            }
            else
            {
                customer = null;
            }

            if (customer is null || customer.IsDeleted || !passwordHasher.VerifyPassword(req.Password, customer.PasswordHash))
            {
                return TypedResults.Problem(title: "auth.invalid_credentials", detail: "Invalid email/phone or password.", statusCode: 401);
            }

            // Email-only accounts must verify before login/app access.
            if (!string.IsNullOrWhiteSpace(customer.Email) && !customer.IsEmailVerified)
            {
                return TypedResults.Problem(title: "EMAIL_NOT_VERIFIED", detail: "Please verify your email before logging in.", statusCode: 403);
            }

            userId = customer.Id.ToString();
            name = !string.IsNullOrWhiteSpace(customer.FullName)
                ? customer.FullName
                : (customer.Email ?? customer.Phone ?? "Customer");
            email = customer.Email ?? customer.Phone ?? string.Empty;
            customer.LastLoginAt = DateTimeOffset.UtcNow;
            await customerRepository.UpdateCustomerAsync(customer, ct);
            await customerRepository.SaveChangesAsync(ct);
        }
        else
        {
            Vendor? vendor;
            if (identifier.Contains('@'))
            {
                vendor = await repository.GetVendorByEmailAsync(identifier, ct);
            }
            else
            {
                vendor = await repository.GetVendorByPhoneAsync(identifier, ct);
            }

            if (vendor is null || vendor.IsDeleted || !passwordHasher.VerifyPassword(req.Password, vendor.PasswordHash))
            {
                return TypedResults.Problem(title: "auth.invalid_credentials", detail: "Invalid email/phone or password.", statusCode: 401);
            }

            if (!vendor.IsEmailVerified)
            {
                return TypedResults.Problem(title: "EMAIL_NOT_VERIFIED", detail: "Please verify your email before logging in.", statusCode: 403);
            }

            userId = vendor.Id.ToString();
            var profile = await repository.GetVendorProfileAsync(vendor.Id, ct);
            name = profile?.OwnerName ?? vendor.Email;
            email = vendor.Email;
        }

        var jwt = configuration.GetSection("JwtOptions").Get<JwtOptions>() ?? new JwtOptions();
        if (string.IsNullOrWhiteSpace(jwt.SigningKey))
        {
            return TypedResults.Problem(title: "auth.misconfigured", detail: "JWT signing key is not configured.", statusCode: 500);
        }

        var (tokenString, _) = AuthTokenFactory.CreateAccessToken(
            jwt, userId, email, portalRole, adminRoleCode, permissions);

        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = AuthTokenFactory.CreateRefreshTokenValue(),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
            IsRevoked = false,
            CreatedAt = DateTimeOffset.UtcNow
        };

        await repository.AddRefreshTokenAsync(refreshToken, ct);
        await repository.SaveChangesAsync(ct);

        return TypedResults.Ok(new LoginResponse(
            tokenString,
            refreshToken.Token,
            new AuthUserDto(userId, email, name, portalRole, adminRoleCode, permissions, mustChangePassword)));
    }
}

public sealed class VerifyEmailEndpoint(
    IVendorOnboardingRepository repository,
    ICustomerRepository customerRepository)
    : Endpoint<VerifyEmailRequest, Results<Ok<VerifyEmailResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("auth/verify-email");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<VerifyEmailResponse>, ProblemHttpResult>> ExecuteAsync(VerifyEmailRequest req, CancellationToken ct)
    {
        var token = (req.Token ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(token))
        {
            return TypedResults.Problem(title: "auth.invalid_token", detail: "Token is required.", statusCode: 400);
        }

        var vendor = await repository.GetVendorByEmailVerificationTokenAsync(token, ct);
        if (vendor is not null)
        {
            if (vendor.VerificationTokenExpiryUtc is null || vendor.VerificationTokenExpiryUtc < DateTimeOffset.UtcNow)
            {
                return TypedResults.Problem(title: "auth.token_expired", detail: "Verification link has expired.", statusCode: 400);
            }

            vendor.IsEmailVerified = true;
            vendor.EmailVerificationToken = null;
            vendor.VerificationTokenExpiryUtc = null;
            await repository.UpdateVendorAsync(vendor, ct);
            await repository.SaveChangesAsync(ct);
            return TypedResults.Ok(new VerifyEmailResponse(true, "Email verified successfully."));
        }

        var customer = await customerRepository.GetCustomerByEmailVerificationTokenAsync(token, ct);
        if (customer is null)
        {
            return TypedResults.Problem(title: "auth.invalid_token", detail: "Invalid verification token.", statusCode: 400);
        }

        if (customer.EmailVerificationTokenExpiresAt is null || customer.EmailVerificationTokenExpiresAt < DateTimeOffset.UtcNow)
        {
            return TypedResults.Problem(title: "auth.token_expired", detail: "Verification link has expired.", statusCode: 400);
        }

        customer.IsEmailVerified = true;
        customer.EmailVerificationToken = null;
        customer.EmailVerificationTokenExpiresAt = null;
        await customerRepository.UpdateCustomerAsync(customer, ct);
        await customerRepository.SaveChangesAsync(ct);

        return TypedResults.Ok(new VerifyEmailResponse(true, "Email verified successfully."));
    }
}

public sealed class ResendVerificationEndpoint(
    IConfiguration configuration,
    IVendorOnboardingRepository repository,
    ICustomerRepository customerRepository,
    IEmailService emailService,
    ILogger<ResendVerificationEndpoint> logger)
    : Endpoint<ResendVerificationRequest, Results<Ok<ResendVerificationResponse>, ProblemHttpResult>>
{
    private static readonly ConcurrentDictionary<string, DateTimeOffset> LastSent = new();

    public override void Configure()
    {
        Post("auth/resend-verification");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<ResendVerificationResponse>, ProblemHttpResult>> ExecuteAsync(ResendVerificationRequest req, CancellationToken ct)
    {
        var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
        {
            return TypedResults.Problem(title: "auth.invalid_email", detail: "Email is required.", statusCode: 400);
        }

        if (LastSent.TryGetValue(email, out var lastSentAt) && lastSentAt.AddMinutes(1) > DateTimeOffset.UtcNow)
        {
            return TypedResults.Problem(title: "auth.resend_cooldown", detail: "Please wait a minute before requesting another verification email.", statusCode: 429);
        }

        var role = (req.Role ?? string.Empty).Trim().ToLowerInvariant();
        var preferCustomer = role is "customer" or "";
        var preferVendor = role is "vendor" or "";

        if (preferCustomer)
        {
            var customer = await customerRepository.GetCustomerByEmailAsync(email, ct);
            if (customer is not null && !customer.IsDeleted)
            {
                if (customer.IsEmailVerified)
                {
                    return TypedResults.Ok(new ResendVerificationResponse(true, "Email is already verified."));
                }

                customer.EmailVerificationToken = VerificationTokenGenerator.GenerateSecureToken();
                customer.EmailVerificationTokenExpiresAt = DateTimeOffset.UtcNow.AddHours(24);
                await customerRepository.UpdateCustomerAsync(customer, ct);
                await customerRepository.SaveChangesAsync(ct);

                try
                {
                    var frontendUrl = configuration["FrontendUrl"] ?? "https://blinksmed.com";
                    var verificationLink =
                        $"{frontendUrl}/verify-email?token={Uri.EscapeDataString(customer.EmailVerificationToken)}&portal=customer";
                    var body = EmailTemplates.VendorEmailVerificationRequested(
                        customer.Email!,
                        verificationLink,
                        customer.FullName);
                    await emailService.SendEmailAsync(customer.Email!, "Verify Your Email Address", body, ct);
                    LastSent[email] = DateTimeOffset.UtcNow;
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to resend customer verification email to {Email}", email);
                }

                return TypedResults.Ok(new ResendVerificationResponse(true, "Verification email sent."));
            }

            if (role == "customer")
            {
                return TypedResults.Problem(title: "auth.user_not_found", detail: "User not found.", statusCode: 404);
            }
        }

        if (!preferVendor)
        {
            return TypedResults.Problem(title: "auth.user_not_found", detail: "User not found.", statusCode: 404);
        }

        var vendor = await repository.GetVendorByEmailAsync(email, ct);
        if (vendor is null || vendor.IsDeleted)
        {
            return TypedResults.Problem(title: "auth.user_not_found", detail: "User not found.", statusCode: 404);
        }

        if (vendor.IsEmailVerified)
        {
            return TypedResults.Ok(new ResendVerificationResponse(true, "Email is already verified."));
        }

        vendor.EmailVerificationToken = VerificationTokenGenerator.GenerateSecureToken();
        vendor.VerificationTokenExpiryUtc = DateTimeOffset.UtcNow.AddHours(24);
        await repository.UpdateVendorAsync(vendor, ct);
        await repository.SaveChangesAsync(ct);

        try
        {
            var frontendUrl = configuration["FrontendUrl"] ?? "https://blinksmed.com";
            var verificationLink = $"{frontendUrl}/verify-email?token={Uri.EscapeDataString(vendor.EmailVerificationToken)}&portal=vendor";
            var body = EmailTemplates.VendorEmailVerificationRequested(vendor.Email, verificationLink, vendor.Profile?.OwnerName ?? string.Empty);
            await emailService.SendEmailAsync(vendor.Email, "Verify Your Email Address", body, ct);
            LastSent[email] = DateTimeOffset.UtcNow;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to resend verification email to {Email}", email);
        }

        return TypedResults.Ok(new ResendVerificationResponse(true, "Verification email sent."));
    }
}

public sealed class ChangePasswordEndpoint(
    IVendorOnboardingRepository repository,
    ICustomerRepository customerRepository,
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
        if (User.HasClaim("impersonation", "true"))
        {
            return TypedResults.Problem(title: "auth.impersonation_blocked", detail: "Password changes are not allowed during impersonation.", statusCode: 403);
        }

        var identifier = (req.Email ?? string.Empty).Trim();
        var email = identifier.ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(req.CurrentPassword) || string.IsNullOrWhiteSpace(req.NewPassword))
        {
            return TypedResults.Problem(title: "auth.invalid_input", detail: "Email or phone, current password, and new password are required.", statusCode: 400);
        }

        if (req.NewPassword.Length < 8)
        {
            return TypedResults.Problem(title: "auth.invalid_password", detail: "New password must be at least 8 characters.", statusCode: 400);
        }

        // Try admin first (email only)
        if (identifier.Contains('@'))
        {
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
        }

        Vendor? vendor = null;
        if (identifier.Contains('@'))
            vendor = await repository.GetVendorByEmailAsync(email, ct);
        else if (IndianMobilePhone.TryNormalize(identifier, out var vendorPhone))
            vendor = await repository.GetVendorByPhoneAsync(vendorPhone, ct);

        if (vendor is not null && !vendor.IsDeleted)
        {
            if (!passwordHasher.VerifyPassword(req.CurrentPassword, vendor.PasswordHash))
            {
                return TypedResults.Problem(title: "auth.invalid_password", detail: "Current password is incorrect.", statusCode: 400);
            }

            vendor.PasswordHash = passwordHasher.HashPassword(req.NewPassword);
            await repository.UpdateVendorAsync(vendor, ct);
            await repository.SaveChangesAsync(ct);
            return TypedResults.Ok(new ChangePasswordResponse(true, "Password updated successfully.", DateTimeOffset.UtcNow));
        }

        Customer? customer = null;
        if (identifier.Contains('@'))
            customer = await customerRepository.GetCustomerByEmailAsync(email, ct);
        else if (IndianMobilePhone.TryNormalize(identifier, out var customerPhone))
            customer = await customerRepository.GetCustomerByPhoneAsync(customerPhone, ct);

        if (customer is null || customer.IsDeleted)
        {
            return TypedResults.Problem(title: "auth.user_not_found", detail: "User not found.", statusCode: 404);
        }

        if (!passwordHasher.VerifyPassword(req.CurrentPassword, customer.PasswordHash))
        {
            return TypedResults.Problem(title: "auth.invalid_password", detail: "Current password is incorrect.", statusCode: 400);
        }

        customer.PasswordHash = passwordHasher.HashPassword(req.NewPassword);
        await customerRepository.UpdateCustomerAsync(customer, ct);
        await customerRepository.SaveChangesAsync(ct);
        return TypedResults.Ok(new ChangePasswordResponse(true, "Password updated successfully.", DateTimeOffset.UtcNow));
    }
}

public sealed class ForgotPasswordEndpoint(
    IVendorOnboardingRepository repository,
    ICustomerRepository customerRepository,
    IEmailService emailService,
    IConfiguration configuration)
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

        // Check if email exists in vendors, admin_users, or customers
        var vendor = await repository.GetVendorByEmailAsync(email, ct);
        var admin = await repository.GetAdminUserByEmailAsync(email, ct);
        var customer = await customerRepository.GetCustomerByEmailAsync(email, ct);

        if (vendor != null || admin != null || customer != null)
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

            // Send reset link email (FrontendUrl in appsettings / env — must match deployed SPA host)
            var frontendBase = configuration["FrontendUrl"]?.Trim().TrimEnd('/') ?? "https://blinksmed.com";
            var portal = (req.Portal ?? string.Empty).Trim().ToLowerInvariant();
            var portalQs = portal is "customer" or "vendor" or "admin"
                ? $"&portal={Uri.EscapeDataString(portal)}"
                : string.Empty;
            var resetLink = $"{frontendBase}/reset-password?token={Uri.EscapeDataString(token)}{portalQs}";
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
    ICustomerRepository customerRepository,
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
            var customer = await customerRepository.GetCustomerByEmailAsync(resetToken.Email, ct);
            if (customer is null || customer.IsDeleted)
            {
                return TypedResults.Problem(title: "auth.user_not_found", detail: "User not found.", statusCode: 404);
            }

            customer.PasswordHash = passwordHasher.HashPassword(req.NewPassword);
            await customerRepository.UpdateCustomerAsync(customer, ct);
            await customerRepository.SaveChangesAsync(ct);
        }

        // Mark token as used
        await repository.MarkPasswordResetTokenAsUsedAsync(req.Token, ct);
        await repository.SaveChangesAsync(ct);

        return TypedResults.Ok(new ResetPasswordResponse(true, "Password reset successfully."));
    }
}

public sealed class RefreshTokenRequest
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
}

public sealed class RefreshTokenEndpoint(
    IConfiguration configuration,
    IVendorOnboardingRepository repository,
    ICustomerRepository customerRepository)
    : Endpoint<RefreshTokenRequest, Results<Ok<LoginResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/refresh");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<LoginResponse>, ProblemHttpResult>> ExecuteAsync(RefreshTokenRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Token) || string.IsNullOrWhiteSpace(req.RefreshToken))
        {
            return TypedResults.Problem(title: "auth.invalid_request", detail: "Both tokens are required.", statusCode: 400);
        }

        var storedToken = await repository.GetRefreshTokenAsync(req.RefreshToken, ct);
        if (storedToken == null || storedToken.IsRevoked || storedToken.ExpiresAt < DateTimeOffset.UtcNow)
        {
            return TypedResults.Problem(title: "auth.invalid_refresh_token", detail: "Invalid or expired refresh token.", statusCode: 401);
        }

        var jwtOptions = configuration.GetSection("JwtOptions").Get<JwtOptions>() ?? new JwtOptions();
        var tokenHandler = new JwtSecurityTokenHandler();
        var principal = tokenHandler.ValidateToken(req.Token, new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            ValidateLifetime = false // Ignore expiration since we are refreshing it
        }, out var securityToken);

        if (securityToken is not JwtSecurityToken jwtSecurityToken ||
            !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
        {
            return TypedResults.Problem(title: "auth.invalid_token", detail: "Invalid access token.", statusCode: 401);
        }

        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
        if (storedToken.UserId != userId)
        {
            return TypedResults.Problem(title: "auth.invalid_refresh_token", detail: "Token mismatch.", statusCode: 401);
        }

        // Block refresh of impersonation tokens
        if (principal.HasClaim("impersonation", "true"))
        {
            return TypedResults.Problem(title: "auth.impersonation_no_refresh", detail: "Impersonation sessions cannot be refreshed.", statusCode: 401);
        }

        // Revoke the old refresh token
        storedToken.IsRevoked = true;
        await repository.UpdateRefreshTokenAsync(storedToken, ct);

        // Get user details for AuthUserDto
        var email = principal.FindFirstValue(ClaimTypes.Email) ?? "";
        var role = principal.FindFirstValue(ClaimTypes.Role) ?? "";
        string name = email;
        string portalRole = role;
        string? adminRoleCode = null;
        IReadOnlyList<string>? permissions = null;

        if (role == "admin" || role == "super_admin" || role == "verifier" || role == "operations_admin")
        {
            var admin = Guid.TryParse(userId, out var adminId)
                ? await repository.GetAdminUserByIdAsync(adminId, ct)
                : await repository.GetAdminUserByEmailAsync(email, ct);
            if (admin != null)
            {
                name = admin.FullName;
                portalRole = "admin";
                adminRoleCode = admin.AdminRole?.Code ?? admin.Role;
                permissions = await repository.GetAdminPermissionCodesAsync(admin.Id, ct);
                if (permissions.Count == 0 && AdminPermissions.SystemRolePermissions.TryGetValue(adminRoleCode, out var seeded))
                    permissions = seeded;
            }
        }
        else if (role == "customer")
        {
            var customer = await customerRepository.GetCustomerByEmailAsync(email, ct);
            if (customer != null)
            {
                name = !string.IsNullOrWhiteSpace(customer.FullName)
                    ? customer.FullName
                    : (customer.Email ?? customer.Phone ?? email);
            }
        }
        else
        {
            var vendor = await repository.GetVendorByEmailAsync(email, ct);
            if (vendor != null)
            {
                var profile = await repository.GetVendorProfileAsync(vendor.Id, ct);
                name = profile?.OwnerName ?? vendor.Email;
            }
        }

        var (tokenString, _) = AuthTokenFactory.CreateAccessToken(
            jwtOptions, userId, email, portalRole, adminRoleCode, permissions);

        // Generate new Refresh Token
        var newRefreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = AuthTokenFactory.CreateRefreshTokenValue(),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
            IsRevoked = false,
            CreatedAt = DateTimeOffset.UtcNow
        };

        await repository.AddRefreshTokenAsync(newRefreshToken, ct);
        await repository.SaveChangesAsync(ct);

        return TypedResults.Ok(new LoginResponse(
            tokenString,
            newRefreshToken.Token,
            new AuthUserDto(userId, email, name, portalRole, adminRoleCode, permissions)));
    }
}

public sealed class ExchangeImpersonationRequest
{
    public string Code { get; set; } = string.Empty;
}

public sealed class ExchangeImpersonationEndpoint(
    IConfiguration configuration,
    IMediator mediator)
    : Endpoint<ExchangeImpersonationRequest, Results<Ok<LoginResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/exchange-impersonation");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<LoginResponse>, ProblemHttpResult>> ExecuteAsync(
        ExchangeImpersonationRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new ExchangeImpersonationCodeCommand(req.Code), ct);
        if (!result.IsSuccess)
            return result.ToErrorResponse();

        var jwt = configuration.GetSection("JwtOptions").Get<JwtOptions>() ?? new JwtOptions();
        if (string.IsNullOrWhiteSpace(jwt.SigningKey))
            return TypedResults.Problem(title: "auth.misconfigured", detail: "JWT signing key is not configured.", statusCode: 500);

        var data = result.Value;
        var portalRole = string.Equals(data.TargetType, "customer", StringComparison.OrdinalIgnoreCase)
            ? "customer"
            : "vendor";
        var extra = new List<Claim>
        {
            new("impersonation", "true"),
            new("impersonator_id", data.AdminUserId.ToString()),
            new("impersonation_target", portalRole),
        };

        var (tokenString, _) = AuthTokenFactory.CreateAccessToken(
            jwt,
            data.TargetId.ToString(),
            data.Email,
            portalRole,
            extraClaims: extra,
            expirationMinutesOverride: 60);

        // No refresh token for impersonation sessions
        return TypedResults.Ok(new LoginResponse(
            tokenString,
            string.Empty,
            new AuthUserDto(data.TargetId.ToString(), data.Email, data.Name, portalRole)));
    }
}

