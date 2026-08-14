using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Common;
using Prilixor.VendorPortal.Application.Services;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Prilixor.Shared.Extensions;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record RegisterVendorCommand(string Email, string Password, string SupportPhone) : ICommand<VendorDto>;

public sealed class RegisterVendorCommandValidator : AbstractValidator<RegisterVendorCommand>
{
    public RegisterVendorCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.SupportPhone)
            .NotEmpty()
            .Must(IndianMobilePhone.IsValid)
            .WithMessage(IndianMobilePhone.InvalidMessage);
    }
}

internal sealed class RegisterVendorCommandHandler(
    IVendorOnboardingRepository repository,
    IPasswordHasherService passwordHasherService,
    IEmailService emailService,
    IConfiguration configuration,
    ILogger<RegisterVendorCommandHandler> logger)
    : ICommandHandler<RegisterVendorCommand, VendorDto>
{
    public async Task<Result<VendorDto>> Handle(RegisterVendorCommand request, CancellationToken cancellationToken)
    {
        var existing = await repository.GetVendorByEmailAsync(request.Email, cancellationToken);
        if (existing is not null)
        {
            return Result.Failure<VendorDto>(new Error("vendors.email_exists", "A vendor account already exists for this email.", ErrorCategory.Validation));
        }

        // Validate support phone defensively server-side
        if (string.IsNullOrWhiteSpace(request.SupportPhone))
        {
            return Result.Failure<VendorDto>(new Error("vendors.invalid_support_phone", "Support phone is required.", ErrorCategory.Validation));
        }

        if (!IndianMobilePhone.TryNormalize(request.SupportPhone, out var normalizedPhone))
        {
            return Result.Failure<VendorDto>(new Error(
                "vendors.invalid_support_phone",
                IndianMobilePhone.InvalidMessage,
                ErrorCategory.Validation));
        }

        request = request with { SupportPhone = normalizedPhone };

        var existingByPhone = await repository.GetVendorByPhoneAsync(request.SupportPhone, cancellationToken);
        if (existingByPhone is not null)
        {
            return Result.Failure<VendorDto>(new Error("vendors.phone_exists", "A vendor account already exists for this phone number.", ErrorCategory.Validation));
        }

        var vendor = new Vendor
        {
            Email = request.Email.Trim().ToLowerInvariant(),
            SupportPhone = request.SupportPhone,
            PhoneVerifiedAt = null,
            PasswordHash = passwordHasherService.HashPassword(request.Password),
            IsEmailVerified = false,
            EmailVerificationToken = VerificationTokenGenerator.GenerateSecureToken(),
            VerificationTokenExpiryUtc = DateTimeOffset.UtcNow.AddHours(24),
            AccountStatus = "pending",
            RegistrationStage = "email_registered",
            TermsAcceptedAt = DateTimeOffset.UtcNow
        };

        await repository.AddVendorAsync(vendor, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        // Create initial vendor profile with support phone if provided
        if (!string.IsNullOrWhiteSpace(request.SupportPhone))
        {
            var profile = new VendorProfile
            {
                VendorId = vendor.Id,
                SupportPhone = vendor.SupportPhone,
                BusinessName = string.Empty,
                OwnerName = string.Empty,
                City = string.Empty,
                State = string.Empty,
                PostalCode = string.Empty,
                AddressLine1 = string.Empty
            };

            await repository.UpsertVendorProfileAsync(profile, cancellationToken);
            await repository.SaveChangesAsync(cancellationToken);
        }

        try
        {
            var frontendUrl = configuration["FrontendUrl"] ?? "https://blinksmed.com";
            var verificationLink =
                $"{frontendUrl}/verify-email?token={Uri.EscapeDataString(vendor.EmailVerificationToken ?? string.Empty)}&portal=vendor";
            var emailBody = EmailTemplates.VendorEmailVerificationRequested(vendor.Email, verificationLink);
            await emailService.SendEmailAsync(vendor.Email, "Verify Your Email Address", emailBody, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send verification email to vendor {VendorEmail}", vendor.Email);
        }

        return Result.Success(new VendorDto(
            vendor.Id.ToString(),
            vendor.Email,
            vendor.IsEmailVerified,
            vendor.VerificationTokenExpiryUtc.ToSafeDateTimeOffset(),
            vendor.AccountStatus,
            vendor.RegistrationStage,
            vendor.LastLoginAt.ToSafeDateTimeOffset(),
            vendor.TermsAcceptedAt.ToSafeDateTimeOffset(),
            vendor.CreatedOnUtc.ToSafeDateTimeOffset()));
    }
}
