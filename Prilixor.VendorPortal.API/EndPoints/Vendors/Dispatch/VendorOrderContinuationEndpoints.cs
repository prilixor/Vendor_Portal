using System.Security.Claims;
using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors.Dispatch;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.API.EndPoints.Vendors;

public sealed class VendorApproveExtensionRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string ExtensionId { get; set; } = string.Empty;
    public int? OverrideAdditionalDays { get; set; }
    public decimal? OverrideExtensionAmount { get; set; }
    public decimal? OverrideServiceFeeAmount { get; set; }
    public decimal? OverrideGstAmount { get; set; }
    public decimal? OverrideTotalAmount { get; set; }
}

public sealed class VendorApproveExtensionEndpoint(IMediator mediator)
    : Endpoint<VendorApproveExtensionRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders/{OrderId}/extensions/{ExtensionId}/approve");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("VendorOnly");
        Group<VendorOnboardingGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Vendor Dispatch"));
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(VendorApproveExtensionRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var vendorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId) || !Guid.TryParse(req.ExtensionId, out var extensionId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid identifiers.", statusCode: 400);

        var cmd = new ApproveExtensionCommand(
            orderId, extensionId, vendorId, "vendor",
            req.OverrideAdditionalDays, req.OverrideExtensionAmount, req.OverrideServiceFeeAmount,
            req.OverrideGstAmount, req.OverrideTotalAmount);

        var result = await mediator.Send(cmd, ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class VendorCancelExtensionRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string ExtensionId { get; set; } = string.Empty;
}

public sealed class VendorCancelExtensionEndpoint(IMediator mediator)
    : Endpoint<VendorCancelExtensionRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders/{OrderId}/extensions/{ExtensionId}/cancel");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("VendorOnly");
        Group<VendorOnboardingGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Vendor Dispatch"));
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(VendorCancelExtensionRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var vendorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId) || !Guid.TryParse(req.ExtensionId, out var extensionId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid identifiers.", statusCode: 400);

        var result = await mediator.Send(new CancelExtensionCommand(orderId, extensionId, vendorId, "vendor"), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class VendorApproveBuyoutRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string BuyoutId { get; set; } = string.Empty;
    public decimal? OverrideBaseBuyoutAmount { get; set; }
    public decimal? OverrideRentDeductionAmount { get; set; }
    public decimal? OverrideServiceFeeAmount { get; set; }
    public decimal? OverrideGstAmount { get; set; }
    public decimal? OverrideTotalAmount { get; set; }
}

public sealed class VendorApproveBuyoutEndpoint(IMediator mediator)
    : Endpoint<VendorApproveBuyoutRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders/{OrderId}/buyouts/{BuyoutId}/approve");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("VendorOnly");
        Group<VendorOnboardingGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Vendor Dispatch"));
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(VendorApproveBuyoutRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var vendorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId) || !Guid.TryParse(req.BuyoutId, out var buyoutId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid identifiers.", statusCode: 400);

        var cmd = new ApproveBuyoutCommand(
            orderId, buyoutId, vendorId, "vendor",
            req.OverrideBaseBuyoutAmount, req.OverrideRentDeductionAmount, req.OverrideServiceFeeAmount,
            req.OverrideGstAmount, req.OverrideTotalAmount);

        var result = await mediator.Send(cmd, ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class VendorCancelBuyoutRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string BuyoutId { get; set; } = string.Empty;
}

public sealed class VendorCancelBuyoutEndpoint(IMediator mediator)
    : Endpoint<VendorCancelBuyoutRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders/{OrderId}/buyouts/{BuyoutId}/cancel");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("VendorOnly");
        Group<VendorOnboardingGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Vendor Dispatch"));
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(VendorCancelBuyoutRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var vendorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId) || !Guid.TryParse(req.BuyoutId, out var buyoutId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid identifiers.", statusCode: 400);

        var result = await mediator.Send(new CancelBuyoutCommand(orderId, buyoutId, vendorId, "vendor"), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class GetVendorOrderContinuationsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<OrderContinuationsDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/orders/{OrderId}/continuations");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("VendorOnly");
        Group<VendorOnboardingGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Vendor Dispatch"));
    }

    public override async Task<Results<Ok<OrderContinuationsDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var vendorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var orderIdStr = Route<string>("OrderId");
        if (string.IsNullOrEmpty(orderIdStr) || !Guid.TryParse(orderIdStr, out var orderId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid identifiers.", statusCode: 400);

        var result = await mediator.Send(new GetOrderContinuationsQuery(orderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
