using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors.Inventory;

public class VendorListingIdRequest : VendorIdRequest
{
    public Guid ListingId { get; set; }
}

public class VendorAssetIdRequest : VendorListingIdRequest
{
    public Guid AssetId { get; set; }
}

public sealed class AddVendorProductAssetRequest : VendorListingIdRequest
{
    public string AssetTag { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Condition { get; set; }
    public Guid? ProductVariantId { get; set; }
}

public sealed class UpdateVendorProductAssetRequest : VendorAssetIdRequest
{
    public string Status { get; set; } = string.Empty;
    public string? Condition { get; set; }
}

public sealed class TrackAssetRequest : VendorIdRequest
{
    public string Tag { get; set; } = string.Empty;
}

public sealed class GetVendorProductAssetsEndpoint(IMediator mediator)
    : Endpoint<VendorListingIdRequest, Results<Ok<List<VendorProductAssetDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/listings/{listingId}/assets");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorProductAssetDto>>, ProblemHttpResult>> ExecuteAsync(VendorListingIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorProductAssetsQuery(Guid.Parse(req.VendorId), req.ListingId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AddVendorProductAssetEndpoint(IMediator mediator)
    : Endpoint<AddVendorProductAssetRequest, Results<Ok<Guid>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/listings/{listingId}/assets");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<Guid>, ProblemHttpResult>> ExecuteAsync(AddVendorProductAssetRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new AddVendorProductAssetCommand(
            Guid.Parse(req.VendorId),
            req.ListingId,
            req.AssetTag,
            req.Status,
            req.Condition,
            req.ProductVariantId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateVendorProductAssetEndpoint(IMediator mediator)
    : Endpoint<UpdateVendorProductAssetRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("{vendorId}/listings/{listingId}/assets/{assetId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(UpdateVendorProductAssetRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateVendorProductAssetCommand(Guid.Parse(req.VendorId), req.ListingId, req.AssetId, req.Status, req.Condition), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class DeleteVendorProductAssetEndpoint(IMediator mediator)
    : Endpoint<VendorAssetIdRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("{vendorId}/listings/{listingId}/assets/{assetId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(VendorAssetIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteVendorProductAssetCommand(Guid.Parse(req.VendorId), req.ListingId, req.AssetId), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class TrackVendorAssetEndpoint(IMediator mediator)
    : Endpoint<TrackAssetRequest, Results<Ok<TrackedAssetDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/inventory/assets/track");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<TrackedAssetDto>, ProblemHttpResult>> ExecuteAsync(TrackAssetRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new TrackVendorAssetQuery(Guid.Parse(req.VendorId), req.Tag), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
