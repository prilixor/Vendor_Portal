using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record CustomerOrderImageDto(
    Guid Id,
    Guid OrderId,
    string FileUrl,
    string? OriginalFileName,
    string? ContentType,
    int SortOrder,
    DateTimeOffset CreatedAt);

public sealed record GetCustomerOrderImagesQuery(Guid CustomerId, Guid OrderId) : IQuery<List<CustomerOrderImageDto>>;

public sealed record GetVendorOrderImagesQuery(string VendorId, Guid OrderId) : IQuery<List<CustomerOrderImageDto>>;

public sealed record UploadCustomerOrderImageCommand(
    Guid CustomerId,
    Guid OrderId,
    string OriginalFileName,
    string? ContentType,
    byte[] FileBytes,
    Uri RequestPublicBaseUri) : ICommand<CustomerOrderImageDto>;

public sealed record DeleteCustomerOrderImageCommand(Guid CustomerId, Guid OrderId, Guid ImageId) : ICommand;

public sealed class UploadCustomerOrderImageCommandValidator : AbstractValidator<UploadCustomerOrderImageCommand>
{
    public UploadCustomerOrderImageCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.OriginalFileName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.FileBytes).NotEmpty();
        RuleFor(x => x.RequestPublicBaseUri).NotNull();
    }
}

public sealed class DeleteCustomerOrderImageCommandValidator : AbstractValidator<DeleteCustomerOrderImageCommand>
{
    public DeleteCustomerOrderImageCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.ImageId).NotEmpty();
    }
}

internal static class CustomerOrderImageRules
{
    public const int MaxImagesPerOrder = 5;
    public const long MaxBytes = 5 * 1024 * 1024;

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
    };

    private static readonly HashSet<string> UploadAllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "pending",
        "awaiting_vendor_acceptance",
        "confirmed",
        "in_transit",
    };

    public static bool IsAllowedContentType(string? contentType) =>
        !string.IsNullOrWhiteSpace(contentType) && AllowedContentTypes.Contains(contentType.Trim());

    public static bool CanUploadForStatus(string status) =>
        UploadAllowedStatuses.Contains(status.Trim());

    public static CustomerOrderImageDto ToDto(CustomerOrderImage image, IVendorFileUrlResolver fileUrlResolver) =>
        new(
            image.Id,
            image.CustomerRentalOrderId,
            fileUrlResolver.Resolve(image.StoredReference),
            image.OriginalFileName,
            image.ContentType,
            image.SortOrder,
            new DateTimeOffset(DateTime.SpecifyKind(image.CreatedOnUtc, DateTimeKind.Utc)));
}

/// <summary>
/// Order-image lifecycle helpers.
/// Delete immediately when: customer cancels, or vendor/admin marks delivered (status = active).
/// Never delete on vendor cancel (reassignment / dispatch_failed) — photos must remain for the next vendor.
/// </summary>
public static class CustomerOrderImageLifecycle
{
    public static async Task PurgeForOrderAsync(
        ICustomerRepository customers,
        IVendorUploadStorageService uploadStorage,
        Guid orderId,
        Guid? deletedBy,
        CancellationToken cancellationToken)
    {
        // Hard guard: never delete during vendor cancel / reassignment / dispatch_failed.
        // Allowed only after customer cancel (cancelled) or deliver (active).
        var order = await customers.GetCustomerOrderEntityByIdAsync(orderId, cancellationToken);
        if (order is null)
            return;

        var status = order.Status.Trim().ToLowerInvariant();
        if (status is not ("cancelled" or "active"))
            return;

        var images = await customers.GetCustomerOrderImagesAsync(orderId, cancellationToken);
        if (images.Count == 0)
            return;

        var now = DateTimeOffset.UtcNow;
        foreach (var image in images)
        {
            try
            {
                await uploadStorage.DeleteStoredFileAsync(image.StoredReference, cancellationToken);
            }
            catch
            {
                // Best-effort: still soft-delete the row so clients stop resolving the URL.
            }

            image.IsDeleted = true;
            image.DeletedAt = now;
            image.DeletedBy = deletedBy;
            image.ModifiedOnUtc = now.UtcDateTime;
            await customers.UpdateCustomerOrderImageAsync(image, cancellationToken);
        }
    }

    /// <summary>Points existing order photos at the vendor who accepted a reassigned order (files are kept).</summary>
    public static async Task ReassignVendorAsync(
        ICustomerRepository customers,
        Guid orderId,
        Guid newVendorId,
        CancellationToken cancellationToken)
    {
        var images = await customers.GetCustomerOrderImagesAsync(orderId, cancellationToken);
        if (images.Count == 0)
            return;

        var now = DateTime.UtcNow;
        foreach (var image in images.Where(i => i.VendorId != newVendorId))
        {
            image.VendorId = newVendorId;
            image.ModifiedOnUtc = now;
            await customers.UpdateCustomerOrderImageAsync(image, cancellationToken);
        }
    }
}

