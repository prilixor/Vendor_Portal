using FastEndpoints;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.API.EndPoints.Vendors;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class GetPlatformSmsSettingsEndpoint(IPlatformSmsSettingsService settings)
    : EndpointWithoutRequest<Results<Ok<PlatformSmsSettingsDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("sms-settings");
        Group<AdminApiGroup>();
        Policies("Perm:admins.manage");
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Results<Ok<PlatformSmsSettingsDto>, ProblemHttpResult>> ExecuteAsync(
        CancellationToken ct)
    {
        var dto = await settings.GetAsync(ct);
        return TypedResults.Ok(dto);
    }
}

public sealed class UpdatePlatformSmsSettingsRequest
{
    public bool TransactionalSmsEnabled { get; set; }
    public bool CustomerOrderPlaced { get; set; }
    public bool CustomerOrderConfirmed { get; set; }
    public bool CustomerOrderCancelled { get; set; }
    public bool CustomerOrderStatusUpdated { get; set; }
    public bool CustomerOrderDispatchFailed { get; set; }
    public bool CustomerOrderExpiring { get; set; }
    public bool VendorNewOrder { get; set; }
    public bool VendorAccountApproved { get; set; }
    public bool VendorAccountRejected { get; set; }
    public bool VendorAccountSuspended { get; set; }
    public bool VendorAccountBanned { get; set; }
    public bool VendorAccountReactivated { get; set; }
    public bool VendorBankVerified { get; set; }
    public bool VendorDocumentVerified { get; set; }
    public bool VendorServiceAreaUpdated { get; set; }
}

public sealed class UpdatePlatformSmsSettingsEndpoint(IPlatformSmsSettingsService settings)
    : Endpoint<UpdatePlatformSmsSettingsRequest, Results<Ok<PlatformSmsSettingsDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("sms-settings");
        Group<AdminApiGroup>();
        Policies("Perm:admins.manage");
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Results<Ok<PlatformSmsSettingsDto>, ProblemHttpResult>> ExecuteAsync(
        UpdatePlatformSmsSettingsRequest req,
        CancellationToken ct)
    {
        var dto = await settings.UpdateAsync(
            new PlatformSmsSettingsDto(
                req.TransactionalSmsEnabled,
                req.CustomerOrderPlaced,
                req.CustomerOrderConfirmed,
                req.CustomerOrderCancelled,
                req.CustomerOrderStatusUpdated,
                req.CustomerOrderDispatchFailed,
                req.CustomerOrderExpiring,
                req.VendorNewOrder,
                req.VendorAccountApproved,
                req.VendorAccountRejected,
                req.VendorAccountSuspended,
                req.VendorAccountBanned,
                req.VendorAccountReactivated,
                req.VendorBankVerified,
                req.VendorDocumentVerified,
                req.VendorServiceAreaUpdated,
                TwilioConfigured: false),
            ct);
        return TypedResults.Ok(dto);
    }
}
