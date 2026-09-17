using FluentValidation;
using Microsoft.Extensions.Options;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record CustomerOrderImageDto(
    Guid Id,
    Guid OrderId,
    Guid? RequestId,
    string FileUrl,
    string? OriginalFileName,
    string? ContentType,
    int SortOrder,
    DateTimeOffset CreatedAt,
    Guid? OptionId = null);

public sealed record CustomerOrderImageOptionDto(
    Guid Id,
    int OptionNumber,
    string Label,
    string? Description,
    List<CustomerOrderImageDto> Images);

public sealed record CustomerOrderImageRequestDto(
    Guid Id,
    Guid OrderId,
    Guid VendorId,
    string Status,
    string Message,
    DateTimeOffset RequestedAt,
    List<CustomerOrderImageDto> Images,
    List<CustomerOrderImageOptionDto>? Options = null,
    int OptionCount = 3,
    int MaxImagesPerOption = 3,
    int MaxDescriptionLength = 500,
    Guid? SelectedOptionId = null);

public sealed record GetCustomerOrderImageRequestQuery(Guid CustomerId, Guid OrderId)
    : IQuery<CustomerOrderImageRequestDto?>;

public sealed record CreateCustomerOrderImageRequestCommand(Guid CustomerId, Guid OrderId)
    : ICommand<CustomerOrderImageRequestDto>;

public sealed record SelectCustomerOrderImageOptionCommand(Guid CustomerId, Guid OrderId, Guid OptionId)
    : ICommand<CustomerOrderImageRequestDto>;

public sealed record GetVendorOrderImageRequestQuery(string VendorId, Guid OrderId)
    : IQuery<CustomerOrderImageRequestDto?>;

public sealed record UploadVendorOrderImageCommand(
    string VendorId,
    Guid OrderId,
    Guid OptionId,
    string OriginalFileName,
    string? ContentType,
    byte[] FileBytes,
    Uri RequestPublicBaseUri,
    int? SlotIndex = null) : ICommand<CustomerOrderImageDto>;

public sealed record DeleteVendorOrderImageCommand(string VendorId, Guid OrderId, Guid ImageId) : ICommand;

public sealed record UpdateVendorOrderImageOptionCommand(
    string VendorId,
    Guid OrderId,
    Guid OptionId,
    string? Description) : ICommand<CustomerOrderImageRequestDto>;

public sealed class CreateCustomerOrderImageRequestCommandValidator : AbstractValidator<CreateCustomerOrderImageRequestCommand>
{
    public CreateCustomerOrderImageRequestCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.OrderId).NotEmpty();
    }
}

public sealed class UploadVendorOrderImageCommandValidator : AbstractValidator<UploadVendorOrderImageCommand>
{
    public UploadVendorOrderImageCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.OptionId).NotEmpty();
        RuleFor(x => x.OriginalFileName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.FileBytes).NotEmpty();
        RuleFor(x => x.RequestPublicBaseUri).NotNull();
    }
}

