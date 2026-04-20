using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public class VendorInventoryRequest : VendorIdRequest
{
    public string ListingId { get; set; } = string.Empty;
}

public sealed class UpsertVendorInventoryRequest : VendorInventoryRequest
{
    public int TotalQuantity { get; set; }
    public int AvailableQuantity { get; set; }
    public int ReservedQuantity { get; set; }
    public int RentedQuantity { get; set; }
    public int BlockedQuantity { get; set; }
}

public sealed class AddVendorInventoryMovementRequest : VendorInventoryRequest
{
    public string MovementType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string? ReferenceType { get; set; }
    public string? ReferenceId { get; set; }
    public string? Notes { get; set; }
}

public sealed class UpsertVendorInventoryEndpoint(IMediator mediator)
    : Endpoint<UpsertVendorInventoryRequest, Results<Ok<VendorInventoryDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("{vendorId}/listings/{listingId}/inventory");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorInventoryDto>, ProblemHttpResult>> ExecuteAsync(UpsertVendorInventoryRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpsertVendorInventoryCommand(
            req.VendorId,
            req.ListingId,
            req.TotalQuantity,
            req.AvailableQuantity,
            req.ReservedQuantity,
            req.RentedQuantity,
            req.BlockedQuantity), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorInventoryEndpoint(IMediator mediator)
    : Endpoint<VendorInventoryRequest, Results<Ok<VendorInventoryDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/listings/{listingId}/inventory");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorInventoryDto>, ProblemHttpResult>> ExecuteAsync(VendorInventoryRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorInventoryQuery(req.VendorId, req.ListingId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AddVendorInventoryMovementEndpoint(IMediator mediator)
    : Endpoint<AddVendorInventoryMovementRequest, Results<Ok<VendorInventoryMovementDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/listings/{listingId}/inventory/movements");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorInventoryMovementDto>, ProblemHttpResult>> ExecuteAsync(AddVendorInventoryMovementRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new AddVendorInventoryMovementCommand(
            req.VendorId,
            req.ListingId,
            req.MovementType,
            req.Quantity,
            req.ReferenceType,
            req.ReferenceId,
            req.Notes), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorInventoryMovementsEndpoint(IMediator mediator)
    : Endpoint<VendorInventoryRequest, Results<Ok<List<VendorInventoryMovementDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/listings/{listingId}/inventory/movements");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorInventoryMovementDto>>, ProblemHttpResult>> ExecuteAsync(VendorInventoryRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorInventoryMovementsQuery(req.VendorId, req.ListingId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
