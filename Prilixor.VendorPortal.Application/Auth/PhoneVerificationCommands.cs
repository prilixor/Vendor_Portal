using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Common;

namespace Prilixor.VendorPortal.Application.Auth;

public sealed record SendPhoneOtpCommand(
    string Phone,
    string Role,
    Guid? AuthenticatedUserId = null) : ICommand<PhoneOtpActionDto>;

public sealed record VerifyPhoneOtpCommand(
    string Phone,
    string Code,
    string Role,
    Guid? AuthenticatedUserId = null) : ICommand<PhoneOtpActionDto>;

public sealed record PhoneOtpActionDto(bool Success, string Message, bool IsPhoneVerified, string? Phone);

public sealed class SendPhoneOtpCommandValidator : AbstractValidator<SendPhoneOtpCommand>
{
    public SendPhoneOtpCommandValidator()
    {
        RuleFor(x => x.Phone).NotEmpty();
        RuleFor(x => x.Role).NotEmpty();
    }
}

public sealed class VerifyPhoneOtpCommandValidator : AbstractValidator<VerifyPhoneOtpCommand>
{
    public VerifyPhoneOtpCommandValidator()
    {
        RuleFor(x => x.Phone).NotEmpty();
        RuleFor(x => x.Code).NotEmpty();
        RuleFor(x => x.Role).NotEmpty();
    }
}

internal sealed class SendPhoneOtpCommandHandler(
    IPhoneVerificationService phoneVerification,
    IVendorOnboardingRepository vendors,
    ICustomerRepository customers)
    : ICommandHandler<SendPhoneOtpCommand, PhoneOtpActionDto>
{
    public async Task<Result<PhoneOtpActionDto>> Handle(SendPhoneOtpCommand request, CancellationToken cancellationToken)
    {
        if (!IndianMobilePhone.TryToE164(request.Phone, out var e164)
            || !IndianMobilePhone.TryNormalize(request.Phone, out var national))
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "phone.invalid",
                IndianMobilePhone.InvalidMessage,
                ErrorCategory.Validation));
        }

        var role = (request.Role ?? string.Empty).Trim().ToLowerInvariant();
        if (role == "admin")
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "phone.admin_not_supported",
                "Admin accounts use email only. Phone verification is not available.",
                ErrorCategory.Validation));
        }

        if (role is not ("vendor" or "customer"))
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "phone.invalid_role",
                "Role must be 'vendor' or 'customer'.",
                ErrorCategory.Validation));
        }

        if (role == "vendor")
        {
            var existing = await vendors.GetVendorByPhoneAsync(national, cancellationToken);
            if (request.AuthenticatedUserId is Guid vendorId)
            {
                if (existing is not null && existing.Id != vendorId)
                {
                    var authVendor = await vendors.GetVendorByIdAsync(vendorId, cancellationToken);
                    var authPhone = IndianMobilePhone.NormalizeDigits(authVendor?.SupportPhone);

                    // Settings: logged-in vendor already has this number on file but another row owns it
                    // (data conflict) → block. Stale JWT during signup (auth phone ≠ OTP phone) → allow.
                    if (string.Equals(authPhone, national, StringComparison.Ordinal))
                    {
                        return Result.Failure<PhoneOtpActionDto>(new Error(
                            "vendors.phone_exists",
                            "A vendor account already exists for this phone number.",
                            ErrorCategory.Validation));
                    }
                }
            }
            else if (existing is null)
            {
                // Allow OTP during/after register when phone was just saved; if not found yet, still send.
            }
        }
        else
        {
            // Customer: block OTP when phone belongs to a different account.
            var existingCustomer = await customers.GetCustomerByPhoneAsync(national, cancellationToken);
            if (request.AuthenticatedUserId is Guid customerId)
            {
                var customer = await customers.GetCustomerByIdAsync(customerId, cancellationToken);
                if (customer is null || customer.IsDeleted)
                {
                    return Result.Failure<PhoneOtpActionDto>(new Error(
                        "customers.not_found",
                        "Customer not found.",
                        ErrorCategory.NotFound));
                }

                if (existingCustomer is not null && existingCustomer.Id != customerId)
                {
                    var authPhone = IndianMobilePhone.NormalizeDigits(customer.Phone);
                    // Stale JWT during another signup: allow OTP for the phone owner.
                    if (string.Equals(authPhone, national, StringComparison.Ordinal))
                    {
                        return Result.Failure<PhoneOtpActionDto>(new Error(
                            "customers.phone_exists",
                            "This phone number is already used by another customer account.",
                            ErrorCategory.Validation));
                    }
                }
            }
            else if (existingCustomer is null)
            {
                // Unauthenticated send (register / forgot): OTP may still be sent;
                // forgot-password only resets when a matching customer exists.
            }
        }

        var send = await phoneVerification.SendOtpAsync(e164, cancellationToken);
        if (!send.Success)
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                send.ErrorCode ?? "phone.otp_send_failed",
                send.Message,
                ErrorCategory.Validation));
        }

        return Result.Success(new PhoneOtpActionDto(true, send.Message, false, national));
    }
}

