using System.Security.Claims;
using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;
using Prilixor.VendorPortal.API.EndPoints.Vendors;
using Prilixor.VendorPortal.API.Extensions;

public sealed class AdminApproveExtensionRequest : Prilixor.VendorPortal.API.EndPoints.Vendors.AdminUserIdRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string ExtensionId { get; set; } = string.Empty;
    public int? OverrideAdditionalDays { get; set; }
    public decimal? OverrideExtensionAmount { get; set; }
    public decimal? OverrideServiceFeeAmount { get; set; }
    public decimal? OverrideGstAmount { get; set; }
    public decimal? OverrideTotalAmount { get; set; }
}

public sealed class AdminApproveExtensionEndpoint(IMediator mediator)
    : Endpoint<AdminApproveExtensionRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("orders/{OrderId}/extensions/{ExtensionId}/approve");
        Group<Prilixor.VendorPortal.API.EndPoints.Vendors.AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(AdminApproveExtensionRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(req.AdminUserId, out var adminId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid admin ID.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId) || !Guid.TryParse(req.ExtensionId, out var extensionId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid identifiers.", statusCode: 400);

        var cmd = new ApproveExtensionCommand(
            orderId, extensionId, adminId, "admin",
            req.OverrideAdditionalDays, req.OverrideExtensionAmount, req.OverrideServiceFeeAmount,
            req.OverrideGstAmount, req.OverrideTotalAmount);

        var result = await mediator.Send(cmd, ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class AdminCancelExtensionRequest : Prilixor.VendorPortal.API.EndPoints.Vendors.AdminUserIdRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string ExtensionId { get; set; } = string.Empty;
}

public sealed class AdminCancelExtensionEndpoint(IMediator mediator)
    : Endpoint<AdminCancelExtensionRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("orders/{OrderId}/extensions/{ExtensionId}/cancel");
        Group<Prilixor.VendorPortal.API.EndPoints.Vendors.AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(AdminCancelExtensionRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(req.AdminUserId, out var adminId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid admin ID.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId) || !Guid.TryParse(req.ExtensionId, out var extensionId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid identifiers.", statusCode: 400);

        var result = await mediator.Send(new CancelExtensionCommand(orderId, extensionId, adminId, "admin"), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class AdminApproveBuyoutRequest : Prilixor.VendorPortal.API.EndPoints.Vendors.AdminUserIdRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string BuyoutId { get; set; } = string.Empty;
    public decimal? OverrideBaseBuyoutAmount { get; set; }
    public decimal? OverrideRentDeductionAmount { get; set; }
    public decimal? OverrideServiceFeeAmount { get; set; }
    public decimal? OverrideGstAmount { get; set; }
    public decimal? OverrideTotalAmount { get; set; }
}

public sealed class AdminApproveBuyoutEndpoint(IMediator mediator)
    : Endpoint<AdminApproveBuyoutRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("orders/{OrderId}/buyouts/{BuyoutId}/approve");
        Group<Prilixor.VendorPortal.API.EndPoints.Vendors.AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(AdminApproveBuyoutRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(req.AdminUserId, out var adminId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid admin ID.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId) || !Guid.TryParse(req.BuyoutId, out var buyoutId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid identifiers.", statusCode: 400);

        var cmd = new ApproveBuyoutCommand(
            orderId, buyoutId, adminId, "admin",
            req.OverrideBaseBuyoutAmount, req.OverrideRentDeductionAmount, req.OverrideServiceFeeAmount,
            req.OverrideGstAmount, req.OverrideTotalAmount);

        var result = await mediator.Send(cmd, ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class AdminCancelBuyoutRequest : Prilixor.VendorPortal.API.EndPoints.Vendors.AdminUserIdRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string BuyoutId { get; set; } = string.Empty;
}

public sealed class AdminCancelBuyoutEndpoint(IMediator mediator)
    : Endpoint<AdminCancelBuyoutRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("orders/{OrderId}/buyouts/{BuyoutId}/cancel");
        Group<Prilixor.VendorPortal.API.EndPoints.Vendors.AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin"));
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(AdminCancelBuyoutRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(req.AdminUserId, out var adminId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid admin ID.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId) || !Guid.TryParse(req.BuyoutId, out var buyoutId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid identifiers.", statusCode: 400);

        var result = await mediator.Send(new CancelBuyoutCommand(orderId, buyoutId, adminId, "admin"), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class GetAdminOrderContinuationsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<OrderContinuationsDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("orders/{OrderId}/continuations");
        Group<Prilixor.VendorPortal.API.EndPoints.Vendors.AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin Orders"));
    }

    public override async Task<Results<Ok<OrderContinuationsDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var orderIdStr = Route<string>("OrderId");
        if (string.IsNullOrEmpty(orderIdStr) || !Guid.TryParse(orderIdStr, out var orderId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid identifiers.", statusCode: 400);

        var result = await mediator.Send(new GetOrderContinuationsQuery(orderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminAllPendingContinuationsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<Prilixor.VendorPortal.Application.Onboarding.AdminPendingContinuationDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("orders/continuations/pending");
        Group<Prilixor.VendorPortal.API.EndPoints.Vendors.AdminApiGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Admin Orders"));
    }

    public override async Task<Results<Ok<List<Prilixor.VendorPortal.Application.Onboarding.AdminPendingContinuationDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new Prilixor.VendorPortal.Application.Onboarding.GetAdminAllPendingContinuationsQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
