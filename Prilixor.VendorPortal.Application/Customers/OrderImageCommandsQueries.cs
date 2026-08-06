using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
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
    DateTimeOffset CreatedAt);

public sealed record CustomerOrderImageRequestDto(
    Guid Id,
    Guid OrderId,
    Guid VendorId,
    string Status,
    string Message,
    DateTimeOffset RequestedAt,
    List<CustomerOrderImageDto> Images);

public sealed record GetCustomerOrderImageRequestQuery(Guid CustomerId, Guid OrderId)
    : IQuery<CustomerOrderImageRequestDto?>;

public sealed record CreateCustomerOrderImageRequestCommand(Guid CustomerId, Guid OrderId)
    : ICommand<CustomerOrderImageRequestDto>;

public sealed record GetVendorOrderImageRequestQuery(string VendorId, Guid OrderId)
    : IQuery<CustomerOrderImageRequestDto?>;

public sealed record UploadVendorOrderImageCommand(
    string VendorId,
    Guid OrderId,
    string OriginalFileName,
    string? ContentType,
    byte[] FileBytes,
    Uri RequestPublicBaseUri) : ICommand<CustomerOrderImageDto>;

public sealed record DeleteVendorOrderImageCommand(string VendorId, Guid OrderId, Guid ImageId) : ICommand;

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
        RuleFor(x => x.OriginalFileName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.FileBytes).NotEmpty();
        RuleFor(x => x.RequestPublicBaseUri).NotNull();
    }
}

internal static class CustomerOrderImageRules
{
    public const int MaxImagesPerRequest = 5;
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

    public static CustomerOrderImageDto ToDto(CustomerOrderImage image, IVendorFileUrlResolver fileUrlResolver) =>
        new(
            image.Id,
            image.CustomerRentalOrderId,
            image.RequestId,
            fileUrlResolver.Resolve(image.StoredReference),
            image.OriginalFileName,
            image.ContentType,
            image.SortOrder,
            new DateTimeOffset(DateTime.SpecifyKind(image.CreatedOnUtc, DateTimeKind.Utc)));

    public static CustomerOrderImageRequestDto ToRequestDto(
        CustomerOrderImageRequest request,
        IReadOnlyList<CustomerOrderImage> images,
        IVendorFileUrlResolver fileUrlResolver) =>
        new(
            request.Id,
            request.CustomerRentalOrderId,
            request.VendorId,
            request.Status,
            request.Message,
            request.RequestedAt,
            images.Select(i => ToDto(i, fileUrlResolver)).ToList());
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
    IVendorFileUrlResolver fileUrlResolver)
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
        return Result.Success<CustomerOrderImageRequestDto?>(
            CustomerOrderImageRules.ToRequestDto(open, images, fileUrlResolver));
    }
}

internal sealed class CreateCustomerOrderImageRequestCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IVendorFileUrlResolver fileUrlResolver)
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

        var existing = await customers.GetOpenCustomerOrderImageRequestAsync(request.OrderId, cancellationToken);
        if (existing is not null)
        {
            var existingImages = await customers.GetCustomerOrderImagesByRequestIdAsync(existing.Id, cancellationToken);
            return Result.Success(CustomerOrderImageRules.ToRequestDto(existing, existingImages, fileUrlResolver));
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

        return Result.Success(CustomerOrderImageRules.ToRequestDto(entity, [], fileUrlResolver));
    }
}

internal sealed class GetVendorOrderImageRequestQueryHandler(
    ICustomerRepository customers,
    IVendorFileUrlResolver fileUrlResolver)
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
        return Result.Success<CustomerOrderImageRequestDto?>(
            CustomerOrderImageRules.ToRequestDto(open, images, fileUrlResolver));
    }
}

internal sealed class UploadVendorOrderImageCommandHandler(
    ICustomerRepository customers,
    IVendorUploadStorageService uploadStorage,
    IVendorFileUrlResolver fileUrlResolver)
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

        var count = await customers.CountCustomerOrderImagesByRequestIdAsync(open.Id, cancellationToken);
        if (count >= CustomerOrderImageRules.MaxImagesPerRequest)
        {
            return Result.Failure<CustomerOrderImageDto>(new Error(
                "customers.order_images.max",
                $"You can upload at most {CustomerOrderImageRules.MaxImagesPerRequest} images for this request.",
                ErrorCategory.Validation));
        }

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
            VendorId = vendorId,
            StoredReference = persist.StoredReference,
            OriginalFileName = Path.GetFileName(request.OriginalFileName),
            ContentType = request.ContentType?.Trim(),
            SortOrder = count,
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
        return Result.Success();
    }
}
