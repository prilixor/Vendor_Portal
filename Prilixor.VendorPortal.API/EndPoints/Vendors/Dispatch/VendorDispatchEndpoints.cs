using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Customers;
using Prilixor.VendorPortal.Application.Onboarding;

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
    public decimal DamageAmount { get; set; }
    public string? DamageReason { get; set; }
    public List<string>? AssetTags { get; set; }
}

public sealed class GetVendorOrderSummariesRequest : VendorIdRequest
{
    public string? Search { get; set; }
    public string? Status { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 8;
}

public sealed class GetVendorExpirationSummariesRequest : VendorIdRequest
{
    public int WithinDays { get; set; } = 7;
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 8;
}

public sealed class GetVendorDispatchOfferSummariesRequest : VendorIdRequest
{
    public string? Search { get; set; }
    public string? OrderType { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 8;
}

public sealed class GetVendorOrderSummariesEndpoint(IMediator mediator)
    : Endpoint<GetVendorOrderSummariesRequest, Results<Ok<VendorOrderListResult>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/orders/summaries");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorOrderListResult>, ProblemHttpResult>> ExecuteAsync(
        GetVendorOrderSummariesRequest req,
        CancellationToken ct)
    {
        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = req.PageSize is < 1 or > 50 ? 8 : req.PageSize;
        var result = await mediator.Send(
            new GetVendorOrderListQuery(req.VendorId, req.Search, req.Status, page, pageSize),
            ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorOrderGroupEndpoint(IMediator mediator)
    : Endpoint<VendorDispatchOrderRequest, Results<Ok<List<VendorOrderDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/orders/{orderId:guid}/group");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorOrderDto>>, ProblemHttpResult>> ExecuteAsync(
        VendorDispatchOrderRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorOrderGroupQuery(req.VendorId, req.OrderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorExpirationSummariesEndpoint(IMediator mediator)
    : Endpoint<GetVendorExpirationSummariesRequest, Results<Ok<VendorExpirationListResult>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/orders/expirations/summaries");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorExpirationListResult>, ProblemHttpResult>> ExecuteAsync(
        GetVendorExpirationSummariesRequest req,
        CancellationToken ct)
    {
        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = req.PageSize is < 1 or > 50 ? 8 : req.PageSize;
        var withinDays = req.WithinDays is < 1 or > 60 ? 7 : req.WithinDays;
        var result = await mediator.Send(
            new GetVendorExpirationListQuery(req.VendorId, withinDays, req.Search, page, pageSize),
            ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorDispatchOfferSummariesEndpoint(IMediator mediator)
    : Endpoint<GetVendorDispatchOfferSummariesRequest, Results<Ok<VendorDispatchOfferListResult>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/dispatch/offers/summaries");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorDispatchOfferListResult>, ProblemHttpResult>> ExecuteAsync(
        GetVendorDispatchOfferSummariesRequest req,
        CancellationToken ct)
    {
        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = req.PageSize is < 1 or > 50 ? 8 : req.PageSize;
        var result = await mediator.Send(
            new GetVendorDispatchOfferListQuery(req.VendorId, req.Search, req.OrderType, page, pageSize),
            ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorPendingDispatchOfferCountEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<int>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/dispatch/offers/pending-count");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<int>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorPendingDispatchOfferCountQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
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
        var result = await mediator.Send(new UpdateVendorOrderStatusCommand(
            req.VendorId,
            req.OrderId,
            req.Status,
            req.AssetTags,
            req.DamageAmount,
            req.DamageReason), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class VendorMarkReturnedRequest : VendorIdRequest
{
    public Guid OrderId { get; set; }
    public decimal DamageAmount { get; set; }
    public string? DamageReason { get; set; }
}

public sealed class VendorMarkReturnedEndpoint(IMediator mediator)
    : Endpoint<VendorMarkReturnedRequest, Results<Ok<CustomerOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/orders/{orderId}/return");
        Group<VendorOnboardingGroup>();
        AllowFileUploads();
    }

    public override async Task<Results<Ok<CustomerOrderDto>, ProblemHttpResult>> ExecuteAsync(VendorMarkReturnedRequest req, CancellationToken ct)
    {
        if (req.DamageAmount <= 0
            && decimal.TryParse(HttpContext.Request.Form["damageAmount"], System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var parsedAmount))
            req.DamageAmount = parsedAmount;
        if (string.IsNullOrWhiteSpace(req.DamageReason))
            req.DamageReason = HttpContext.Request.Form["damageReason"].ToString();

        var uploads = Files.Where(file => file.Length > 0).ToList();
        if (uploads.Count > OrderReturns.MaxDamageImages)
        {
            return TypedResults.Problem(
                title: "orders.return.too_many_photos",
                detail: "You can add up to 3 damage photos.",
                statusCode: 400);
        }

        var photos = new List<ReturnDamagePhoto>(uploads.Count);
        foreach (var file in uploads)
        {
            await using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            photos.Add(new ReturnDamagePhoto(file.FileName, file.ContentType, ms.ToArray()));
        }

        var publicBase = new Uri($"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}");
        var result = await mediator.Send(new UpdateVendorOrderStatusCommand(
            req.VendorId,
            req.OrderId,
            "returned",
            DamageAmount: req.DamageAmount,
            DamageReason: req.DamageReason,
            DamagePhotos: photos,
            RequestPublicBaseUri: publicBase), ct);
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

public sealed class VendorUploadOrderImageRequest : VendorIdRequest
{
    public Guid OrderId { get; set; }
    public Guid OptionId { get; set; }
    public int? SlotIndex { get; set; }
}

public sealed class VendorOrderImageIdRequest : VendorIdRequest
{
    public Guid OrderId { get; set; }
    public Guid ImageId { get; set; }
}

public sealed class VendorOrderImageOptionRequest : VendorIdRequest
{
    public Guid OrderId { get; set; }
    public Guid OptionId { get; set; }
    public string? Description { get; set; }
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
    : Endpoint<VendorUploadOrderImageRequest, Results<Ok<CustomerOrderImageDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/orders/{orderId}/images");
        Group<VendorOnboardingGroup>();
        AllowFileUploads();
    }

    public override async Task<Results<Ok<CustomerOrderImageDto>, ProblemHttpResult>> ExecuteAsync(VendorUploadOrderImageRequest req, CancellationToken ct)
    {
        var file = Files.FirstOrDefault();
        if (file is null || file.Length <= 0)
            return TypedResults.Problem(title: "customers.order_images.missing_file", detail: "Image file is required.", statusCode: 400);

        if (req.OptionId == Guid.Empty
            && Guid.TryParse(HttpContext.Request.Query["optionId"], out var queryOptionId))
            req.OptionId = queryOptionId;

        if (req.OptionId == Guid.Empty
            && Guid.TryParse(HttpContext.Request.Form["optionId"], out var formOptionId))
            req.OptionId = formOptionId;

        if (req.OptionId == Guid.Empty)
            return TypedResults.Problem(title: "customers.order_images.option_required", detail: "optionId is required.", statusCode: 400);

        if (req.SlotIndex is null
            && int.TryParse(HttpContext.Request.Query["slotIndex"], out var querySlot))
            req.SlotIndex = querySlot;

        if (req.SlotIndex is null
            && int.TryParse(HttpContext.Request.Form["slotIndex"], out var formSlot))
            req.SlotIndex = formSlot;

        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var publicBase = new Uri($"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}");

        var result = await mediator.Send(
            new UploadVendorOrderImageCommand(
                req.VendorId,
                req.OrderId,
                req.OptionId,
                file.FileName,
                file.ContentType,
                ms.ToArray(),
                publicBase,
                req.SlotIndex),
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

public sealed class UpdateVendorOrderImageOptionEndpoint(IMediator mediator)
    : Endpoint<VendorOrderImageOptionRequest, Results<Ok<CustomerOrderImageRequestDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("{vendorId}/orders/{orderId}/image-options/{optionId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<CustomerOrderImageRequestDto>, ProblemHttpResult>> ExecuteAsync(VendorOrderImageOptionRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(
            new UpdateVendorOrderImageOptionCommand(req.VendorId, req.OrderId, req.OptionId, req.Description),
            ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorOrderPrescriptionsEndpoint(IMediator mediator)
    : Endpoint<VendorDispatchOrderRequest, Results<Ok<IReadOnlyList<CustomerPrescriptionFileDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/orders/{orderId}/prescriptions");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<IReadOnlyList<CustomerPrescriptionFileDto>>, ProblemHttpResult>> ExecuteAsync(
        VendorDispatchOrderRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorOrderPrescriptionsQuery(req.VendorId, req.OrderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
