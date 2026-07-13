using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

/// <summary>
/// Request body for upserting variant-level inventory.
/// </summary>
public sealed class UpsertVariantInventoryRequest : VendorInventoryRequest
{
    /// <summary>One item per packaging size (variant) the vendor wants to update.</summary>
    public List<UpsertVariantInventoryItemDto> Items { get; set; } = [];
}

/// <summary>
/// GET /vendors/{vendorId}/listings/{listingId}/variant-inventory
/// Returns the current per-SKU stock levels for a chemical listing.
/// </summary>
public sealed class GetVariantInventoryEndpoint(IMediator mediator)
    : Endpoint<VendorInventoryRequest, Results<Ok<List<VendorVariantInventoryDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/listings/{listingId}/variant-inventory");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorVariantInventoryDto>>, ProblemHttpResult>> ExecuteAsync(VendorInventoryRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVariantInventoryQuery(req.VendorId, req.ListingId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

/// <summary>
/// PUT /vendors/{vendorId}/listings/{listingId}/variant-inventory
/// Vendor sets stock quantities for each packaging size (SKU) on a chemical listing.
/// </summary>
public sealed class UpsertVariantInventoryEndpoint(IMediator mediator)
    : Endpoint<UpsertVariantInventoryRequest, Results<Ok<List<VendorVariantInventoryDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("{vendorId}/listings/{listingId}/variant-inventory");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorVariantInventoryDto>>, ProblemHttpResult>> ExecuteAsync(UpsertVariantInventoryRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpsertVariantInventoryCommand(
            req.VendorId,
            req.ListingId,
            req.Items), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