internal sealed class GetCustomerOrderImagesQueryHandler(
    ICustomerRepository customers,
    IVendorFileUrlResolver fileUrlResolver)
    : IQueryHandler<GetCustomerOrderImagesQuery, List<CustomerOrderImageDto>>
{
    public async Task<Result<List<CustomerOrderImageDto>>> Handle(GetCustomerOrderImagesQuery request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<List<CustomerOrderImageDto>>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var images = await customers.GetCustomerOrderImagesAsync(request.OrderId, cancellationToken);
        return Result.Success(images.Select(i => CustomerOrderImageRules.ToDto(i, fileUrlResolver)).ToList());
    }
}

internal sealed class GetVendorOrderImagesQueryHandler(
    ICustomerRepository customers,
    IVendorFileUrlResolver fileUrlResolver)
    : IQueryHandler<GetVendorOrderImagesQuery, List<CustomerOrderImageDto>>
{
    public async Task<Result<List<CustomerOrderImageDto>>> Handle(GetVendorOrderImagesQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<List<CustomerOrderImageDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var row = await customers.GetVendorOrderAsync(vendorId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<List<CustomerOrderImageDto>>(new Error("vendors.order_not_found", "Order not found for vendor.", ErrorCategory.NotFound));

        var images = await customers.GetCustomerOrderImagesAsync(request.OrderId, cancellationToken);
        return Result.Success(images.Select(i => CustomerOrderImageRules.ToDto(i, fileUrlResolver)).ToList());
    }
}

internal sealed class UploadCustomerOrderImageCommandHandler(
    ICustomerRepository customers,
    IVendorUploadStorageService uploadStorage,
    IVendorFileUrlResolver fileUrlResolver)
    : ICommandHandler<UploadCustomerOrderImageCommand, CustomerOrderImageDto>
{
    public async Task<Result<CustomerOrderImageDto>> Handle(UploadCustomerOrderImageCommand request, CancellationToken cancellationToken)
    {
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

        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerOrderImageDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        if (!CustomerOrderImageRules.CanUploadForStatus(row.Order.Status))
        {
            return Result.Failure<CustomerOrderImageDto>(new Error(
                "customers.order_images.status_locked",
                "Photos can only be sent before the order is delivered.",
                ErrorCategory.Validation));
        }

        var listing = await customers.GetListingForCustomerAsync(row.Order.VendorProductListingId, cancellationToken);
        if (listing is null)
            return Result.Failure<CustomerOrderImageDto>(new Error("customers.listing_not_found", "Listing not found.", ErrorCategory.NotFound));

        var count = await customers.CountCustomerOrderImagesAsync(request.OrderId, cancellationToken);
        if (count >= CustomerOrderImageRules.MaxImagesPerOrder)
        {
            return Result.Failure<CustomerOrderImageDto>(new Error(
                "customers.order_images.max",
                $"You can send at most {CustomerOrderImageRules.MaxImagesPerOrder} images for this order.",
                ErrorCategory.Validation));
        }

        await using var stream = new MemoryStream(request.FileBytes, writable: false);
        var persist = await uploadStorage.PersistVendorUploadAsync(
            listing.VendorId.ToString(),
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
            VendorId = listing.VendorId,
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

internal sealed class DeleteCustomerOrderImageCommandHandler(
    ICustomerRepository customers,
    IVendorUploadStorageService uploadStorage)
    : ICommandHandler<DeleteCustomerOrderImageCommand>
{
    public async Task<Result> Handle(DeleteCustomerOrderImageCommand request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        if (!CustomerOrderImageRules.CanUploadForStatus(row.Order.Status))
        {
            return Result.Failure(new Error(
                "customers.order_images.status_locked",
                "Photos can only be changed before the order is delivered.",
                ErrorCategory.Validation));
        }

        var image = await customers.GetCustomerOrderImageByIdAsync(request.OrderId, request.ImageId, cancellationToken);
        if (image is null)
            return Result.Failure(new Error("customers.order_images.not_found", "Image not found.", ErrorCategory.NotFound));

        try
        {
            await uploadStorage.DeleteStoredFileAsync(image.StoredReference, cancellationToken);
        }
        catch
        {
            // Soft-delete the row even if blob delete fails.
        }

        var now = DateTimeOffset.UtcNow;
        image.IsDeleted = true;
        image.DeletedAt = now;
        image.DeletedBy = request.CustomerId;
        image.ModifiedOnUtc = now.UtcDateTime;
        await customers.UpdateCustomerOrderImageAsync(image, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
