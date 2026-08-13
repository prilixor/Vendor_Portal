using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Common;

namespace Prilixor.VendorPortal.Application.Auth;

/// <param name="Role">customer | vendor (admin uses email reset only)</param>
public sealed record SendForgotPasswordSmsOtpCommand(string Phone, string Role = "customer")
    : ICommand<PhoneOtpActionDto>;

/// <param name="Role">customer | vendor (admin uses email reset only)</param>
public sealed record ResetPasswordWithSmsOtpCommand(
    string Phone,
    string Code,
    string NewPassword,
    string ConfirmPassword,
    string Role = "customer") : ICommand<PhoneOtpActionDto>;

public sealed class SendForgotPasswordSmsOtpCommandValidator : AbstractValidator<SendForgotPasswordSmsOtpCommand>
{
    public SendForgotPasswordSmsOtpCommandValidator()
    {
        RuleFor(x => x.Phone).NotEmpty();
        RuleFor(x => x.Role)
            .Must(r => NormalizeRole(r) is "customer" or "vendor")
            .WithMessage("Role must be customer or vendor. Admin password reset uses email.");
    }

    private static string NormalizeRole(string? role) => (role ?? "").Trim().ToLowerInvariant();
}

public sealed class ResetPasswordWithSmsOtpCommandValidator : AbstractValidator<ResetPasswordWithSmsOtpCommand>
{
    public ResetPasswordWithSmsOtpCommandValidator()
    {
        RuleFor(x => x.Phone).NotEmpty();
        RuleFor(x => x.Code).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8);
        RuleFor(x => x.ConfirmPassword).Equal(x => x.NewPassword).WithMessage("Passwords do not match.");
        RuleFor(x => x.Role)
            .Must(r => NormalizeRole(r) is "customer" or "vendor")
            .WithMessage("Role must be customer or vendor. Admin password reset uses email.");
    }

    private static string NormalizeRole(string? role) => (role ?? "").Trim().ToLowerInvariant();
}

internal sealed class SendForgotPasswordSmsOtpCommandHandler(
    IPhoneVerificationService phoneVerification,
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : ICommandHandler<SendForgotPasswordSmsOtpCommand, PhoneOtpActionDto>
{
    public async Task<Result<PhoneOtpActionDto>> Handle(
        SendForgotPasswordSmsOtpCommand request,
        CancellationToken cancellationToken)
    {
        if (!IndianMobilePhone.TryToE164(request.Phone, out var e164)
            || !IndianMobilePhone.TryNormalize(request.Phone, out var national))
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "phone.invalid",
                IndianMobilePhone.InvalidMessage,
                ErrorCategory.Validation));
        }

        var role = (request.Role ?? "customer").Trim().ToLowerInvariant();
        var accountExists = false;

        if (role == "admin")
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "auth.admin_sms_not_supported",
                "Admin password reset uses email only.",
                ErrorCategory.Validation));
        }

        if (role == "vendor")
        {
            var vendor = await vendors.GetVendorByPhoneAsync(national, cancellationToken);
            accountExists = vendor is not null && !vendor.IsDeleted;
        }
        else
        {
            var customer = await customers.GetCustomerByPhoneAsync(national, cancellationToken);
            accountExists = customer is not null && !customer.IsDeleted;
        }

        if (accountExists)
        {
            var send = await phoneVerification.SendOtpAsync(e164, cancellationToken);
            if (!send.Success)
            {
                return Result.Failure<PhoneOtpActionDto>(new Error(
                    send.ErrorCode ?? "phone.otp_send_failed",
                    send.Message,
                    ErrorCategory.Validation));
            }
        }

        return Result.Success(new PhoneOtpActionDto(
            true,
            "If an account exists for this phone, a verification code has been sent.",
            false,
            national));
    }
}

internal sealed class ResetPasswordWithSmsOtpCommandHandler(
    IPhoneVerificationService phoneVerification,
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IPasswordHasherService passwordHasher)
    : ICommandHandler<ResetPasswordWithSmsOtpCommand, PhoneOtpActionDto>
{
    public async Task<Result<PhoneOtpActionDto>> Handle(
        ResetPasswordWithSmsOtpCommand request,
        CancellationToken cancellationToken)
    {
        if (!IndianMobilePhone.TryToE164(request.Phone, out var e164)
            || !IndianMobilePhone.TryNormalize(request.Phone, out var national))
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "phone.invalid",
                IndianMobilePhone.InvalidMessage,
                ErrorCategory.Validation));
        }

        var role = (request.Role ?? "customer").Trim().ToLowerInvariant();

        if (role == "vendor")
        {
            var vendor = await vendors.GetVendorByPhoneAsync(national, cancellationToken);
            if (vendor is null || vendor.IsDeleted)
            {
                return Result.Failure<PhoneOtpActionDto>(new Error(
                    "auth.reset_failed",
                    "Unable to reset password for this phone number.",
                    ErrorCategory.Validation));
            }

            var verifyVendor = await phoneVerification.VerifyOtpAsync(e164, request.Code, cancellationToken);
            if (!verifyVendor.Success)
            {
                return Result.Failure<PhoneOtpActionDto>(new Error(
                    verifyVendor.ErrorCode ?? "phone.invalid_code",
                    verifyVendor.Message,
                    ErrorCategory.Validation));
            }

            vendor.PasswordHash = passwordHasher.HashPassword(request.NewPassword);
            vendor.PhoneVerifiedAt ??= DateTimeOffset.UtcNow;
            vendor.ModifiedOnUtc = DateTime.UtcNow;
            await vendors.UpdateVendorAsync(vendor, cancellationToken);
            await vendors.SaveChangesAsync(cancellationToken);

            return Result.Success(new PhoneOtpActionDto(
                true,
                "Password reset successfully.",
                vendor.PhoneVerifiedAt.HasValue,
                national));
        }

        if (role == "admin")
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "auth.admin_sms_not_supported",
                "Admin password reset uses email only.",
                ErrorCategory.Validation));
        }

        var customer = await customers.GetCustomerByPhoneAsync(national, cancellationToken);
        if (customer is null || customer.IsDeleted)
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "auth.reset_failed",
                "Unable to reset password for this phone number.",
                ErrorCategory.Validation));
        }

        var verifyCustomer = await phoneVerification.VerifyOtpAsync(e164, request.Code, cancellationToken);
        if (!verifyCustomer.Success)
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                verifyCustomer.ErrorCode ?? "phone.invalid_code",
                verifyCustomer.Message,
                ErrorCategory.Validation));
        }

        customer.PasswordHash = passwordHasher.HashPassword(request.NewPassword);
        customer.PhoneVerifiedAt ??= DateTimeOffset.UtcNow;
        customer.ModifiedOnUtc = DateTime.UtcNow;
        await customers.UpdateCustomerAsync(customer, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(new PhoneOtpActionDto(
            true,
            "Password reset successfully.",
            customer.PhoneVerifiedAt.HasValue,
            national));
    }
}
