using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Legal;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record CustomerPrescriptionFileDto(
    Guid Id,
    Guid OrderId,
    string FileUrl,
    string? OriginalFileName,
    string? ContentType,
    int SortOrder,
    string UploadSource,
    DateTimeOffset CreatedAt);

public sealed record GetCustomerOrderPrescriptionsQuery(Guid CustomerId, Guid OrderId)
    : IQuery<IReadOnlyList<CustomerPrescriptionFileDto>>;

public sealed record GetVendorOrderPrescriptionsQuery(string VendorId, Guid OrderId)
    : IQuery<IReadOnlyList<CustomerPrescriptionFileDto>>;

public sealed record GetAdminOrderPrescriptionsQuery(Guid OrderId)
    : IQuery<IReadOnlyList<CustomerPrescriptionFileDto>>;

public sealed record UploadCustomerOrderPrescriptionCommand(
    Guid CustomerId,
    Guid OrderId,
    string OriginalFileName,
    string? ContentType,
    byte[] FileBytes,
    Uri RequestPublicBaseUri,
    string UploadSource,
    bool AcceptedPrescriptionLegal,
    string? SourceSurface,
    string? IpAddress,
    string? UserAgent) : ICommand<CustomerPrescriptionFileDto>;

public sealed record DeleteCustomerOrderPrescriptionCommand(Guid CustomerId, Guid OrderId, Guid FileId)
    : ICommand;

internal static class CustomerPrescriptionRules
{
    public const int MaxFilesPerOrder = 3;
    public const long MaxBytes = 5 * 1024 * 1024;

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "application/pdf",
    };

    private static readonly HashSet<string> LockedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "cancelled",
        "dispatch_failed",
        "active",
        "completed",
        "returned",
    };

    public static bool IsAllowedContentType(string? contentType) =>
        !string.IsNullOrWhiteSpace(contentType) && AllowedContentTypes.Contains(contentType.Trim());

    public static bool CanUploadForStatus(string status) =>
        !LockedStatuses.Contains(status.Trim());

    public static CustomerPrescriptionFileDto ToDto(
        CustomerOrderPrescriptionFile file,
        IVendorFileUrlResolver fileUrlResolver) =>
        new(
            file.Id,
            file.CustomerRentalOrderId,
            fileUrlResolver.Resolve(file.StoredReference),
            file.OriginalFileName,
            file.ContentType,
            file.SortOrder,
            file.UploadSource,
            new DateTimeOffset(DateTime.SpecifyKind(file.CreatedOnUtc, DateTimeKind.Utc)));

    public static string NormalizeSource(string? source) =>
        string.Equals(source?.Trim(), "order_detail", StringComparison.OrdinalIgnoreCase)
            ? "order_detail"
            : "checkout";
}

