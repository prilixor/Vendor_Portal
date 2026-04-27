using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using OfficeOpenXml;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record CreateProductCategoryCommand(
    string CategoryName,
    bool PrescriptionRequired,
    bool DepositRequired,
    bool InstallationRequired,
    bool IsActive) : ICommand<ProductCategoryDto>;

public sealed class CreateProductCategoryCommandValidator : AbstractValidator<CreateProductCategoryCommand>
{
    public CreateProductCategoryCommandValidator()
    {
        RuleFor(x => x.CategoryName).NotEmpty().MaximumLength(150);
    }
}

internal sealed class CreateProductCategoryCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<CreateProductCategoryCommand, ProductCategoryDto>
{
    public async Task<Result<ProductCategoryDto>> Handle(CreateProductCategoryCommand request, CancellationToken cancellationToken)
    {
        var entity = new ProductCategory
        {
            CategoryName = request.CategoryName,
            PrescriptionRequired = request.PrescriptionRequired,
            DepositRequired = request.DepositRequired,
            InstallationRequired = request.InstallationRequired,
            IsActive = request.IsActive
        };

        await repository.AddProductCategoryAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new ProductCategoryDto(
            entity.Id.ToString(),
            entity.CategoryName,
            entity.PrescriptionRequired,
            entity.DepositRequired,
            entity.InstallationRequired,
            entity.IsActive));
    }
}

public sealed record GetProductCategoriesQuery : IQuery<List<ProductCategoryDto>>;

internal sealed class GetProductCategoriesQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetProductCategoriesQuery, List<ProductCategoryDto>>
{
    public async Task<Result<List<ProductCategoryDto>>> Handle(GetProductCategoriesQuery request, CancellationToken cancellationToken)
    {
        var rows = await repository.GetProductCategoriesAsync(cancellationToken);
        var result = rows.Select(x => new ProductCategoryDto(
            x.Id.ToString(),
            x.CategoryName,
            x.PrescriptionRequired,
            x.DepositRequired,
            x.InstallationRequired,
            x.IsActive)).ToList();

        return Result.Success(result);
    }
}

public sealed record CreateProductCommand(
    string CategoryId,
    string ProductName,
    string? BrandName,
    string? ModelName,
    string? ShortDescription,
    string? LongDescription,
    bool IsActive) : ICommand<ProductDto>;

public sealed class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator()
    {
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.ProductName).NotEmpty().MaximumLength(255);
    }
}

internal sealed class CreateProductCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<CreateProductCommand, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.CategoryId, out var categoryId))
        {
            return Result.Failure<ProductDto>(new Error("products.invalid_category_id", "Category id must be a valid UUID.", ErrorCategory.Validation));
        }

        var category = await repository.GetProductCategoryByIdAsync(categoryId, cancellationToken);
        if (category is null)
        {
            return Result.Failure<ProductDto>(new Error("products.category_not_found", "Product category not found.", ErrorCategory.NotFound));
        }

        var entity = new Product
        {
            CategoryId = categoryId,
            ProductName = request.ProductName,
            BrandName = request.BrandName,
            ModelName = request.ModelName,
            ShortDescription = request.ShortDescription,
            LongDescription = request.LongDescription,
            IsActive = request.IsActive
        };

        await repository.AddProductAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new ProductDto(
            entity.Id.ToString(),
            entity.CategoryId.ToString(),
            entity.ProductName,
            entity.BrandName,
            entity.ModelName,
            entity.ShortDescription,
            entity.LongDescription,
            entity.IsActive));
    }
}

public sealed record GetProductsQuery(string? CategoryId) : IQuery<List<ProductDto>>;

internal sealed class GetProductsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetProductsQuery, List<ProductDto>>
{
    public async Task<Result<List<ProductDto>>> Handle(GetProductsQuery request, CancellationToken cancellationToken)
    {
        Guid? categoryId = null;
        if (!string.IsNullOrWhiteSpace(request.CategoryId))
        {
            if (!Guid.TryParse(request.CategoryId, out var parsedCategoryId))
            {
                return Result.Failure<List<ProductDto>>(new Error("products.invalid_category_id", "Category id must be a valid UUID.", ErrorCategory.Validation));
            }

            categoryId = parsedCategoryId;
        }

        var rows = await repository.GetProductsAsync(categoryId, cancellationToken);
        var result = rows.Select(x => new ProductDto(
            x.Id.ToString(),
            x.CategoryId.ToString(),
            x.ProductName,
            x.BrandName,
            x.ModelName,
            x.ShortDescription,
            x.LongDescription,
            x.IsActive)).ToList();

        return Result.Success(result);
    }
}