internal static class CustomerOrderImageRules
{
    public const long MaxBytes = 5 * 1024 * 1024;

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
    };

    private static readonly HashSet<string> ActiveRequestStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "pending",
        "confirmed",
        "in_transit",
    };

    public static bool IsAllowedContentType(string? contentType) =>
        !string.IsNullOrWhiteSpace(contentType) && AllowedContentTypes.Contains(contentType.Trim());

    public static bool CanUseImageRequestForStatus(string status) =>
        ActiveRequestStatuses.Contains(status.Trim());

    public static string OptionLabel(int optionNumber) => $"Option {optionNumber}";

    public static Result<int> ResolveSlotIndex(
        IReadOnlyList<CustomerOrderImage> optionImages,
        int maxPerOption,
        int? requestedSlot)
    {
        var occupied = optionImages.Select(i => i.SortOrder).ToHashSet();
        if (requestedSlot is int slot)
        {
            if (slot < 0 || slot >= maxPerOption)
            {
                return Result.Failure<int>(new Error(
                    "customers.order_images.invalid_slot",
                    $"Photo slot must be between 1 and {maxPerOption}.",
                    ErrorCategory.Validation));
            }

            if (occupied.Contains(slot))
            {
                return Result.Failure<int>(new Error(
                    "customers.order_images.slot_taken",
                    "That photo slot already has an image. Remove it to replace it.",
                    ErrorCategory.Validation));
            }

            return Result.Success(slot);
        }

        for (var i = 0; i < maxPerOption; i++)
        {
            if (!occupied.Contains(i)) return Result.Success(i);
        }

        return Result.Failure<int>(new Error(
            "customers.order_images.max",
            $"This option already has {maxPerOption} photo{(maxPerOption == 1 ? "" : "s")}. Remove one to upload a different photo.",
            ErrorCategory.Validation));
    }

    public static string? NormalizeDescription(string? description, int maxLength)
    {
        var trimmed = description?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    public static CustomerOrderImageDto ToDto(CustomerOrderImage image, IVendorFileUrlResolver fileUrlResolver) =>
        new(
            image.Id,
            image.CustomerRentalOrderId,
            image.RequestId,
            fileUrlResolver.Resolve(image.StoredReference),
            image.OriginalFileName,
            image.ContentType,
            image.SortOrder,
            new DateTimeOffset(DateTime.SpecifyKind(image.CreatedOnUtc, DateTimeKind.Utc)),
            image.OptionId);

    public static async Task<List<CustomerOrderImageRequestOption>> EnsureOptionsAsync(
        ICustomerRepository customers,
        CustomerOrderImageRequest request,
        IReadOnlyList<CustomerOrderImage> images,
        OrderImageRequestOptions settings,
        CancellationToken cancellationToken)
    {
        var options = await customers.GetCustomerOrderImageRequestOptionsAsync(request.Id, cancellationToken);
        var needed = settings.ResolvedOptionCount;
        var changed = false;

        for (var n = 1; n <= needed; n++)
        {
            if (options.Any(o => o.OptionNumber == n)) continue;
            var slot = new CustomerOrderImageRequestOption
            {
                Id = Guid.NewGuid(),
                RequestId = request.Id,
                OptionNumber = n,
            };
            await customers.AddCustomerOrderImageRequestOptionAsync(slot, cancellationToken);
            options.Add(slot);
            changed = true;
        }

        var first = options.OrderBy(o => o.OptionNumber).FirstOrDefault();
        if (first is not null)
        {
            foreach (var image in images.Where(i => i.OptionId is null || i.OptionId == Guid.Empty))
            {
                image.OptionId = first.Id;
                await customers.UpdateCustomerOrderImageAsync(image, cancellationToken);
                changed = true;
            }
        }

        if (changed)
            await customers.SaveChangesAsync(cancellationToken);

        return options.OrderBy(o => o.OptionNumber).ToList();
    }

    public static CustomerOrderImageRequestDto ToRequestDto(
        CustomerOrderImageRequest request,
        IReadOnlyList<CustomerOrderImageRequestOption> options,
        IReadOnlyList<CustomerOrderImage> images,
        IVendorFileUrlResolver fileUrlResolver,
        OrderImageRequestOptions settings)
    {
        var imageDtos = images.Select(i => ToDto(i, fileUrlResolver)).ToList();
        var optionDtos = options
            .OrderBy(o => o.OptionNumber)
            .Select(o => new CustomerOrderImageOptionDto(
                o.Id,
                o.OptionNumber,
                OptionLabel(o.OptionNumber),
                o.Description,
                imageDtos.Where(i => i.OptionId == o.Id).OrderBy(i => i.SortOrder).ToList()))
            .ToList();

        return new CustomerOrderImageRequestDto(
            request.Id,
            request.CustomerRentalOrderId,
            request.VendorId,
            request.Status,
            request.Message,
            request.RequestedAt,
            imageDtos,
            optionDtos,
            settings.ResolvedOptionCount,
            settings.ResolvedImagesPerOption,
            settings.ResolvedMaxDescriptionLength,
            request.SelectedOptionId);
    }
}

