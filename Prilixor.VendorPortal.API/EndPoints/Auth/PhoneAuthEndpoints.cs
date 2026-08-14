using System.Security.Claims;
using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Auth;

namespace Prilixor.VendorPortal.API.EndPoints.Auth;

public sealed class SendPhoneOtpRequest
{
    public string Phone { get; set; } = string.Empty;
    /// <summary>vendor | customer | admin</summary>
    public string Role { get; set; } = "vendor";
}

public sealed class VerifyPhoneOtpRequest
{
    public string Phone { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    /// <summary>vendor | customer | admin</summary>
    public string Role { get; set; } = "vendor";
}

public sealed class SendForgotPasswordSmsOtpRequest
{
    public string Phone { get; set; } = string.Empty;
    /// <summary>customer | vendor | admin</summary>
    public string Role { get; set; } = "customer";
}

public sealed class VerifyForgotPasswordSmsOtpRequest
{
    public string Phone { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    /// <summary>customer | vendor</summary>
    public string Role { get; set; } = "customer";
}

public sealed class ResetPasswordWithSmsOtpRequest
{
    public string Phone { get; set; } = string.Empty;
    /// <summary>Short-lived token from forgot-password SMS verify-otp.</summary>
    public string ResetToken { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
    public string ConfirmPassword { get; set; } = string.Empty;
    /// <summary>customer | vendor | admin</summary>
    public string Role { get; set; } = "customer";
}

public sealed class SendPhoneOtpEndpoint(IMediator mediator)
    : Endpoint<SendPhoneOtpRequest, Results<Ok<PhoneOtpActionDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/phone/send-otp");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<PhoneOtpActionDto>, ProblemHttpResult>> ExecuteAsync(
        SendPhoneOtpRequest req,
        CancellationToken ct)
    {
        var userId = PhoneOtpAuth.ResolveMatchingAuthenticatedUserId(User, req.Role);
        var result = await mediator.Send(new SendPhoneOtpCommand(req.Phone, req.Role, userId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class VerifyPhoneOtpEndpoint(IMediator mediator)
    : Endpoint<VerifyPhoneOtpRequest, Results<Ok<PhoneOtpActionDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/phone/verify-otp");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<PhoneOtpActionDto>, ProblemHttpResult>> ExecuteAsync(
        VerifyPhoneOtpRequest req,
        CancellationToken ct)
    {
        var userId = PhoneOtpAuth.ResolveMatchingAuthenticatedUserId(User, req.Role);
        var result = await mediator.Send(new VerifyPhoneOtpCommand(req.Phone, req.Code, req.Role, userId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

file static class PhoneOtpAuth
{
    /// <summary>
    /// Only treat the JWT as the acting user when its role matches the OTP request role.
    /// Avoids a leftover customer/admin token poisoning vendor signup OTP.
    /// </summary>
    public static Guid? ResolveMatchingAuthenticatedUserId(ClaimsPrincipal user, string? requestRole)
    {
        if (!Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
            return null;

        var jwtRole = (user.FindFirstValue(ClaimTypes.Role) ?? string.Empty).Trim().ToLowerInvariant();
        var role = (requestRole ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(jwtRole) || string.IsNullOrEmpty(role) || jwtRole != role)
            return null;

        return id;
    }
}

public sealed class SendForgotPasswordSmsOtpEndpoint(IMediator mediator)
    : Endpoint<SendForgotPasswordSmsOtpRequest, Results<Ok<PhoneOtpActionDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/forgot-password/sms/send-otp");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<PhoneOtpActionDto>, ProblemHttpResult>> ExecuteAsync(
        SendForgotPasswordSmsOtpRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new SendForgotPasswordSmsOtpCommand(req.Phone, req.Role), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class VerifyForgotPasswordSmsOtpEndpoint(IMediator mediator)
    : Endpoint<VerifyForgotPasswordSmsOtpRequest, Results<Ok<ForgotPasswordSmsVerifiedDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/forgot-password/sms/verify-otp");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<ForgotPasswordSmsVerifiedDto>, ProblemHttpResult>> ExecuteAsync(
        VerifyForgotPasswordSmsOtpRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new VerifyForgotPasswordSmsOtpCommand(req.Phone, req.Code, req.Role),
            ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class ResetPasswordWithSmsOtpEndpoint(IMediator mediator)
    : Endpoint<ResetPasswordWithSmsOtpRequest, Results<Ok<PhoneOtpActionDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/forgot-password/sms/reset");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<PhoneOtpActionDto>, ProblemHttpResult>> ExecuteAsync(
        ResetPasswordWithSmsOtpRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new ResetPasswordWithSmsOtpCommand(
                req.Phone,
                req.ResetToken,
                req.NewPassword,
                req.ConfirmPassword,
                req.Role),
            ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