public sealed record UpsertVendorProductListingCommand(
    string VendorId,
    string? ListingId,
    string ProductId,
    string ListingTitle,
    decimal DailyRent,
    decimal MonthlyRent,
    decimal SecurityDeposit,
    int AvailableQuantity,
    string ListingStatus) : ICommand<VendorProductListingDto>;

public sealed class UpsertVendorProductListingCommandValidator : AbstractValidator<UpsertVendorProductListingCommand>
{
    private static readonly string[] AllowedListingStatuses =
    [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "inactive",
        "blocked",
        "active"
    ];

    public UpsertVendorProductListingCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.ListingTitle).NotEmpty().MaximumLength(255);
        RuleFor(x => x.DailyRent).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MonthlyRent).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SecurityDeposit).GreaterThanOrEqualTo(0);
        RuleFor(x => x.AvailableQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ListingStatus)
            .NotEmpty()
            .MaximumLength(30)
            .Must(status => AllowedListingStatuses.Contains(status.Trim().ToLowerInvariant()))
            .WithMessage("Listing status is invalid.");
    }
}

internal sealed class UpsertVendorProductListingCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpsertVendorProductListingCommand, VendorProductListingDto>
{
    public async Task<Result<VendorProductListingDto>> Handle(UpsertVendorProductListingCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorProductListingDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.ProductId, out var productId))
        {
            return Result.Failure<VendorProductListingDto>(new Error("vendors.listing.invalid_product_id", "Product id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorProductListingDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var product = await repository.GetProductByIdAsync(productId, cancellationToken);
        if (product is null)
        {
            return Result.Failure<VendorProductListingDto>(new Error("vendors.listing.product_not_found", "Product not found.", ErrorCategory.NotFound));
        }

        VendorProductListing entity;
        if (!string.IsNullOrWhiteSpace(request.ListingId))
        {
            if (!Guid.TryParse(request.ListingId, out var listingId))
            {
                return Result.Failure<VendorProductListingDto>(new Error("vendors.listing.invalid_id", "Listing id must be a valid UUID.", ErrorCategory.Validation));
            }

            entity = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken)
                ?? new VendorProductListing { VendorId = vendorId, ProductId = productId };
        }
        else
        {
            entity = await repository.GetVendorProductListingByVendorProductAsync(vendorId, productId, cancellationToken)
                ?? new VendorProductListing { VendorId = vendorId, ProductId = productId };
        }

        entity.ListingTitle = request.ListingTitle;
        entity.DailyRent = request.DailyRent;
        entity.MonthlyRent = request.MonthlyRent;
        entity.SecurityDeposit = request.SecurityDeposit;
        entity.AvailableQuantity = request.AvailableQuantity;
        var normalizedListingStatus = request.ListingStatus.Trim().ToLowerInvariant();
        if (normalizedListingStatus == "active")
        {
            normalizedListingStatus = "approved";
        }
        entity.ListingStatus = normalizedListingStatus;
        entity.ProductId = productId;

        if (entity.Id == Guid.Empty)
        {
            await repository.AddVendorProductListingAsync(entity, cancellationToken);
        }
        else
        {
            await repository.UpdateVendorProductListingAsync(entity, cancellationToken);
        }

        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorProductListingDto(
            entity.Id.ToString(),
            entity.VendorId.ToString(),
            entity.ProductId.ToString(),
            entity.ListingTitle,
            entity.DailyRent,
            entity.MonthlyRent,
            entity.SecurityDeposit,
            entity.AvailableQuantity,
            entity.ListingStatus));
    }
}

public sealed record GetVendorProductListingsQuery(string VendorId) : IQuery<List<VendorProductListingDto>>;

