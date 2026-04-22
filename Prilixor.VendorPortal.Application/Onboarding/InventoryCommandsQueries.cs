using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record UpsertVendorInventoryCommand(
    string VendorId,
    string ListingId,
    int TotalQuantity,
    int AvailableQuantity,
    int ReservedQuantity,
    int RentedQuantity,
    int BlockedQuantity) : ICommand<VendorInventoryDto>;

public sealed class UpsertVendorInventoryCommandValidator : AbstractValidator<UpsertVendorInventoryCommand>
{
    public UpsertVendorInventoryCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
        RuleFor(x => x.TotalQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.AvailableQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ReservedQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.RentedQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.BlockedQuantity).GreaterThanOrEqualTo(0);
    }
}

internal sealed class UpsertVendorInventoryCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpsertVendorInventoryCommand, VendorInventoryDto>
{
    public async Task<Result<VendorInventoryDto>> Handle(UpsertVendorInventoryCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId) || !Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure<VendorInventoryDto>(new Error("vendors.inventory.invalid_id", "Vendor/listing id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (request.AvailableQuantity + request.ReservedQuantity + request.RentedQuantity + request.BlockedQuantity > request.TotalQuantity)
        {
            return Result.Failure<VendorInventoryDto>(new Error("vendors.inventory.invalid_totals", "Inventory bucket sum cannot exceed total quantity.", ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure<VendorInventoryDto>(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        var entity = await repository.GetVendorInventoryByListingIdAsync(listingId, cancellationToken)
            ?? new VendorInventory { VendorProductListingId = listingId };

        entity.TotalQuantity = request.TotalQuantity;
        entity.AvailableQuantity = request.AvailableQuantity;
        entity.ReservedQuantity = request.ReservedQuantity;
        entity.RentedQuantity = request.RentedQuantity;
        entity.BlockedQuantity = request.BlockedQuantity;

        await repository.UpsertVendorInventoryAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorInventoryDto(
            entity.Id.ToString(),
            entity.VendorProductListingId.ToString(),
            entity.TotalQuantity,
            entity.AvailableQuantity,
            entity.ReservedQuantity,
            entity.RentedQuantity,
            entity.BlockedQuantity));
    }
}

public sealed record GetVendorInventoryQuery(string VendorId, string ListingId) : IQuery<VendorInventoryDto>;

internal sealed class GetVendorInventoryQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorInventoryQuery, VendorInventoryDto>
{
    public async Task<Result<VendorInventoryDto>> Handle(GetVendorInventoryQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId) || !Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure<VendorInventoryDto>(new Error("vendors.inventory.invalid_id", "Vendor/listing id must be a valid UUID.", ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure<VendorInventoryDto>(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        var entity = await repository.GetVendorInventoryByListingIdAsync(listingId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<VendorInventoryDto>(new Error("vendors.inventory.not_found", "Vendor inventory not found.", ErrorCategory.NotFound));
        }

        return Result.Success(new VendorInventoryDto(
            entity.Id.ToString(),
            entity.VendorProductListingId.ToString(),
            entity.TotalQuantity,
            entity.AvailableQuantity,
            entity.ReservedQuantity,
            entity.RentedQuantity,
            entity.BlockedQuantity));
    }
}

public sealed record AddVendorInventoryMovementCommand(
    string VendorId,
    string ListingId,
    string MovementType,
    int Quantity,
    string? ReferenceType,
    string? ReferenceId,
    string? Notes) : ICommand<VendorInventoryMovementDto>;

public sealed class AddVendorInventoryMovementCommandValidator : AbstractValidator<AddVendorInventoryMovementCommand>
{
    private static readonly string[] AllowedMovementTypes =
    [
        "stock_added",
        "stock_removed",
        "reserved",
        "reservation_released",
        "rented",
        "returned",
        "blocked",
        "unblocked",
        "corrected",
        "in",
        "out",
        "released"
    ];

    public AddVendorInventoryMovementCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
        RuleFor(x => x.MovementType)
            .NotEmpty()
            .MaximumLength(40)
            .Must(x => AllowedMovementTypes.Contains(x.Trim().ToLowerInvariant()))
            .WithMessage("Movement type is invalid.");
        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}

internal sealed class AddVendorInventoryMovementCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<AddVendorInventoryMovementCommand, VendorInventoryMovementDto>
{
    public async Task<Result<VendorInventoryMovementDto>> Handle(AddVendorInventoryMovementCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId) || !Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure<VendorInventoryMovementDto>(new Error("vendors.inventory.invalid_id", "Vendor/listing id must be a valid UUID.", ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure<VendorInventoryMovementDto>(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        var inventory = await repository.GetVendorInventoryByListingIdAsync(listingId, cancellationToken);
        if (inventory is null)
        {
            return Result.Failure<VendorInventoryMovementDto>(new Error("vendors.inventory.not_found", "Vendor inventory not found.", ErrorCategory.NotFound));
        }

        Guid? referenceId = null;
        if (!string.IsNullOrWhiteSpace(request.ReferenceId))
        {
            if (!Guid.TryParse(request.ReferenceId, out var parsedReferenceId))
            {
                return Result.Failure<VendorInventoryMovementDto>(new Error("vendors.inventory.invalid_reference_id", "Reference id must be a valid UUID.", ErrorCategory.Validation));
            }

            referenceId = parsedReferenceId;
        }

        var movement = new VendorInventoryMovement
        {
            VendorInventoryId = inventory.Id,
            MovementType = NormalizeMovementType(request.MovementType),
            Quantity = request.Quantity,
            ReferenceType = request.ReferenceType,
            ReferenceId = referenceId,
            Notes = request.Notes
        };

        await repository.AddVendorInventoryMovementAsync(movement, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorInventoryMovementDto(
            movement.Id.ToString(),
            movement.VendorInventoryId.ToString(),
            movement.MovementType,
            movement.Quantity,
            movement.ReferenceType,
            movement.ReferenceId?.ToString(),
            movement.Notes,
            ToSafeCreatedAt(movement.CreatedOnUtc)));
    }

    private static string NormalizeMovementType(string movementType)
    {
        var normalized = movementType.Trim().ToLowerInvariant();
        return normalized switch
        {
            "in" => "stock_added",
            "out" => "stock_removed",
            "released" => "reservation_released",
            _ => normalized
        };
    }

    private static DateTimeOffset ToSafeCreatedAt(DateTime createdOnUtc)
    {
        if (createdOnUtc <= DateTime.MinValue.AddDays(1))
        {
            return DateTimeOffset.UtcNow;
        }

        var utc = DateTime.SpecifyKind(createdOnUtc, DateTimeKind.Utc);
        return new DateTimeOffset(utc, TimeSpan.Zero);
    }
}

public sealed record GetVendorInventoryMovementsQuery(string VendorId, string ListingId) : IQuery<List<VendorInventoryMovementDto>>;

internal sealed class GetVendorInventoryMovementsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorInventoryMovementsQuery, List<VendorInventoryMovementDto>>
{
    public async Task<Result<List<VendorInventoryMovementDto>>> Handle(GetVendorInventoryMovementsQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId) || !Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure<List<VendorInventoryMovementDto>>(new Error("vendors.inventory.invalid_id", "Vendor/listing id must be a valid UUID.", ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure<List<VendorInventoryMovementDto>>(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        var inventory = await repository.GetVendorInventoryByListingIdAsync(listingId, cancellationToken);
        if (inventory is null)
        {
            return Result.Failure<List<VendorInventoryMovementDto>>(new Error("vendors.inventory.not_found", "Vendor inventory not found.", ErrorCategory.NotFound));
        }

        var rows = await repository.GetVendorInventoryMovementsAsync(inventory.Id, cancellationToken);
        var result = rows.Select(x => new VendorInventoryMovementDto(
            x.Id.ToString(),
            x.VendorInventoryId.ToString(),
            x.MovementType,
            x.Quantity,
            x.ReferenceType,
            x.ReferenceId?.ToString(),
            x.Notes,
            ToSafeCreatedAt(x.CreatedOnUtc))).ToList();

        return Result.Success(result);
    }

    private static DateTimeOffset ToSafeCreatedAt(DateTime createdOnUtc)
    {
        if (createdOnUtc <= DateTime.MinValue.AddDays(1))
        {
            return DateTimeOffset.UtcNow;
        }

        var utc = DateTime.SpecifyKind(createdOnUtc, DateTimeKind.Utc);
        return new DateTimeOffset(utc, TimeSpan.Zero);
    }
}