/// <summary>
/// Purge S3 blobs + soft-delete images + close/hide the request when order is
/// delivered (active), cancelled (any actor), or dispatch_failed.
/// </summary>
public static class CustomerOrderImageLifecycle
{
    public static async Task CloseAndPurgeForOrderAsync(
        ICustomerRepository customers,
        IVendorUploadStorageService uploadStorage,
        Guid orderId,
        string closedReason,
        Guid? deletedBy,
        CancellationToken cancellationToken)
    {
        var reason = closedReason.Trim().ToLowerInvariant();
        if (reason is not ("delivered" or "cancelled" or "dispatch_failed" or "active"))
            return;
        if (reason == "active")
            reason = "delivered";

        var now = DateTimeOffset.UtcNow;
        var openRequest = await customers.GetOpenCustomerOrderImageRequestAsync(orderId, cancellationToken);
        var images = openRequest is not null
            ? await customers.GetCustomerOrderImagesByRequestIdAsync(openRequest.Id, cancellationToken)
            : await customers.GetCustomerOrderImagesAsync(orderId, cancellationToken);

        foreach (var image in images)
        {
            try
            {
                await uploadStorage.DeleteStoredFileAsync(image.StoredReference, cancellationToken);
            }
            catch
            {
                // Best-effort blob delete.
            }

            image.IsDeleted = true;
            image.DeletedAt = now;
            image.DeletedBy = deletedBy;
            image.ModifiedOnUtc = now.UtcDateTime;
            await customers.UpdateCustomerOrderImageAsync(image, cancellationToken);
        }

        if (openRequest is not null)
        {
            var slots = await customers.GetCustomerOrderImageRequestOptionsAsync(openRequest.Id, cancellationToken);
            foreach (var slot in slots)
            {
                slot.IsDeleted = true;
                slot.DeletedAt = now;
                slot.DeletedBy = deletedBy;
                slot.ModifiedOnUtc = now.UtcDateTime;
                await customers.UpdateCustomerOrderImageRequestOptionAsync(slot, cancellationToken);
            }

            openRequest.Status = CustomerOrderImageRequest.StatusClosed;
            openRequest.ClosedAt = now;
            openRequest.ClosedReason = reason;
            openRequest.IsDeleted = true;
            openRequest.DeletedAt = now;
            openRequest.DeletedBy = deletedBy;
            openRequest.ModifiedOnUtc = now.UtcDateTime;
            await customers.UpdateCustomerOrderImageRequestAsync(openRequest, cancellationToken);
        }
    }
}

internal sealed class GetCustomerOrderImageRequestQueryHandler(
    ICustomerRepository customers,
    IVendorFileUrlResolver fileUrlResolver,
    IOptions<OrderImageRequestOptions> imageRequestOptions)
    : IQueryHandler<GetCustomerOrderImageRequestQuery, CustomerOrderImageRequestDto?>
{
    public async Task<Result<CustomerOrderImageRequestDto?>> Handle(
        GetCustomerOrderImageRequestQuery request,
        CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerOrderImageRequestDto?>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var open = await customers.GetOpenCustomerOrderImageRequestAsync(request.OrderId, cancellationToken);
        if (open is null)
            return Result.Success<CustomerOrderImageRequestDto?>(null);

        var images = await customers.GetCustomerOrderImagesByRequestIdAsync(open.Id, cancellationToken);
        var settings = imageRequestOptions.Value;
        var options = await CustomerOrderImageRules.EnsureOptionsAsync(customers, open, images, settings, cancellationToken);
        return Result.Success<CustomerOrderImageRequestDto?>(
            CustomerOrderImageRules.ToRequestDto(open, options, images, fileUrlResolver, settings));
    }
}

