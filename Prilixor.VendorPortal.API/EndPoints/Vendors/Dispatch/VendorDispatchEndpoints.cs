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

public sealed class VendorOrdersRequest : VendorIdRequest
{
    public string? Status { get; set; }
}

public sealed class VendorUpdateOrderStatusRequest : VendorIdRequest
{
    public Guid OrderId { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<string>? AssetTags { get; set; }
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

public sealed class GetVendorOrdersEndpoint(IMediator mediator)
    : Endpoint<VendorOrdersRequest, Results<Ok<List<VendorOrderDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/orders");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorOrderDto>>, ProblemHttpResult>> ExecuteAsync(VendorOrdersRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorOrdersQuery(req.VendorId, req.Status), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorOrderByIdEndpoint(IMediator mediator)
    : Endpoint<VendorDispatchOrderRequest, Results<Ok<VendorOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/orders/{orderId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorOrderDto>, ProblemHttpResult>> ExecuteAsync(VendorDispatchOrderRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorOrderByIdQuery(req.VendorId, req.OrderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class VendorUpdateOrderStatusEndpoint(IMediator mediator)
    : Endpoint<VendorUpdateOrderStatusRequest, Results<Ok<CustomerOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("{vendorId}/orders/{orderId}/status");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<CustomerOrderDto>, ProblemHttpResult>> ExecuteAsync(VendorUpdateOrderStatusRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateVendorOrderStatusCommand(req.VendorId, req.OrderId, req.Status, req.AssetTags), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class VendorAssignOrderAssetsRequest : VendorIdRequest
{
    public Guid OrderId { get; set; }
    public List<string> AssetTags { get; set; } = [];
}

public sealed class VendorAssignOrderAssetsEndpoint(IMediator mediator)
    : Endpoint<VendorAssignOrderAssetsRequest, Results<Ok<VendorOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("{vendorId}/orders/{orderId}/assets");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorOrderDto>, ProblemHttpResult>> ExecuteAsync(VendorAssignOrderAssetsRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new AssignVendorOrderAssetsCommand(req.VendorId, req.OrderId, req.AssetTags), ct);
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

public sealed class VendorOrderImageIdRequest : VendorIdRequest
{
    public Guid OrderId { get; set; }
    public Guid ImageId { get; set; }
}

public sealed class GetVendorOrderImageRequestEndpoint(IMediator mediator)
    : Endpoint<VendorDispatchOrderRequest, Results<Ok<CustomerOrderImageRequestDto?>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/orders/{orderId}/image-request");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<CustomerOrderImageRequestDto?>, ProblemHttpResult>> ExecuteAsync(VendorDispatchOrderRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorOrderImageRequestQuery(req.VendorId, req.OrderId), ct);
        return result.IsSuccess
            ? TypedResults.Ok<CustomerOrderImageRequestDto?>(result.Value)
            : result.ToErrorResponse();
    }
}

public sealed class UploadVendorOrderImageEndpoint(IMediator mediator)
    : Endpoint<VendorDispatchOrderRequest, Results<Ok<CustomerOrderImageDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/orders/{orderId}/images");
        Group<VendorOnboardingGroup>();
        AllowFileUploads();
    }

    public override async Task<Results<Ok<CustomerOrderImageDto>, ProblemHttpResult>> ExecuteAsync(VendorDispatchOrderRequest req, CancellationToken ct)
    {
        var file = Files.FirstOrDefault();
        if (file is null || file.Length <= 0)
            return TypedResults.Problem(title: "customers.order_images.missing_file", detail: "Image file is required.", statusCode: 400);

        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var publicBase = new Uri($"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}");

        var result = await mediator.Send(
            new UploadVendorOrderImageCommand(
                req.VendorId,
                req.OrderId,
                file.FileName,
                file.ContentType,
                ms.ToArray(),
                publicBase),
            ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteVendorOrderImageEndpoint(IMediator mediator)
    : Endpoint<VendorOrderImageIdRequest, Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("{vendorId}/orders/{orderId}/images/{imageId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(VendorOrderImageIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteVendorOrderImageCommand(req.VendorId, req.OrderId, req.ImageId), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}
