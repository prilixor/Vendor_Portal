using FastEndpoints;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.API.EndPoints.Auth;

public sealed record PhoneOtpAvailabilityDto(bool PhoneOtpEnabled);

public sealed class GetPhoneOtpAvailabilityEndpoint(IPlatformSmsSettingsService settings)
    : EndpointWithoutRequest<Ok<PhoneOtpAvailabilityDto>>
{
    public override void Configure()
    {
        Get("auth/phone-otp-enabled");
        AllowAnonymous();
        DontAutoTag();
        Options(x => x.WithTags("Auth"));
    }

    public override async Task<Ok<PhoneOtpAvailabilityDto>> ExecuteAsync(CancellationToken ct)
    {
        var enabled = await settings.IsPhoneOtpEnabledAsync(ct);
        return TypedResults.Ok(new PhoneOtpAvailabilityDto(enabled));
    }
}