internal sealed class GetVendorProductListingsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorProductListingsQuery, List<VendorProductListingDto>>
{
    public async Task<Result<List<VendorProductListingDto>>> Handle(GetVendorProductListingsQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<List<VendorProductListingDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var rows = await repository.GetVendorProductListingsAsync(vendorId, cancellationToken);
        var result = rows.Select(x => new VendorProductListingDto(
            x.Id.ToString(),
            x.VendorId.ToString(),
            x.ProductId.ToString(),
            x.ListingTitle,
            x.DailyRent,
            x.MonthlyRent,
            x.SecurityDeposit,
            x.AvailableQuantity,
            x.ListingStatus)).ToList();

        return Result.Success(result);
    }
}

public sealed record AddVendorProductImageCommand(
    string VendorId,
    string ListingId,
    string ImageUrl,
    int DisplayOrder,
    bool IsPrimary) : ICommand<VendorProductImageDto>;

public sealed class AddVendorProductImageCommandValidator : AbstractValidator<AddVendorProductImageCommand>
{
    public AddVendorProductImageCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
        RuleFor(x => x.ImageUrl).NotEmpty();
        RuleFor(x => x.DisplayOrder).GreaterThan(0);
    }
}

internal sealed class AddVendorProductImageCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<AddVendorProductImageCommand, VendorProductImageDto>
{
    public async Task<Result<VendorProductImageDto>> Handle(AddVendorProductImageCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId) || !Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure<VendorProductImageDto>(new Error("vendors.listing.invalid_id", "Vendor/listing id must be a valid UUID.", ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure<VendorProductImageDto>(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        var entity = new VendorProductImage
        {
            VendorProductListingId = listingId,
            ImageUrl = request.ImageUrl,
            DisplayOrder = request.DisplayOrder,
            IsPrimary = request.IsPrimary
        };

        await repository.AddVendorProductImageAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorProductImageDto(
            entity.Id.ToString(),
            entity.VendorProductListingId.ToString(),
            entity.ImageUrl,
            entity.DisplayOrder,
            entity.IsPrimary));
    }
}

public sealed record GetVendorProductImagesQuery(string VendorId, string ListingId) : IQuery<List<VendorProductImageDto>>;

internal sealed class GetVendorProductImagesQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorProductImagesQuery, List<VendorProductImageDto>>
{
    public async Task<Result<List<VendorProductImageDto>>> Handle(GetVendorProductImagesQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId) || !Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure<List<VendorProductImageDto>>(new Error("vendors.listing.invalid_id", "Vendor/listing id must be a valid UUID.", ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure<List<VendorProductImageDto>>(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        var rows = await repository.GetVendorProductImagesAsync(listingId, cancellationToken);
        var result = rows.Select(x => new VendorProductImageDto(
            x.Id.ToString(),
            x.VendorProductListingId.ToString(),
            x.ImageUrl,
            x.DisplayOrder,
            x.IsPrimary)).ToList();

        return Result.Success(result);
    }
}

public sealed record DeleteVendorProductImageCommand(string VendorId, string ListingId, string ImageId) : ICommand;

public sealed class DeleteVendorProductImageCommandValidator : AbstractValidator<DeleteVendorProductImageCommand>
{
    public DeleteVendorProductImageCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
        RuleFor(x => x.ImageId).NotEmpty();
    }
}

internal sealed class DeleteVendorProductImageCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<DeleteVendorProductImageCommand>
{
    public async Task<Result> Handle(DeleteVendorProductImageCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId)
            || !Guid.TryParse(request.ListingId, out var listingId)
            || !Guid.TryParse(request.ImageId, out var imageId))
        {
            return Result.Failure(new Error("vendors.listing.invalid_id", "Vendor/listing/image id must be a valid UUID.", ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        var image = await repository.GetVendorProductImageByIdAsync(vendorId, listingId, imageId, cancellationToken);
        if (image is null)
        {
            return Result.Failure(new Error("vendors.listing.image.not_found", "Listing image not found.", ErrorCategory.NotFound));
        }

        var wasPrimary = image.IsPrimary;
        image.IsDeleted = true;
        image.DeletedAt = DateTimeOffset.UtcNow;
        image.DeletedBy = vendorId;
        image.IsPrimary = false;
        await repository.UpdateVendorProductImageAsync(image, cancellationToken);

        if (wasPrimary)
        {
            var remaining = await repository.GetVendorProductImagesAsync(listingId, cancellationToken);
            var fallback = remaining
                .Where(x => x.Id != imageId)
                .OrderBy(x => x.DisplayOrder)
                .FirstOrDefault();

            if (fallback is not null && !fallback.IsPrimary)
            {
                fallback.IsPrimary = true;
                await repository.UpdateVendorProductImageAsync(fallback, cancellationToken);
            }
        }

        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public sealed record AddVendorProductDocumentCommand(
    string VendorId,
    string ListingId,
    string DocumentType,
    string FileUrl) : ICommand<VendorProductDocumentDto>;

public sealed class AddVendorProductDocumentCommandValidator : AbstractValidator<AddVendorProductDocumentCommand>
{
    public AddVendorProductDocumentCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
        RuleFor(x => x.DocumentType).NotEmpty().MaximumLength(50);
        RuleFor(x => x.FileUrl).NotEmpty();
    }
}

internal sealed class AddVendorProductDocumentCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<AddVendorProductDocumentCommand, VendorProductDocumentDto>
{
    public async Task<Result<VendorProductDocumentDto>> Handle(AddVendorProductDocumentCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId) || !Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure<VendorProductDocumentDto>(new Error("vendors.listing.invalid_id", "Vendor/listing id must be a valid UUID.", ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure<VendorProductDocumentDto>(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        var entity = new VendorProductDocument
        {
            VendorProductListingId = listingId,
            DocumentType = request.DocumentType,
            FileUrl = request.FileUrl,
            VerificationStatus = "pending"
        };

        await repository.AddVendorProductDocumentAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorProductDocumentDto(
            entity.Id.ToString(),
            entity.VendorProductListingId.ToString(),
            entity.DocumentType,
            entity.FileUrl,
            entity.VerificationStatus,
            entity.RejectionReason,
            entity.VerifiedAt));
    }
}

public sealed record GetVendorProductDocumentsQuery(string VendorId, string ListingId) : IQuery<List<VendorProductDocumentDto>>;

internal sealed class GetVendorProductDocumentsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorProductDocumentsQuery, List<VendorProductDocumentDto>>
{
    public async Task<Result<List<VendorProductDocumentDto>>> Handle(GetVendorProductDocumentsQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId) || !Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure<List<VendorProductDocumentDto>>(new Error("vendors.listing.invalid_id", "Vendor/listing id must be a valid UUID.", ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure<List<VendorProductDocumentDto>>(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        var rows = await repository.GetVendorProductDocumentsAsync(listingId, cancellationToken);
        var result = rows.Select(x => new VendorProductDocumentDto(
            x.Id.ToString(),
            x.VendorProductListingId.ToString(),
            x.DocumentType,
            x.FileUrl,
            x.VerificationStatus,
            x.RejectionReason,
            x.VerifiedAt)).ToList();

        return Result.Success(result);
    }
}

public sealed record DeleteVendorProductDocumentCommand(string VendorId, string ListingId, string DocumentId) : ICommand;

public sealed class DeleteVendorProductDocumentCommandValidator : AbstractValidator<DeleteVendorProductDocumentCommand>
{
    public DeleteVendorProductDocumentCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
        RuleFor(x => x.DocumentId).NotEmpty();
    }
}

internal sealed class DeleteVendorProductDocumentCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<DeleteVendorProductDocumentCommand>
{
    public async Task<Result> Handle(DeleteVendorProductDocumentCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId)
            || !Guid.TryParse(request.ListingId, out var listingId)
            || !Guid.TryParse(request.DocumentId, out var documentId))
        {
            return Result.Failure(new Error("vendors.listing.invalid_id", "Vendor/listing/document id must be a valid UUID.", ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        var document = await repository.GetVendorProductDocumentByIdAsync(vendorId, listingId, documentId, cancellationToken);
        if (document is null)
        {
            return Result.Failure(new Error("vendors.listing.document.not_found", "Listing document not found.", ErrorCategory.NotFound));
        }

        document.IsDeleted = true;
        document.DeletedAt = DateTimeOffset.UtcNow;
        document.DeletedBy = vendorId;
        await repository.UpdateVendorProductDocumentAsync(document, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public sealed record UpdateProductCategoryCommand(
    string Id,
    string CategoryName,
    bool PrescriptionRequired,
    bool DepositRequired,
    bool InstallationRequired,
    bool IsActive) : ICommand<ProductCategoryDto>;

public sealed class UpdateProductCategoryCommandValidator : AbstractValidator<UpdateProductCategoryCommand>
{
    public UpdateProductCategoryCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.CategoryName).NotEmpty().MaximumLength(150);
    }
}

internal sealed class UpdateProductCategoryCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpdateProductCategoryCommand, ProductCategoryDto>
{
    public async Task<Result<ProductCategoryDto>> Handle(UpdateProductCategoryCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.Id, out var categoryId))
        {
            return Result.Failure<ProductCategoryDto>(new Error("products.invalid_category_id", "Category id must be a valid UUID.", ErrorCategory.Validation));
        }

        var entity = await repository.GetProductCategoryByIdAsync(categoryId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<ProductCategoryDto>(new Error("products.category_not_found", "Product category not found.", ErrorCategory.NotFound));
        }

        entity.CategoryName = request.CategoryName;
        entity.PrescriptionRequired = request.PrescriptionRequired;
        entity.DepositRequired = request.DepositRequired;
        entity.InstallationRequired = request.InstallationRequired;
        entity.IsActive = request.IsActive;

        await repository.UpdateProductCategoryAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new ProductCategoryDto(
            entity.Id.ToString(),
            entity.CategoryName,
            entity.PrescriptionRequired,
            entity.DepositRequired,
            entity.InstallationRequired,
            entity.IsActive));
    }
}

public sealed record DeleteProductCategoryCommand(string Id) : ICommand;

public sealed class DeleteProductCategoryCommandValidator : AbstractValidator<DeleteProductCategoryCommand>
{
    public DeleteProductCategoryCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
    }
}

internal sealed class DeleteProductCategoryCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<DeleteProductCategoryCommand>
{
    public async Task<Result> Handle(DeleteProductCategoryCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.Id, out var categoryId))
        {
            return Result.Failure(new Error("products.invalid_category_id", "Category id must be a valid UUID.", ErrorCategory.Validation));
        }

        var entity = await repository.GetProductCategoryByIdAsync(categoryId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure(new Error("products.category_not_found", "Product category not found.", ErrorCategory.NotFound));
        }

        // Check if category has products
        var products = await repository.GetProductsAsync(categoryId, cancellationToken);
        if (products.Any())
        {
            return Result.Failure(new Error("products.category_has_products", "Cannot delete category with existing products.", ErrorCategory.Validation));
        }

        await repository.DeleteProductCategoryAsync(categoryId, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

public sealed record UpdateProductCommand(
    string Id,
    string CategoryId,
    string ProductName,
    string? BrandName,
    string? ModelName,
    string? ShortDescription,
    string? LongDescription,
    bool IsActive) : ICommand<ProductDto>;

public sealed class UpdateProductCommandValidator : AbstractValidator<UpdateProductCommand>
{
    public UpdateProductCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.ProductName).NotEmpty().MaximumLength(255);
    }
}

internal sealed class UpdateProductCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpdateProductCommand, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(UpdateProductCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.Id, out var productId))
        {
            return Result.Failure<ProductDto>(new Error("products.invalid_product_id", "Product id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.CategoryId, out var categoryId))
        {
            return Result.Failure<ProductDto>(new Error("products.invalid_category_id", "Category id must be a valid UUID.", ErrorCategory.Validation));
        }

        var entity = await repository.GetProductByIdAsync(productId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<ProductDto>(new Error("products.product_not_found", "Product not found.", ErrorCategory.NotFound));
        }

        var category = await repository.GetProductCategoryByIdAsync(categoryId, cancellationToken);
        if (category is null)
        {
            return Result.Failure<ProductDto>(new Error("products.category_not_found", "Product category not found.", ErrorCategory.NotFound));
        }

        entity.CategoryId = categoryId;
        entity.ProductName = request.ProductName;
        entity.BrandName = request.BrandName;
        entity.ModelName = request.ModelName;
        entity.ShortDescription = request.ShortDescription;
        entity.LongDescription = request.LongDescription;
        entity.IsActive = request.IsActive;

        await repository.UpdateProductAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new ProductDto(
            entity.Id.ToString(),
            entity.CategoryId.ToString(),
            entity.ProductName,
            entity.BrandName,
            entity.ModelName,
            entity.ShortDescription,
            entity.LongDescription,
            entity.IsActive));
    }
}

public sealed record DeleteProductCommand(string Id) : ICommand;

public sealed class DeleteProductCommandValidator : AbstractValidator<DeleteProductCommand>
{
    public DeleteProductCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
    }
}

internal sealed class DeleteProductCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<DeleteProductCommand>
{
    public async Task<Result> Handle(DeleteProductCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.Id, out var productId))
        {
            return Result.Failure(new Error("products.invalid_product_id", "Product id must be a valid UUID.", ErrorCategory.Validation));
        }