internal sealed class CreateCustomerOrderImageRequestCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IVendorFileUrlResolver fileUrlResolver,
    IOptions<OrderImageRequestOptions> imageRequestOptions)
    : ICommandHandler<CreateCustomerOrderImageRequestCommand, CustomerOrderImageRequestDto>
{
    public async Task<Result<CustomerOrderImageRequestDto>> Handle(
        CreateCustomerOrderImageRequestCommand request,
        CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerOrderImageRequestDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        if (!CustomerOrderImageRules.CanUseImageRequestForStatus(row.Order.Status))
        {
            return Result.Failure<CustomerOrderImageRequestDto>(new Error(
                "customers.order_images.status_locked",
                "Photo requests can only be sent while a vendor is assigned and before delivery.",
                ErrorCategory.Validation));
        }

        var settings = imageRequestOptions.Value;
        var existing = await customers.GetOpenCustomerOrderImageRequestAsync(request.OrderId, cancellationToken);
        if (existing is not null)
        {
            var existingImages = await customers.GetCustomerOrderImagesByRequestIdAsync(existing.Id, cancellationToken);
            var existingOptions = await CustomerOrderImageRules.EnsureOptionsAsync(customers, existing, existingImages, settings, cancellationToken);
            return Result.Success(CustomerOrderImageRules.ToRequestDto(existing, existingOptions, existingImages, fileUrlResolver, settings));
        }

        var listing = await customers.GetListingForCustomerAsync(row.Order.VendorProductListingId, cancellationToken);
        if (listing is null)
            return Result.Failure<CustomerOrderImageRequestDto>(new Error("customers.listing_not_found", "Listing not found.", ErrorCategory.NotFound));

        var entity = new CustomerOrderImageRequest
        {
            Id = Guid.NewGuid(),
            CustomerRentalOrderId = request.OrderId,
            CustomerId = request.CustomerId,
            VendorId = listing.VendorId,
            Status = CustomerOrderImageRequest.StatusOpen,
            Message = CustomerOrderImageRequest.SystemRequestMessage,
            RequestedAt = DateTimeOffset.UtcNow,
        };

        await customers.AddCustomerOrderImageRequestAsync(entity, cancellationToken);
        await vendors.AddVendorNotificationAsync(
            new VendorNotification
            {
                VendorId = listing.VendorId,
                NotificationType = "order_photos_requested",
                Title = $"Customer photo request · {row.Order.OrderNumber}",
                Message = $"{CustomerOrderImageRequest.SystemRequestMessage} [ID: {request.OrderId}]",
                Channel = "in_app",
                Status = "sent",
                SentAt = DateTimeOffset.UtcNow,
            },
            cancellationToken);

        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);

        var options = await CustomerOrderImageRules.EnsureOptionsAsync(customers, entity, [], settings, cancellationToken);
        return Result.Success(CustomerOrderImageRules.ToRequestDto(entity, options, [], fileUrlResolver, settings));
    }
}

