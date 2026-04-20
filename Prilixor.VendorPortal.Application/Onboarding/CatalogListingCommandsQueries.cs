using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

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
    public UpsertVendorProductListingCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.ListingTitle).NotEmpty().MaximumLength(255);
        RuleFor(x => x.DailyRent).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MonthlyRent).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SecurityDeposit).GreaterThanOrEqualTo(0);
        RuleFor(x => x.AvailableQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ListingStatus).NotEmpty().MaximumLength(30);
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
        entity.ListingStatus = request.ListingStatus;
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