internal sealed class GetCustomerOrderPrescriptionsQueryHandler(
    ICustomerRepository customers,
    IVendorFileUrlResolver fileUrlResolver)
    : IQueryHandler<GetCustomerOrderPrescriptionsQuery, IReadOnlyList<CustomerPrescriptionFileDto>>
{
    public async Task<Result<IReadOnlyList<CustomerPrescriptionFileDto>>> Handle(
        GetCustomerOrderPrescriptionsQuery request,
        CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<IReadOnlyList<CustomerPrescriptionFileDto>>(new Error(
                "customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var files = await customers.GetCustomerOrderPrescriptionFilesAsync(request.OrderId, cancellationToken);
        return Result.Success<IReadOnlyList<CustomerPrescriptionFileDto>>(
            files.Select(f => CustomerPrescriptionRules.ToDto(f, fileUrlResolver)).ToList());
    }
}

internal sealed class GetVendorOrderPrescriptionsQueryHandler(
    ICustomerRepository customers,
    IVendorFileUrlResolver fileUrlResolver)
    : IQueryHandler<GetVendorOrderPrescriptionsQuery, IReadOnlyList<CustomerPrescriptionFileDto>>
{
    public async Task<Result<IReadOnlyList<CustomerPrescriptionFileDto>>> Handle(
        GetVendorOrderPrescriptionsQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<IReadOnlyList<CustomerPrescriptionFileDto>>(new Error(
                "vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var row = await customers.GetVendorOrderAsync(vendorId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<IReadOnlyList<CustomerPrescriptionFileDto>>(new Error(
                "vendors.order_not_found", "Order not found for vendor.", ErrorCategory.NotFound));

        var files = await customers.GetCustomerOrderPrescriptionFilesAsync(request.OrderId, cancellationToken);
        return Result.Success<IReadOnlyList<CustomerPrescriptionFileDto>>(
            files.Select(f => CustomerPrescriptionRules.ToDto(f, fileUrlResolver)).ToList());
    }
}

internal sealed class GetAdminOrderPrescriptionsQueryHandler(
    ICustomerRepository customers,
    IVendorFileUrlResolver fileUrlResolver)
    : IQueryHandler<GetAdminOrderPrescriptionsQuery, IReadOnlyList<CustomerPrescriptionFileDto>>
{
    public async Task<Result<IReadOnlyList<CustomerPrescriptionFileDto>>> Handle(
        GetAdminOrderPrescriptionsQuery request,
        CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<IReadOnlyList<CustomerPrescriptionFileDto>>(new Error(
                "customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var files = await customers.GetCustomerOrderPrescriptionFilesAsync(request.OrderId, cancellationToken);
        return Result.Success<IReadOnlyList<CustomerPrescriptionFileDto>>(
            files.Select(f => CustomerPrescriptionRules.ToDto(f, fileUrlResolver)).ToList());
    }
}

internal sealed class UploadCustomerOrderPrescriptionCommandHandler(
    ICustomerRepository customers,
    IVendorUploadStorageService uploadStorage,
    IVendorFileUrlResolver fileUrlResolver,
    ILegalAcceptanceRecorder legalAcceptances)
    : ICommandHandler<UploadCustomerOrderPrescriptionCommand, CustomerPrescriptionFileDto>
{
    public async Task<Result<CustomerPrescriptionFileDto>> Handle(
        UploadCustomerOrderPrescriptionCommand request,
        CancellationToken cancellationToken)
    {
        if (request.FileBytes.LongLength > CustomerPrescriptionRules.MaxBytes)
        {
            return Result.Failure<CustomerPrescriptionFileDto>(new Error(
                "customers.prescriptions.too_large",
                $"File must be at most {CustomerPrescriptionRules.MaxBytes / (1024 * 1024)} MB.",
                ErrorCategory.Validation));
        }

        if (!CustomerPrescriptionRules.IsAllowedContentType(request.ContentType))
        {
            return Result.Failure<CustomerPrescriptionFileDto>(new Error(
                "customers.prescriptions.invalid_type",
                "Only JPEG, PNG, WebP, or PDF files are allowed.",
                ErrorCategory.Validation));
        }

        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerPrescriptionFileDto>(new Error(
                "customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        if (!CustomerPrescriptionRules.CanUploadForStatus(row.Order.Status))
        {
            return Result.Failure<CustomerPrescriptionFileDto>(new Error(
                "customers.prescriptions.status_locked",
                "A prescription can only be added before the order is delivered or closed.",
                ErrorCategory.Validation));
        }

        var existing = await customers.GetCustomerOrderPrescriptionFilesAsync(request.OrderId, cancellationToken);
        if (existing.Count >= CustomerPrescriptionRules.MaxFilesPerOrder)
        {
            return Result.Failure<CustomerPrescriptionFileDto>(new Error(
                "customers.prescriptions.max",
                $"You can upload at most {CustomerPrescriptionRules.MaxFilesPerOrder} prescription files.",
                ErrorCategory.Validation));
        }

        var listing = await customers.GetListingForCustomerAsync(row.Order.VendorProductListingId, cancellationToken);
        if (listing is null)
            return Result.Failure<CustomerPrescriptionFileDto>(new Error(
                "customers.listing_not_found", "Listing not found.", ErrorCategory.NotFound));

        var alreadyHasHealthData = row.Doctor is not null || existing.Count > 0;
        if (!alreadyHasHealthData)
        {
            var rxGate = await legalAcceptances.BuildScreenAcceptancesAsync(
                LegalCatalog.ActorTypes.Customer,
                request.CustomerId,
                request.SourceSurface,
                LegalCatalog.Screens.Prescription,
                request.AcceptedPrescriptionLegal,
                null,
                request.IpAddress,
                request.UserAgent,
                null,
                cancellationToken);
            if (!rxGate.IsSuccess)
                return Result.Failure<CustomerPrescriptionFileDto>(rxGate.Errors);

            try
            {
                await legalAcceptances.SaveAcceptancesAsync(rxGate.Value, cancellationToken);
            }
            catch
            {
                return Result.Failure<CustomerPrescriptionFileDto>(new Error(
                    "legal.acceptance_save_failed",
                    "Could not record policy acceptance. Please try again.",
                    ErrorCategory.Validation));
            }
        }

        await using var stream = new MemoryStream(request.FileBytes, writable: false);
        var persist = await uploadStorage.PersistVendorUploadAsync(
            listing.VendorId.ToString(),
            request.OriginalFileName,
            request.ContentType,
            stream,
            request.RequestPublicBaseUri,
            cancellationToken,
            VendorFileFolderType.Prescriptions);

        var file = new CustomerOrderPrescriptionFile
        {
            Id = Guid.NewGuid(),
            CustomerRentalOrderId = request.OrderId,
            CustomerId = request.CustomerId,
            VendorId = listing.VendorId,
            StoredReference = persist.StoredReference,
            OriginalFileName = Path.GetFileName(request.OriginalFileName),
            ContentType = request.ContentType?.Trim(),
            SortOrder = existing.Count,
            UploadSource = CustomerPrescriptionRules.NormalizeSource(request.UploadSource),
        };

        await customers.AddCustomerOrderPrescriptionFileAsync(file, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(CustomerPrescriptionRules.ToDto(file, fileUrlResolver));
    }
}

internal sealed class DeleteCustomerOrderPrescriptionCommandHandler(
    ICustomerRepository customers,
    IVendorUploadStorageService uploadStorage)
    : ICommandHandler<DeleteCustomerOrderPrescriptionCommand>
{
    public async Task<Result> Handle(DeleteCustomerOrderPrescriptionCommand request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        if (!CustomerPrescriptionRules.CanUploadForStatus(row.Order.Status))
        {
            return Result.Failure(new Error(
                "customers.prescriptions.status_locked",
                "A prescription can only be removed before the order is delivered or closed.",
                ErrorCategory.Validation));
        }

        var file = await customers.GetCustomerOrderPrescriptionFileByIdAsync(
            request.OrderId, request.FileId, cancellationToken);
        if (file is null)
            return Result.Failure(new Error("customers.prescriptions.not_found", "Prescription file not found.", ErrorCategory.NotFound));

        try
        {
            await uploadStorage.DeleteStoredFileAsync(file.StoredReference, cancellationToken);
        }
        catch
        {
            // Best-effort blob delete.
        }

        var now = DateTimeOffset.UtcNow;
        file.IsDeleted = true;
        file.DeletedAt = now;
        file.DeletedBy = request.CustomerId;
        file.ModifiedOnUtc = now.UtcDateTime;
        await customers.UpdateCustomerOrderPrescriptionFileAsync(file, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public sealed class UploadCustomerOrderPrescriptionCommandValidator : AbstractValidator<UploadCustomerOrderPrescriptionCommand>
{
    public UploadCustomerOrderPrescriptionCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.OriginalFileName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.FileBytes).NotEmpty();
        RuleFor(x => x.RequestPublicBaseUri).NotNull();
    }
}
