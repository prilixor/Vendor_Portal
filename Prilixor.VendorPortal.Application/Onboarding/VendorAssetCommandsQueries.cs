using FluentValidation;
using MediatR;
using Prilixor.Shared.Models;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record VendorProductAssetDto(
    Guid Id,
    Guid VendorProductListingId,
    string AssetTag,
    string Status,
    string? Condition,
    DateTimeOffset CreatedOnUtc,
    DateTimeOffset? ModifiedOnUtc);

public sealed record TrackedAssetDto(
    Guid AssetId,
    string AssetTag,
    string Status,
    string? Condition,
    string ProductName,
    Guid? CurrentOrderId,
    string? CurrentOrderNumber,
    string? CurrentCustomerName,
    DateOnly? DueDate);

public sealed record AddVendorProductAssetCommand(
    Guid VendorId,
    Guid ListingId,
    string AssetTag,
    string Status,
    string? Condition) : IRequest<Result<Guid>>;

public sealed class AddVendorProductAssetCommandValidator : AbstractValidator<AddVendorProductAssetCommand>
{
    public AddVendorProductAssetCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
        RuleFor(x => x.AssetTag).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Status).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Condition).MaximumLength(200);
    }
}

internal sealed class AddVendorProductAssetCommandHandler(IVendorOnboardingRepository repository)
    : IRequestHandler<AddVendorProductAssetCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(AddVendorProductAssetCommand request, CancellationToken cancellationToken)
    {
        var listing = await repository.GetVendorProductListingByIdAsync(request.VendorId, request.ListingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure<Guid>(new Error("Listing.NotFound", "The listing was not found."));
        }

        var existingAsset = await repository.GetVendorProductAssetByTagGlobalAsync(request.VendorId, request.AssetTag, cancellationToken);
        if (existingAsset is not null)
        {
            if (existingAsset.VendorProductListingId == request.ListingId)
            {
                return Result.Failure<Guid>(new Error("vendors.inventory.asset_duplicate", $"Asset tag {request.AssetTag} already exists for this product."));
            }
            else
            {
                return Result.Failure<Guid>(new Error("vendors.inventory.asset_duplicate_global", $"Asset tag {request.AssetTag} already belongs to another product ({existingAsset.VendorProductListing?.ListingTitle ?? "Unknown"})."));
            }
        }

        var asset = new VendorProductAsset
        {
            VendorProductListingId = request.ListingId,
            AssetTag = request.AssetTag,
            Status = request.Status,
            Condition = request.Condition,
            CreatedBy = request.VendorId
        };

        await repository.AddVendorProductAssetAsync(asset, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(asset.Id);
    }
}

public sealed record GetVendorProductAssetsQuery(Guid VendorId, Guid ListingId) : IRequest<Result<List<VendorProductAssetDto>>>;

internal sealed class GetVendorProductAssetsQueryHandler(IVendorOnboardingRepository repository)
    : IRequestHandler<GetVendorProductAssetsQuery, Result<List<VendorProductAssetDto>>>
{
    public async Task<Result<List<VendorProductAssetDto>>> Handle(GetVendorProductAssetsQuery request, CancellationToken cancellationToken)
    {
        var listing = await repository.GetVendorProductListingByIdAsync(request.VendorId, request.ListingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure<List<VendorProductAssetDto>>(new Error("Listing.NotFound", "The listing was not found."));
        }

        var assets = await repository.GetVendorProductAssetsAsync(request.ListingId, cancellationToken);

        var dtos = assets.ConvertAll(x => new VendorProductAssetDto(
            x.Id,
            x.VendorProductListingId,
            x.AssetTag,
            x.Status,
            x.Condition,
            x.CreatedOnUtc,
            x.ModifiedOnUtc));

        return Result.Success(dtos);
    }
}

public sealed record UpdateVendorProductAssetCommand(
    Guid VendorId,
    Guid ListingId,
    Guid AssetId,
    string Status,
    string? Condition) : IRequest<Result>;

public sealed class UpdateVendorProductAssetCommandValidator : AbstractValidator<UpdateVendorProductAssetCommand>
{
    public UpdateVendorProductAssetCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
        RuleFor(x => x.AssetId).NotEmpty();
        RuleFor(x => x.Status).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Condition).MaximumLength(200);
    }
}

