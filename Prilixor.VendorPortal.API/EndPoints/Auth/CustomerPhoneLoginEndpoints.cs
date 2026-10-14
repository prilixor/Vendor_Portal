using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Configuration;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.API.Services;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Auth;
using Prilixor.VendorPortal.Domain.Auth;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.API.EndPoints.Auth;

public sealed class SendCustomerLoginOtpRequest
{
    public string Phone { get; set; } = string.Empty;
}

public sealed class LoginCustomerWithPhoneOtpRequest
{
    public string Phone { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

public sealed class SendCustomerLoginOtpEndpoint(IMediator mediator)
    : Endpoint<SendCustomerLoginOtpRequest, Results<Ok<PhoneOtpActionDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/login/sms/send-otp");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<PhoneOtpActionDto>, ProblemHttpResult>> ExecuteAsync(
        SendCustomerLoginOtpRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new SendCustomerLoginOtpCommand(req.Phone), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class LoginCustomerWithPhoneOtpEndpoint(
    IMediator mediator,
    IConfiguration configuration,
    IVendorOnboardingRepository repository)
    : Endpoint<LoginCustomerWithPhoneOtpRequest, Results<Ok<LoginResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/login/sms/verify-otp");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<LoginResponse>, ProblemHttpResult>> ExecuteAsync(
        LoginCustomerWithPhoneOtpRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new LoginCustomerWithPhoneOtpCommand(req.Phone, req.Code), ct);
        if (!result.IsSuccess)
            return result.ToErrorResponse();

        var jwt = configuration.GetSection("JwtOptions").Get<JwtOptions>() ?? new JwtOptions();
        if (string.IsNullOrWhiteSpace(jwt.SigningKey))
        {
            return TypedResults.Problem(
                title: "auth.misconfigured",
                detail: "JWT signing key is not configured.",
                statusCode: 500);
        }

        var customer = result.Value;
        var userId = customer.Id.ToString();
        var (tokenString, _) = AuthTokenFactory.CreateAccessToken(
            jwt, userId, customer.Email, "customer");

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
            new AuthUserDto(userId, customer.Email, customer.Name, "customer")));
    }
}
