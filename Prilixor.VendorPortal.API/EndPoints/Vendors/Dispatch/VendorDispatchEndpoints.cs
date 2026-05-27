using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public sealed class VendorDispatchOrderRequest : VendorIdRequest
{
    public Guid OrderId { get; set; }
}

public sealed class VendorOrderExpirationsRequest : VendorIdRequest
{
    public int WithinDays { get; set; } = 7;
}

public sealed class GetVendorPendingDispatchOffersEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<List<VendorDispatchOfferDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/dispatch/offers");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorDispatchOfferDto>>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorPendingDispatchOffersQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class VendorAcceptDispatchOfferEndpoint(IMediator mediator)
    : Endpoint<VendorDispatchOrderRequest, Results<Ok<CustomerOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("{vendorId}/dispatch/orders/{orderId}/accept");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<CustomerOrderDto>, ProblemHttpResult>> ExecuteAsync(VendorDispatchOrderRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new VendorRespondDispatchOfferCommand(req.VendorId, req.OrderId, "accept"), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class VendorRejectDispatchOfferEndpoint(IMediator mediator)
    : Endpoint<VendorDispatchOrderRequest, Results<Ok<CustomerOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("{vendorId}/dispatch/orders/{orderId}/reject");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<CustomerOrderDto>, ProblemHttpResult>> ExecuteAsync(VendorDispatchOrderRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new VendorRespondDispatchOfferCommand(req.VendorId, req.OrderId, "reject"), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class VendorCancelAssignedOrderEndpoint(IMediator mediator)
    : Endpoint<VendorDispatchOrderRequest, Results<Ok<CustomerOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("{vendorId}/dispatch/orders/{orderId}/cancel");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<CustomerOrderDto>, ProblemHttpResult>> ExecuteAsync(VendorDispatchOrderRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new VendorCancelAssignedOrderCommand(req.VendorId, req.OrderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorOrderExpirationsEndpoint(IMediator mediator)
    : Endpoint<VendorOrderExpirationsRequest, Results<Ok<List<ExpiringOrderDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/orders/expirations");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<ExpiringOrderDto>>, ProblemHttpResult>> ExecuteAsync(VendorOrderExpirationsRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorOrderExpirationsQuery(req.VendorId, req.WithinDays), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