internal sealed class UpdateVendorProductAssetCommandHandler(IVendorOnboardingRepository repository)
    : IRequestHandler<UpdateVendorProductAssetCommand, Result>
{
    public async Task<Result> Handle(UpdateVendorProductAssetCommand request, CancellationToken cancellationToken)
    {
        var listing = await repository.GetVendorProductListingByIdAsync(request.VendorId, request.ListingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure(new Error("Listing.NotFound", "The listing was not found."));
        }

        var asset = await repository.GetVendorProductAssetByIdAsync(request.AssetId, cancellationToken);
        if (asset is null || asset.VendorProductListingId != request.ListingId)
        {
            return Result.Failure(new Error("Asset.NotFound", "The asset was not found."));
        }

        asset.Status = request.Status;
        asset.Condition = request.Condition;

        await repository.UpdateVendorProductAssetAsync(asset, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

public sealed record DeleteVendorProductAssetCommand(
    Guid VendorId,
    Guid ListingId,
    Guid AssetId) : IRequest<Result>;

internal sealed class DeleteVendorProductAssetCommandHandler(IVendorOnboardingRepository repository)
    : IRequestHandler<DeleteVendorProductAssetCommand, Result>
{
    public async Task<Result> Handle(DeleteVendorProductAssetCommand request, CancellationToken cancellationToken)
    {
        var listing = await repository.GetVendorProductListingByIdAsync(request.VendorId, request.ListingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure(new Error("Listing.NotFound", "The listing was not found."));
        }

        var asset = await repository.GetVendorProductAssetByIdAsync(request.AssetId, cancellationToken);
        if (asset is null || asset.VendorProductListingId != request.ListingId)
        {
            return Result.Failure(new Error("Asset.NotFound", "The asset was not found."));
        }

        asset.IsDeleted = true;
        asset.DeletedAt = DateTimeOffset.UtcNow;
        asset.DeletedBy = request.VendorId;

        await repository.UpdateVendorProductAssetAsync(asset, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

public sealed record TrackVendorAssetQuery(Guid VendorId, string AssetTag) : IRequest<Result<TrackedAssetDto>>;

public sealed class TrackVendorAssetQueryValidator : AbstractValidator<TrackVendorAssetQuery>
{
    public TrackVendorAssetQueryValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.AssetTag).NotEmpty();
    }
}

internal sealed class TrackVendorAssetQueryHandler(
    IVendorOnboardingRepository vendorRepository,
    ICustomerRepository customerRepository)
    : IRequestHandler<TrackVendorAssetQuery, Result<TrackedAssetDto>>
{
    public async Task<Result<TrackedAssetDto>> Handle(TrackVendorAssetQuery request, CancellationToken cancellationToken)
    {
        var asset = await vendorRepository.GetVendorProductAssetByTagGlobalAsync(request.VendorId, request.AssetTag, cancellationToken);
        if (asset is null)
        {
            return Result.Failure<TrackedAssetDto>(new Error("Asset.NotFound", "The asset was not found."));
        }

        Guid? currentOrderId = null;
        string? currentOrderNumber = null;
        string? currentCustomerName = null;
        DateOnly? dueDate = null;

        var activeOrder = await customerRepository.GetActiveCustomerOrderForAssetAsync(asset.Id, cancellationToken);
        if (activeOrder is not null)
        {
            currentOrderId = activeOrder.Order.Id;
            currentOrderNumber = activeOrder.Order.OrderNumber;
            currentCustomerName = activeOrder.Order.Customer?.FullName;
            if (string.IsNullOrWhiteSpace(currentCustomerName)) currentCustomerName = "Unknown Customer";
            
            dueDate = activeOrder.Order.EndDate;
        }

        var dto = new TrackedAssetDto(
            asset.Id,
            asset.AssetTag,
            asset.Status,
            asset.Condition,
            asset.VendorProductListing?.ListingTitle ?? "Unknown Product",
            currentOrderId,
            currentOrderNumber,
            currentCustomerName,
            dueDate
        );

        return Result.Success(dto);
    }
}