        var entity = await repository.GetProductByIdAsync(productId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure(new Error("products.product_not_found", "Product not found.", ErrorCategory.NotFound));
        }

        await repository.DeleteProductAsync(productId, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

public sealed record UploadCatalogExcelCommand(byte[] FileData) : ICommand<ExcelUploadResponseDto>;

public sealed class UploadCatalogExcelCommandValidator : AbstractValidator<UploadCatalogExcelCommand>
{
    public UploadCatalogExcelCommandValidator()
    {
        RuleFor(x => x.FileData).NotEmpty().WithMessage("File data is required.");
    }
}

internal sealed class UploadCatalogExcelCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UploadCatalogExcelCommand, ExcelUploadResponseDto>
{
    public async Task<Result<ExcelUploadResponseDto>> Handle(UploadCatalogExcelCommand request, CancellationToken cancellationToken)
    {
        var errors = new List<ExcelUploadErrorDto>();
        var categoriesCreated = 0;
        var productsCreated = 0;

        try
        {
            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
            
            using var stream = new MemoryStream(request.FileData);
            using var package = new ExcelPackage(stream);
            
            // Get all sheets
            var categoriesSheet = package.Workbook.Worksheets.FirstOrDefault(ws => ws.Name.Equals("Categories", StringComparison.OrdinalIgnoreCase));
            var productsSheet = package.Workbook.Worksheets.FirstOrDefault(ws => ws.Name.Equals("Products", StringComparison.OrdinalIgnoreCase));
            
            if (categoriesSheet == null && productsSheet == null)
            {
                return Result.Failure<ExcelUploadResponseDto>(new Error("excel.no_sheets", "Excel file must contain 'Categories' and/or 'Products' sheets.", ErrorCategory.Validation));
            }

            // Process Categories sheet
            if (categoriesSheet != null)
            {
                var rowCount = categoriesSheet.Dimension?.Rows ?? 0;
                if (rowCount > 1) // Skip header row
                {
                    for (int row = 2; row <= rowCount; row++)
                    {
                        try
                        {
                            var categoryName = categoriesSheet.Cells[row, 1].Text?.Trim();
                            var prescriptionRequiredText = categoriesSheet.Cells[row, 2].Text?.Trim();
                            var depositRequiredText = categoriesSheet.Cells[row, 3].Text?.Trim();
                            var installationRequiredText = categoriesSheet.Cells[row, 4].Text?.Trim();
                            var isActiveText = categoriesSheet.Cells[row, 5].Text?.Trim();

                            // Validate required fields
                            if (string.IsNullOrEmpty(categoryName))
                            {
                                errors.Add(new ExcelUploadErrorDto(row, "Categories", "category_name", "Category name is required."));
                                continue;
                            }

                            // Parse boolean fields
                            bool prescriptionRequired = prescriptionRequiredText?.ToLower() == "true" || prescriptionRequiredText?.ToLower() == "yes" || prescriptionRequiredText == "1";
                            bool depositRequired = depositRequiredText?.ToLower() == "true" || depositRequiredText?.ToLower() == "yes" || depositRequiredText == "1";
                            bool installationRequired = installationRequiredText?.ToLower() == "true" || installationRequiredText?.ToLower() == "yes" || installationRequiredText == "1";
                            bool isActive = string.IsNullOrEmpty(isActiveText) || isActiveText?.ToLower() == "true" || isActiveText?.ToLower() == "yes" || isActiveText == "1";

                            // Check if category already exists
                            var existingCategories = await repository.GetProductCategoriesAsync(cancellationToken);
                            if (existingCategories.Any(c => c.CategoryName.Equals(categoryName, StringComparison.OrdinalIgnoreCase)))
                            {
                                errors.Add(new ExcelUploadErrorDto(row, "Categories", "category_name", $"Category '{categoryName}' already exists."));
                                continue;
                            }

                            // Create category
                            var category = new ProductCategory
                            {
                                CategoryName = categoryName,
                                PrescriptionRequired = prescriptionRequired,
                                DepositRequired = depositRequired,
                                InstallationRequired = installationRequired,
                                IsActive = isActive
                            };

                            await repository.AddProductCategoryAsync(category, cancellationToken);
                            categoriesCreated++;
                        }
                        catch (Exception ex)
                        {
                            errors.Add(new ExcelUploadErrorDto(row, "Categories", "row", $"Error processing row: {ex.Message}"));
                        }
                    }
                }
            }

            await repository.SaveChangesAsync(cancellationToken);

            // Reload categories to get their IDs for product mapping
            var allCategories = await repository.GetProductCategoriesAsync(cancellationToken);
            var categoryMap = allCategories.ToDictionary(c => c.CategoryName, c => c.Id, StringComparer.OrdinalIgnoreCase);

            // Process Products sheet
            if (productsSheet != null)
            {
                var rowCount = productsSheet.Dimension?.Rows ?? 0;
                if (rowCount > 1) // Skip header row
                {
                    for (int row = 2; row <= rowCount; row++)
                    {
                        try
                        {
                            var categoryName = productsSheet.Cells[row, 1].Text?.Trim();
                            var productName = productsSheet.Cells[row, 2].Text?.Trim();
                            var brandName = productsSheet.Cells[row, 3].Text?.Trim();
                            var modelName = productsSheet.Cells[row, 4].Text?.Trim();
                            var shortDescription = productsSheet.Cells[row, 5].Text?.Trim();
                            var longDescription = productsSheet.Cells[row, 6].Text?.Trim();
                            var isActiveText = productsSheet.Cells[row, 7].Text?.Trim();

                            // Validate required fields
                            if (string.IsNullOrEmpty(categoryName))
                            {
                                errors.Add(new ExcelUploadErrorDto(row, "Products", "category_name", "Category name is required."));
                                continue;
                            }

                            if (string.IsNullOrEmpty(productName))
                            {
                                errors.Add(new ExcelUploadErrorDto(row, "Products", "product_name", "Product name is required."));
                                continue;
                            }

                            // Find category
                            if (!categoryMap.TryGetValue(categoryName, out var categoryId))
                            {
                                errors.Add(new ExcelUploadErrorDto(row, "Products", "category_name", $"Category '{categoryName}' not found. Create it in the Categories sheet first."));
                                continue;
                            }

                            // Parse boolean field
                            bool isActive = string.IsNullOrEmpty(isActiveText) || isActiveText?.ToLower() == "true" || isActiveText?.ToLower() == "yes" || isActiveText == "1";

                            // Create product
                            var product = new Product
                            {
                                CategoryId = categoryId,
                                ProductName = productName,
                                BrandName = string.IsNullOrEmpty(brandName) ? null : brandName,
                                ModelName = string.IsNullOrEmpty(modelName) ? null : modelName,
                                ShortDescription = string.IsNullOrEmpty(shortDescription) ? null : shortDescription,
                                LongDescription = string.IsNullOrEmpty(longDescription) ? null : longDescription,
                                IsActive = isActive
                            };

                            await repository.AddProductAsync(product, cancellationToken);
                            productsCreated++;
                        }
                        catch (Exception ex)
                        {
                            errors.Add(new ExcelUploadErrorDto(row, "Products", "row", $"Error processing row: {ex.Message}"));
                        }
                    }
                }
            }

            await repository.SaveChangesAsync(cancellationToken);

            return Result.Success(new ExcelUploadResponseDto(
                errors.Count == 0,
                errors,
                categoriesCreated,
                productsCreated));
        }
        catch (Exception ex)
        {
            return Result.Failure<ExcelUploadResponseDto>(new Error("excel.upload_failed", $"Failed to process Excel file: {ex.Message}", ErrorCategory.Validation));
        }
    }
}
