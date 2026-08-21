using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Common;

namespace Prilixor.VendorPortal.Application.Auth;

public sealed record SendCustomerLoginOtpCommand(string Phone) : ICommand<PhoneOtpActionDto>;

public sealed record LoginCustomerWithPhoneOtpCommand(string Phone, string Code)
    : ICommand<CustomerPhoneLoginDto>;

public sealed record CustomerPhoneLoginDto(Guid Id, string Email, string Name);

public sealed class SendCustomerLoginOtpCommandValidator : AbstractValidator<SendCustomerLoginOtpCommand>
{
    public SendCustomerLoginOtpCommandValidator()
    {
        RuleFor(x => x.Phone).NotEmpty();
    }
}

public sealed class LoginCustomerWithPhoneOtpCommandValidator : AbstractValidator<LoginCustomerWithPhoneOtpCommand>
{
    public LoginCustomerWithPhoneOtpCommandValidator()
    {
        RuleFor(x => x.Phone).NotEmpty();
        RuleFor(x => x.Code).NotEmpty().Length(6);
    }
}

internal sealed class SendCustomerLoginOtpCommandHandler(
    IPhoneVerificationService phoneVerification,
    ICustomerRepository customers)
    : ICommandHandler<SendCustomerLoginOtpCommand, PhoneOtpActionDto>
{
    public async Task<Result<PhoneOtpActionDto>> Handle(
        SendCustomerLoginOtpCommand request,
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

        var customer = await customers.GetCustomerByPhoneAsync(national, cancellationToken);
        if (customer is null || customer.IsDeleted)
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                "auth.customer_phone_not_found",
                "No customer account found for this mobile number.",
                ErrorCategory.Validation));
        }

        var send = await phoneVerification.SendOtpAsync(e164, cancellationToken);
        if (!send.Success)
        {
            return Result.Failure<PhoneOtpActionDto>(new Error(
                send.ErrorCode ?? "phone.otp_send_failed",
                send.Message,
                ErrorCategory.Validation));
        }

        return Result.Success(new PhoneOtpActionDto(true, send.Message, customer.PhoneVerifiedAt.HasValue, national));
    }
}

internal sealed class LoginCustomerWithPhoneOtpCommandHandler(
    IPhoneVerificationService phoneVerification,
    ICustomerRepository customers)
    : ICommandHandler<LoginCustomerWithPhoneOtpCommand, CustomerPhoneLoginDto>
{
    public async Task<Result<CustomerPhoneLoginDto>> Handle(
        LoginCustomerWithPhoneOtpCommand request,
        CancellationToken cancellationToken)
    {
        if (!IndianMobilePhone.TryToE164(request.Phone, out var e164)
            || !IndianMobilePhone.TryNormalize(request.Phone, out var national))
        {
            return Result.Failure<CustomerPhoneLoginDto>(new Error(
                "phone.invalid",
                IndianMobilePhone.InvalidMessage,
                ErrorCategory.Validation));
        }

        var customer = await customers.GetCustomerByPhoneAsync(national, cancellationToken);
        if (customer is null || customer.IsDeleted)
        {
            return Result.Failure<CustomerPhoneLoginDto>(new Error(
                "auth.invalid_credentials",
                "Invalid or expired verification code.",
                ErrorCategory.Unauthorized));
        }

        var verify = await phoneVerification.VerifyOtpAsync(e164, request.Code, cancellationToken);
        if (!verify.Success)
        {
            return Result.Failure<CustomerPhoneLoginDto>(new Error(
                verify.ErrorCode ?? "phone.invalid_code",
                verify.Message,
                ErrorCategory.Validation));
        }

        var now = DateTimeOffset.UtcNow;
        customer.PhoneVerifiedAt = now;
        customer.LastLoginAt = now;
        customer.ModifiedOnUtc = DateTime.UtcNow;
        await customers.UpdateCustomerAsync(customer, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        var email = !string.IsNullOrWhiteSpace(customer.Email)
            ? customer.Email
            : (customer.Phone ?? national);
        var name = !string.IsNullOrWhiteSpace(customer.FullName)
            ? customer.FullName
            : email;

        return Result.Success(new CustomerPhoneLoginDto(customer.Id, email, name));
    }
}