internal sealed class VerifyPhoneOtpCommandHandler(
    IPhoneVerificationService phoneVerification,
    IVendorOnboardingRepository vendors,
    ICustomerRepository customers)
    : ICommandHandler<VerifyPhoneOtpCommand, PhoneOtpActionDto>
{
    public async Task<Result<PhoneOtpActionDto>> Handle(VerifyPhoneOtpCommand request, CancellationToken cancellationToken)
    {
        if (!IndianMobilePhone.TryToE164(request.Phone, out var e164)
            || !IndianMobilePhone.TryNormalize(request.Phone, out var national))
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "phone.invalid",
                IndianMobilePhone.InvalidMessage,
                ErrorCategory.Validation));
        }

        var role = (request.Role ?? string.Empty).Trim().ToLowerInvariant();
        if (role == "admin")
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "phone.admin_not_supported",
                "Admin accounts use email only. Phone verification is not available.",
                ErrorCategory.Validation));
        }

        if (role is not ("vendor" or "customer"))
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "phone.invalid_role",
                "Role must be 'vendor' or 'customer'.",
                ErrorCategory.Validation));
        }

        var verify = await phoneVerification.VerifyOtpAsync(e164, request.Code, cancellationToken);
        if (!verify.Success)
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                verify.ErrorCode ?? "phone.invalid_code",
                verify.Message,
                ErrorCategory.Validation));
        }

        var now = DateTimeOffset.UtcNow;

        if (role == "vendor")
        {
            if (request.AuthenticatedUserId is Guid vendorId)
            {
                var vendor = await vendors.GetVendorByIdAsync(vendorId, cancellationToken);
                if (vendor is null || vendor.IsDeleted)
                {
                    return Result.Failure<PhoneOtpActionDto>(new Error(
                        "vendors.not_found",
                        "Vendor not found.",
                        ErrorCategory.NotFound));
                }

                var existing = await vendors.GetVendorByPhoneAsync(national, cancellationToken);
                var authPhone = IndianMobilePhone.NormalizeDigits(vendor.SupportPhone);

                // Stale JWT during signup: logged-in vendor does not own this phone.
                // Mark the phone owner verified instead of returning a false "duplicate" error.
                if (existing is not null && existing.Id != vendorId
                    && !string.Equals(authPhone, national, StringComparison.Ordinal))
                {
                    existing.PhoneVerifiedAt = now;
                    existing.ModifiedOnUtc = DateTime.UtcNow;
                    await vendors.UpdateVendorAsync(existing, cancellationToken);
                    await vendors.SaveChangesAsync(cancellationToken);
                }
                else if (existing is not null && existing.Id != vendorId)
                {
                    return Result.Failure<PhoneOtpActionDto>(new Error(
                        "vendors.phone_exists",
                        "A vendor account already exists for this phone number.",
                        ErrorCategory.Validation));
                }
                else
                {
                    vendor.SupportPhone = national;
                    vendor.PhoneVerifiedAt = now;
                    vendor.ModifiedOnUtc = DateTime.UtcNow;
                    await vendors.UpdateVendorAsync(vendor, cancellationToken);

                    var profile = await vendors.GetVendorProfileAsync(vendorId, cancellationToken);
                    if (profile is not null)
                    {
                        profile.SupportPhone = national;
                        profile.ModifiedOnUtc = DateTime.UtcNow;
                        await vendors.UpsertVendorProfileAsync(profile, cancellationToken);
                    }

                    await vendors.SaveChangesAsync(cancellationToken);
                }
            }
            else
            {
                var vendor = await vendors.GetVendorByPhoneAsync(national, cancellationToken);
                if (vendor is not null)
                {
                    vendor.PhoneVerifiedAt = now;
                    vendor.ModifiedOnUtc = DateTime.UtcNow;
                    await vendors.UpdateVendorAsync(vendor, cancellationToken);
                    await vendors.SaveChangesAsync(cancellationToken);
                }
            }
        }
        else
        {
            if (request.AuthenticatedUserId is Guid customerId)
            {
                var customer = await customers.GetCustomerByIdAsync(customerId, cancellationToken);
                if (customer is null || customer.IsDeleted)
                {
                    return Result.Failure<PhoneOtpActionDto>(new Error(
                        "customers.not_found",
                        "Customer not found.",
                        ErrorCategory.NotFound));
                }

                var phoneOwner = await customers.GetCustomerByPhoneAsync(national, cancellationToken);
                var authPhone = IndianMobilePhone.NormalizeDigits(customer.Phone);
                if (phoneOwner is not null && phoneOwner.Id != customerId
                    && !string.Equals(authPhone, national, StringComparison.Ordinal))
                {
                    phoneOwner.PhoneVerifiedAt = now;
                    phoneOwner.ModifiedOnUtc = DateTime.UtcNow;
                    await customers.UpdateCustomerAsync(phoneOwner, cancellationToken);
                    await customers.SaveChangesAsync(cancellationToken);
                }
                else if (phoneOwner is not null && phoneOwner.Id != customerId)
                {
                    return Result.Failure<PhoneOtpActionDto>(new Error(
                        "customers.phone_exists",
                        "This phone number is already used by another customer account.",
                        ErrorCategory.Validation));
                }
                else
                {
                    customer.Phone = national;
                    customer.PhoneVerifiedAt = now;
                    customer.ModifiedOnUtc = DateTime.UtcNow;
                    await customers.UpdateCustomerAsync(customer, cancellationToken);
                    await customers.SaveChangesAsync(cancellationToken);
                }
            }
            else
            {
                var customer = await customers.GetCustomerByPhoneAsync(national, cancellationToken);
                if (customer is not null)
                {
                    customer.PhoneVerifiedAt = now;
                    customer.ModifiedOnUtc = DateTime.UtcNow;
                    await customers.UpdateCustomerAsync(customer, cancellationToken);
                    await customers.SaveChangesAsync(cancellationToken);
                }
            }
        }

        return Result.Success(new PhoneOtpActionDto(true, verify.Message, true, national));
    }
}
