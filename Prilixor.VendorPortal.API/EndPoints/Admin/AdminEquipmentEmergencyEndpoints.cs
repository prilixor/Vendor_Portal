using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.EndPoints.Vendors;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class GetEquipmentEmergenciesRequest
{
    /// <summary>Optional. When set, only emergencies for this order are returned.</summary>
    public Guid? OrderId { get; set; }

    /// <summary>Optional: open, acknowledged, resolved or live. The popup and bell ask for "open" so older items never hide a new one.</summary>
    public string? Status { get; set; }
}

public sealed class GetEquipmentEmergencyPageRequest
{
    /// <summary>all (default), open, acknowledged, resolved or live.</summary>
    public string? Status { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 15;
}

public sealed class GetEquipmentEmergencyPageEndpoint(IMediator mediator)
    : Endpoint<GetEquipmentEmergencyPageRequest, Results<Ok<PagedEquipmentEmergenciesDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("emergencies/page");
        Group<AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Results<Ok<PagedEquipmentEmergenciesDto>, ProblemHttpResult>> ExecuteAsync(
        GetEquipmentEmergencyPageRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new GetEquipmentEmergencyPageQuery(req.Status, req.Page, req.PageSize), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetEquipmentEmergenciesEndpoint(IMediator mediator)
    : Endpoint<GetEquipmentEmergenciesRequest, Results<Ok<List<EquipmentEmergencyDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("emergencies");
        Group<AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Results<Ok<List<EquipmentEmergencyDto>>, ProblemHttpResult>> ExecuteAsync(GetEquipmentEmergenciesRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetRecentEquipmentEmergenciesQuery(req.OrderId.HasValue ? 50 : 30, req.OrderId, req.Status), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AcknowledgeEquipmentEmergencyRequest
{
    public Guid Id { get; set; }
}

public sealed class AcknowledgeEquipmentEmergencyEndpoint(IMediator mediator)
    : Endpoint<AcknowledgeEquipmentEmergencyRequest, Results<Ok<EquipmentEmergencyDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("emergencies/{Id}/acknowledge");
        Group<AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Results<Ok<EquipmentEmergencyDto>, ProblemHttpResult>> ExecuteAsync(
        AcknowledgeEquipmentEmergencyRequest req,
        CancellationToken ct)
    {
        if (!Guid.TryParse(HttpContext.ResolveAdminUserId(), out var adminId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Admin sign-in is required.", statusCode: 401);

        var result = await mediator.Send(new AcknowledgeEquipmentEmergencyCommand(req.Id, adminId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class ResolveEquipmentEmergencyRequest
{
    public Guid Id { get; set; }
}

public sealed class ResolveEquipmentEmergencyEndpoint(IMediator mediator)
    : Endpoint<ResolveEquipmentEmergencyRequest, Results<Ok<EquipmentEmergencyDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("emergencies/{Id}/resolve");
        Group<AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Results<Ok<EquipmentEmergencyDto>, ProblemHttpResult>> ExecuteAsync(
        ResolveEquipmentEmergencyRequest req,
        CancellationToken ct)
    {
        if (!Guid.TryParse(HttpContext.ResolveAdminUserId(), out var adminId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Admin sign-in is required.", statusCode: 401);

        var result = await mediator.Send(new ResolveEquipmentEmergencyCommand(req.Id, adminId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class EquipmentEmergencySettingsResponse
{
    public bool AlertVendorEnabled { get; set; }
}

public sealed class GetEquipmentEmergencySettingsEndpoint(IPlatformEmergencySettingsService settings)
    : EndpointWithoutRequest<Ok<EquipmentEmergencySettingsResponse>>
{
    public override void Configure()
    {
        Get("emergency-settings");
        Group<AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Ok<EquipmentEmergencySettingsResponse>> ExecuteAsync(CancellationToken ct)
    {
        var enabled = await settings.IsVendorAlertEnabledAsync(ct);
        return TypedResults.Ok(new EquipmentEmergencySettingsResponse { AlertVendorEnabled = enabled });
    }
}

public sealed class UpdateEquipmentEmergencySettingsRequest
{
    public bool AlertVendorEnabled { get; set; }
}

public sealed class UpdateEquipmentEmergencySettingsEndpoint(IPlatformEmergencySettingsService settings)
    : Endpoint<UpdateEquipmentEmergencySettingsRequest, Ok<EquipmentEmergencySettingsResponse>>
{
    public override void Configure()
    {
        Put("emergency-settings");
        Group<AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Ok<EquipmentEmergencySettingsResponse>> ExecuteAsync(
        UpdateEquipmentEmergencySettingsRequest req,
        CancellationToken ct)
    {
        var enabled = await settings.SetVendorAlertEnabledAsync(req.AlertVendorEnabled, ct);
        return TypedResults.Ok(new EquipmentEmergencySettingsResponse { AlertVendorEnabled = enabled });
    }
}