internal sealed class GetVendorOrderImageRequestQueryHandler(
    ICustomerRepository customers,
    IVendorFileUrlResolver fileUrlResolver,
    IOptions<OrderImageRequestOptions> imageRequestOptions)
    : IQueryHandler<GetVendorOrderImageRequestQuery, CustomerOrderImageRequestDto?>
{
    public async Task<Result<CustomerOrderImageRequestDto?>> Handle(
        GetVendorOrderImageRequestQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<CustomerOrderImageRequestDto?>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var row = await customers.GetVendorOrderAsync(vendorId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerOrderImageRequestDto?>(new Error("vendors.order_not_found", "Order not found for vendor.", ErrorCategory.NotFound));

        var open = await customers.GetOpenCustomerOrderImageRequestAsync(request.OrderId, cancellationToken);
        if (open is null || open.VendorId != vendorId)
            return Result.Success<CustomerOrderImageRequestDto?>(null);

        var images = await customers.GetCustomerOrderImagesByRequestIdAsync(open.Id, cancellationToken);
        var settings = imageRequestOptions.Value;
        var options = await CustomerOrderImageRules.EnsureOptionsAsync(customers, open, images, settings, cancellationToken);
        return Result.Success<CustomerOrderImageRequestDto?>(
            CustomerOrderImageRules.ToRequestDto(open, options, images, fileUrlResolver, settings));
    }
}

internal sealed class UploadVendorOrderImageCommandHandler(
    ICustomerRepository customers,
    IVendorUploadStorageService uploadStorage,
    IVendorFileUrlResolver fileUrlResolver,
    IOptions<OrderImageRequestOptions> imageRequestOptions)
    : ICommandHandler<UploadVendorOrderImageCommand, CustomerOrderImageDto>
{
    public async Task<Result<CustomerOrderImageDto>> Handle(
        UploadVendorOrderImageCommand request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<CustomerOrderImageDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        if (request.FileBytes.LongLength > CustomerOrderImageRules.MaxBytes)
        {
            return Result.Failure<CustomerOrderImageDto>(new Error(
                "customers.order_images.too_large",
                $"Image must be at most {CustomerOrderImageRules.MaxBytes / (1024 * 1024)} MB.",
                ErrorCategory.Validation));
        }

        if (!CustomerOrderImageRules.IsAllowedContentType(request.ContentType))
        {
            return Result.Failure<CustomerOrderImageDto>(new Error(
                "customers.order_images.invalid_type",
                "Only JPEG, PNG, or WebP images are allowed.",
                ErrorCategory.Validation));
        }

        var row = await customers.GetVendorOrderAsync(vendorId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerOrderImageDto>(new Error("vendors.order_not_found", "Order not found for vendor.", ErrorCategory.NotFound));

        if (!CustomerOrderImageRules.CanUseImageRequestForStatus(row.Order.Status))
        {
            return Result.Failure<CustomerOrderImageDto>(new Error(
                "customers.order_images.status_locked",
                "Photos can only be uploaded before the order is delivered or closed.",
                ErrorCategory.Validation));
        }

        var open = await customers.GetOpenCustomerOrderImageRequestAsync(request.OrderId, cancellationToken);
        if (open is null || open.VendorId != vendorId)
        {
            return Result.Failure<CustomerOrderImageDto>(new Error(
                "customers.order_images.request_not_found",
                "There is no open photo request for this order.",
                ErrorCategory.Validation));
        }

        var settings = imageRequestOptions.Value;
        var images = await customers.GetCustomerOrderImagesByRequestIdAsync(open.Id, cancellationToken);
        var optionRows = await CustomerOrderImageRules.EnsureOptionsAsync(customers, open, images, settings, cancellationToken);
        var option = optionRows.FirstOrDefault(o => o.Id == request.OptionId);
        if (option is null)
        {
            return Result.Failure<CustomerOrderImageDto>(new Error(
                "customers.order_images.option_not_found",
                "That photo option is not available on this request.",
                ErrorCategory.Validation));
        }

        var optionImages = images.Where(i => i.OptionId == option.Id).ToList();
        var maxPerOption = settings.ResolvedImagesPerOption;
        if (optionImages.Count >= maxPerOption)
        {
            return Result.Failure<CustomerOrderImageDto>(new Error(
                "customers.order_images.max",
                $"{CustomerOrderImageRules.OptionLabel(option.OptionNumber)} already has {maxPerOption} photo{(maxPerOption == 1 ? "" : "s")}. Remove one to upload a different photo.",
                ErrorCategory.Validation));
        }

        var slotResult = CustomerOrderImageRules.ResolveSlotIndex(optionImages, maxPerOption, request.SlotIndex);
        if (!slotResult.IsSuccess)
            return Result.Failure<CustomerOrderImageDto>(slotResult.Errors);

        await using var stream = new MemoryStream(request.FileBytes, writable: false);
        var persist = await uploadStorage.PersistVendorUploadAsync(
            vendorId.ToString(),
            request.OriginalFileName,
            request.ContentType,
            stream,
            request.RequestPublicBaseUri,
            cancellationToken,
            VendorFileFolderType.OrderImages);

        var image = new CustomerOrderImage
        {
            Id = Guid.NewGuid(),
            CustomerRentalOrderId = request.OrderId,
            RequestId = open.Id,
            OptionId = option.Id,
            VendorId = vendorId,
            StoredReference = persist.StoredReference,
            OriginalFileName = Path.GetFileName(request.OriginalFileName),
            ContentType = request.ContentType?.Trim(),
            SortOrder = slotResult.Value,
        };

        await customers.AddCustomerOrderImageAsync(image, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(CustomerOrderImageRules.ToDto(image, fileUrlResolver));
    }
}

internal sealed class DeleteVendorOrderImageCommandHandler(
    ICustomerRepository customers,
    IVendorUploadStorageService uploadStorage)
    : ICommandHandler<DeleteVendorOrderImageCommand>
{
    public async Task<Result> Handle(DeleteVendorOrderImageCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var row = await customers.GetVendorOrderAsync(vendorId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure(new Error("vendors.order_not_found", "Order not found for vendor.", ErrorCategory.NotFound));

        var open = await customers.GetOpenCustomerOrderImageRequestAsync(request.OrderId, cancellationToken);
        if (open is null || open.VendorId != vendorId)
            return Result.Failure(new Error("customers.order_images.request_not_found", "There is no open photo request for this order.", ErrorCategory.Validation));

        var image = await customers.GetCustomerOrderImageByIdAsync(request.OrderId, request.ImageId, cancellationToken);
        if (image is null || image.RequestId != open.Id)
            return Result.Failure(new Error("customers.order_images.not_found", "Image not found.", ErrorCategory.NotFound));

        try
        {
            await uploadStorage.DeleteStoredFileAsync(image.StoredReference, cancellationToken);
        }
        catch
        {
            // Soft-delete even if blob delete fails.
        }

        var now = DateTimeOffset.UtcNow;
        image.IsDeleted = true;
        image.DeletedAt = now;
        image.DeletedBy = vendorId;
        image.ModifiedOnUtc = now.UtcDateTime;
        await customers.UpdateCustomerOrderImageAsync(image, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        if (open.SelectedOptionId is Guid selectedId && image.OptionId == selectedId)
        {
            var remaining = await customers.CountCustomerOrderImagesByOptionIdAsync(selectedId, cancellationToken);
            if (remaining <= 0)
            {
                open.SelectedOptionId = null;
                open.ModifiedOnUtc = now.UtcDateTime;
                await customers.UpdateCustomerOrderImageRequestAsync(open, cancellationToken);
                await customers.SaveChangesAsync(cancellationToken);
            }
        }

        return Result.Success();
    }
}

internal sealed class UpdateVendorOrderImageOptionCommandHandler(
    ICustomerRepository customers,
    IVendorFileUrlResolver fileUrlResolver,
    IOptions<OrderImageRequestOptions> imageRequestOptions)
    : ICommandHandler<UpdateVendorOrderImageOptionCommand, CustomerOrderImageRequestDto>
{
    public async Task<Result<CustomerOrderImageRequestDto>> Handle(
        UpdateVendorOrderImageOptionCommand request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<CustomerOrderImageRequestDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var row = await customers.GetVendorOrderAsync(vendorId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerOrderImageRequestDto>(new Error("vendors.order_not_found", "Order not found for vendor.", ErrorCategory.NotFound));

        if (!CustomerOrderImageRules.CanUseImageRequestForStatus(row.Order.Status))
        {
            return Result.Failure<CustomerOrderImageRequestDto>(new Error(
                "customers.order_images.status_locked",
                "Option notes can only be edited before the order is delivered or closed.",
                ErrorCategory.Validation));
        }

        var open = await customers.GetOpenCustomerOrderImageRequestAsync(request.OrderId, cancellationToken);
        if (open is null || open.VendorId != vendorId)
        {
            return Result.Failure<CustomerOrderImageRequestDto>(new Error(
                "customers.order_images.request_not_found",
                "There is no open photo request for this order.",
                ErrorCategory.Validation));
        }

        var settings = imageRequestOptions.Value;
        var images = await customers.GetCustomerOrderImagesByRequestIdAsync(open.Id, cancellationToken);
        var slots = await CustomerOrderImageRules.EnsureOptionsAsync(customers, open, images, settings, cancellationToken);
        var slot = slots.FirstOrDefault(o => o.Id == request.OptionId);
        if (slot is null)
        {
            return Result.Failure<CustomerOrderImageRequestDto>(new Error(
                "customers.order_images.option_not_found",
                "That photo option is not available on this request.",
                ErrorCategory.Validation));
        }

        slot.Description = CustomerOrderImageRules.NormalizeDescription(request.Description, settings.ResolvedMaxDescriptionLength);
        slot.ModifiedOnUtc = DateTime.UtcNow;
        await customers.UpdateCustomerOrderImageRequestOptionAsync(slot, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        var refreshedImages = await customers.GetCustomerOrderImagesByRequestIdAsync(open.Id, cancellationToken);
        var refreshedSlots = await customers.GetCustomerOrderImageRequestOptionsAsync(open.Id, cancellationToken);
        return Result.Success(CustomerOrderImageRules.ToRequestDto(open, refreshedSlots, refreshedImages, fileUrlResolver, settings));
    }
}

internal sealed class SelectCustomerOrderImageOptionCommandHandler(
    ICustomerRepository customers,
    IVendorFileUrlResolver fileUrlResolver,
    IOptions<OrderImageRequestOptions> imageRequestOptions)
    : ICommandHandler<SelectCustomerOrderImageOptionCommand, CustomerOrderImageRequestDto>
{
    public async Task<Result<CustomerOrderImageRequestDto>> Handle(
        SelectCustomerOrderImageOptionCommand request,
        CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerOrderImageRequestDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        if (!CustomerOrderImageRules.CanUseImageRequestForStatus(row.Order.Status))
        {
            return Result.Failure<CustomerOrderImageRequestDto>(new Error(
                "customers.order_images.status_locked",
                "You can only choose an option while a vendor is assigned and before delivery.",
                ErrorCategory.Validation));
        }

        var open = await customers.GetOpenCustomerOrderImageRequestAsync(request.OrderId, cancellationToken);
        if (open is null)
        {
            return Result.Failure<CustomerOrderImageRequestDto>(new Error(
                "customers.order_images.request_not_found",
                "There is no open photo request for this order.",
                ErrorCategory.Validation));
        }

        var settings = imageRequestOptions.Value;
        var images = await customers.GetCustomerOrderImagesByRequestIdAsync(open.Id, cancellationToken);
        var slots = await CustomerOrderImageRules.EnsureOptionsAsync(customers, open, images, settings, cancellationToken);
        var slot = slots.FirstOrDefault(o => o.Id == request.OptionId);
        if (slot is null)
        {
            return Result.Failure<CustomerOrderImageRequestDto>(new Error(
                "customers.order_images.option_not_found",
                "That photo option is not available on this request.",
                ErrorCategory.Validation));
        }

        if (!images.Any(i => i.OptionId == slot.Id))
        {
            return Result.Failure<CustomerOrderImageRequestDto>(new Error(
                "customers.order_images.option_empty",
                "Choose an option that already has photos.",
                ErrorCategory.Validation));
        }

        open.SelectedOptionId = slot.Id;
        open.ModifiedOnUtc = DateTime.UtcNow;
        await customers.UpdateCustomerOrderImageRequestAsync(open, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(CustomerOrderImageRules.ToRequestDto(open, slots, images, fileUrlResolver, settings));
    }
}
