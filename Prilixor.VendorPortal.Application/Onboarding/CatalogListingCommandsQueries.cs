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
    bool IsChemical,
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
            IsChemical = request.IsChemical,
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
            entity.IsChemical,
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
            x.IsChemical,
            x.IsActive)).ToList();

        return Result.Success(result);
    }
}

public sealed record CreateOrUpdateProductVariantDto(
    string? Id,
    string Sku,
    decimal SizeValue,
    string SizeUnit,
    decimal VendorPrice,
    decimal BuyPrice,
    bool IsActive);

public sealed record CreateProductCommand(
    string CategoryId,
    string ProductName,
    string? BrandName,
    string? ModelName,
    string? ShortDescription,
    string? LongDescription,
    decimal DailyRent,
    decimal MonthlyRent,
    decimal SecurityDeposit,
    decimal? BuyPrice,
    decimal VendorDailyRent,
    decimal VendorMonthlyRent,
    decimal VendorSecurityDeposit,
    decimal? VendorBuyPrice,
    decimal GstPercent,
    bool IsRentEnabled,
    bool IsBuyEnabled,
    bool IsActive,
    List<CreateOrUpdateProductVariantDto>? Variants = null,
    string? CasNumber = null,
    string? ChemicalFormula = null,
    decimal? PurityPercentage = null,
    decimal? MolecularWeight = null,
    string? BaseUnit = null,
    string? SdsDocumentUrl = null,
    string? CoaDocumentUrl = null) : ICommand<ProductDto>;

public sealed class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator()
    {
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.ProductName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.DailyRent).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MonthlyRent).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SecurityDeposit).GreaterThanOrEqualTo(0);
        RuleFor(x => x.BuyPrice).GreaterThanOrEqualTo(0).When(x => x.BuyPrice.HasValue);
        RuleFor(x => x.GstPercent).GreaterThanOrEqualTo(0).LessThanOrEqualTo(100);
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
            DailyRent = request.DailyRent,
            MonthlyRent = request.MonthlyRent,
            SecurityDeposit = request.SecurityDeposit,
            BuyPrice = request.BuyPrice,
            VendorDailyRent = request.VendorDailyRent,
            VendorMonthlyRent = request.VendorMonthlyRent,
            VendorSecurityDeposit = request.VendorSecurityDeposit,
            VendorBuyPrice = request.VendorBuyPrice,
            GstPercent = request.GstPercent,
            IsRentEnabled = request.IsRentEnabled,
            IsBuyEnabled = request.IsBuyEnabled,
            IsActive = request.IsActive
        };

        if (request.Variants != null && request.Variants.Count > 0)
        {
            entity.Variants = request.Variants.Select(v => new ProductVariant
            {
                Id = string.IsNullOrEmpty(v.Id) ? Guid.NewGuid() : Guid.Parse(v.Id),
                ProductId = entity.Id,
                Sku = v.Sku,
                SizeValue = v.SizeValue,
                SizeUnit = v.SizeUnit,
                VendorPrice = v.VendorPrice,
                BuyPrice = v.BuyPrice,
                IsActive = v.IsActive
            }).ToList();
        }

        if (request.CasNumber != null || request.ChemicalFormula != null || request.BaseUnit != null)
        {
            entity.ChemicalProperty = new ChemicalProperty
            {
                CasNumber = request.CasNumber,
                ChemicalFormula = request.ChemicalFormula,
                PurityPercentage = request.PurityPercentage,
                MolecularWeight = request.MolecularWeight,
                BaseUnit = request.BaseUnit ?? "Kg",
                SdsDocumentUrl = request.SdsDocumentUrl,
                CoaDocumentUrl = request.CoaDocumentUrl
            };
        }

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
            entity.DailyRent,
            entity.MonthlyRent,
            entity.SecurityDeposit,
            entity.BuyPrice,
            entity.VendorDailyRent,
            entity.VendorMonthlyRent,
            entity.VendorSecurityDeposit,
            entity.VendorBuyPrice,
            entity.GstPercent,
            entity.IsRentEnabled,
            entity.IsBuyEnabled,
            entity.IsActive,
            [],
            entity.Variants?.Select(v => new ProductVariantDto(
                v.Id.ToString(),
                v.ProductId.ToString(),
                v.Sku,
                v.SizeValue,
                v.SizeUnit,
                v.VendorPrice,
                v.BuyPrice,
                v.IsActive)).ToList() ?? [],
            entity.ChemicalProperty?.CasNumber,
            entity.ChemicalProperty?.ChemicalFormula,
            entity.ChemicalProperty?.PurityPercentage,
            entity.ChemicalProperty?.MolecularWeight,
            entity.ChemicalProperty?.BaseUnit,
            entity.ChemicalProperty?.SdsDocumentUrl,
            entity.ChemicalProperty?.CoaDocumentUrl,
            0));
    }
}

public sealed record GetProductsQuery(string? CategoryId) : IQuery<List<ProductDto>>;

internal sealed class GetProductsQueryHandler(
    IVendorOnboardingRepository repository,
    ICustomerRepository customerRepository)
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

        var productIds = rows.Select(x => x.Id).ToList();
        var favoriteCounts = new Dictionary<Guid, int>();
        if (productIds.Any())
        {
            favoriteCounts = await customerRepository.GetFavoriteCountsByProductsAsync(cancellationToken);
        }

        var result = rows.Select(x => new ProductDto(
            x.Id.ToString(),
            x.CategoryId.ToString(),
            x.ProductName,
            x.BrandName,
            x.ModelName,
            x.ShortDescription,
            x.LongDescription,
            x.DailyRent,
            x.MonthlyRent,
            x.SecurityDeposit,
            x.BuyPrice,
            x.VendorDailyRent,
            x.VendorMonthlyRent,
            x.VendorSecurityDeposit,
            x.VendorBuyPrice,
            x.GstPercent,
            x.IsRentEnabled,
            x.IsBuyEnabled,
            x.IsActive,
            x.ProductImages?.Select(i => new ProductImageDto(i.Id.ToString(), i.ProductId.ToString(), i.ImageUrl, i.DisplayOrder, i.IsPrimary)).ToList() ?? [],
            x.Variants?.Select(v => new ProductVariantDto(
                v.Id.ToString(),
                v.ProductId.ToString(),
                v.Sku,
                v.SizeValue,
                v.SizeUnit,
                v.VendorPrice,
                v.BuyPrice,
                v.IsActive)).ToList() ?? [],
            x.ChemicalProperty?.CasNumber,
            x.ChemicalProperty?.ChemicalFormula,
            x.ChemicalProperty?.PurityPercentage,
            x.ChemicalProperty?.MolecularWeight,
            x.ChemicalProperty?.BaseUnit,
            x.ChemicalProperty?.SdsDocumentUrl,
            x.ChemicalProperty?.CoaDocumentUrl,
            favoriteCounts.GetValueOrDefault(x.Id, 0))).ToList();

        return Result.Success(result);
    }
}

public sealed record AddProductImageCommand(
    string ProductId,
    string ImageUrl,
    int DisplayOrder,
    bool IsPrimary) : ICommand<ProductImageDto>;

public sealed class AddProductImageCommandValidator : AbstractValidator<AddProductImageCommand>
{
    public AddProductImageCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.ImageUrl).NotEmpty();
        RuleFor(x => x.DisplayOrder).GreaterThan(0);
    }
}

internal sealed class AddProductImageCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
    : ICommandHandler<AddProductImageCommand, ProductImageDto>
{
    public async Task<Result<ProductImageDto>> Handle(AddProductImageCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.ProductId, out var productId))
        {
            return Result.Failure<ProductImageDto>(new Error("products.invalid_id", "Product id must be a valid UUID.", ErrorCategory.Validation));
        }

        var product = await repository.GetProductByIdAsync(productId, cancellationToken);
        if (product is null)
        {
            return Result.Failure<ProductImageDto>(new Error("products.not_found", "Product not found.", ErrorCategory.NotFound));
        }

        if (request.IsPrimary)
        {
            var existingImages = await repository.GetProductImagesAsync(productId, cancellationToken);
            foreach (var img in existingImages.Where(i => i.IsPrimary))
            {
                img.IsPrimary = false;
                await repository.UpdateProductImageAsync(img, cancellationToken);
            }
        }

        var entity = new ProductImage
        {
            ProductId = productId,
            ImageUrl = request.ImageUrl,
            DisplayOrder = request.DisplayOrder,
            IsPrimary = request.IsPrimary
        };

        await repository.AddProductImageAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new ProductImageDto(
            entity.Id.ToString(),
            entity.ProductId.ToString(),
            fileUrlResolver.Resolve(entity.ImageUrl),
            entity.DisplayOrder,
            entity.IsPrimary));
    }
}

public sealed record GetProductImagesQuery(string ProductId) : IQuery<List<ProductImageDto>>;

internal sealed class GetProductImagesQueryHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
    : IQueryHandler<GetProductImagesQuery, List<ProductImageDto>>
{
    public async Task<Result<List<ProductImageDto>>> Handle(GetProductImagesQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.ProductId, out var productId))
        {
            return Result.Failure<List<ProductImageDto>>(new Error("products.invalid_id", "Product id must be a valid UUID.", ErrorCategory.Validation));
        }

        var product = await repository.GetProductByIdAsync(productId, cancellationToken);
        if (product is null)
        {
            return Result.Failure<List<ProductImageDto>>(new Error("products.not_found", "Product not found.", ErrorCategory.NotFound));
        }

        var rows = await repository.GetProductImagesAsync(productId, cancellationToken);
        var result = rows.Select(x => new ProductImageDto(
            x.Id.ToString(),
            x.ProductId.ToString(),
            fileUrlResolver.Resolve(x.ImageUrl),
            x.DisplayOrder,
            x.IsPrimary)).ToList();

        return Result.Success(result);
    }
}

public sealed record DeleteProductImageCommand(string ProductId, string ImageId) : ICommand;

public sealed class DeleteProductImageCommandValidator : AbstractValidator<DeleteProductImageCommand>
{
    public DeleteProductImageCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.ImageId).NotEmpty();
    }
}

internal sealed class DeleteProductImageCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorUploadStorageService uploadStorage)
    : ICommandHandler<DeleteProductImageCommand>
{
    public async Task<Result> Handle(DeleteProductImageCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.ProductId, out var productId)
            || !Guid.TryParse(request.ImageId, out var imageId))
        {
            return Result.Failure(new Error("products.image.invalid_id", "Product/image id must be a valid UUID.", ErrorCategory.Validation));
        }

        var product = await repository.GetProductByIdAsync(productId, cancellationToken);
        if (product is null)
        {
            return Result.Failure(new Error("products.not_found", "Product not found.", ErrorCategory.NotFound));
        }

        var image = await repository.GetProductImageByIdAsync(productId, imageId, cancellationToken);
        if (image is null)
        {
            return Result.Failure(new Error("products.image.not_found", "Product image not found.", ErrorCategory.NotFound));
        }

        await uploadStorage.DeleteStoredFileAsync(image.ImageUrl, cancellationToken);

        var wasPrimary = image.IsPrimary;
        image.IsDeleted = true;
        image.DeletedAt = DateTimeOffset.UtcNow;
        image.IsPrimary = false;
        await repository.UpdateProductImageAsync(image, cancellationToken);

        if (wasPrimary)
        {
            var remaining = await repository.GetProductImagesAsync(productId, cancellationToken);
            var fallback = remaining
                .Where(x => x.Id != imageId)
                .OrderBy(x => x.DisplayOrder)
                .FirstOrDefault();

            if (fallback is not null && !fallback.IsPrimary)
            {
                fallback.IsPrimary = true;
                await repository.UpdateProductImageAsync(fallback, cancellationToken);
            }
        }

        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public sealed record UpsertVendorProductListingCommand(
    string VendorId,
    string? ListingId,
    string ProductId,
    string ListingTitle,
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
        RuleFor(x => x.AvailableQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ListingStatus)
            .NotEmpty()
            .MaximumLength(30)
            .Must(status => AllowedListingStatuses.Contains(status.Trim().ToLowerInvariant()))
            .WithMessage("Listing status is invalid.");
    }
}

internal sealed class UpsertVendorProductListingCommandHandler(
    IVendorOnboardingRepository repository,
    ICustomerRepository customerRepository)
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

        // Check if vendor account is pending
        if (vendor.AccountStatus?.ToLowerInvariant() == "pending")
        {
            return Result.Failure<VendorProductListingDto>(new Error("vendors.account_pending", "Cannot create listings while account is pending approval.", ErrorCategory.Validation));
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
            var existing = await repository.GetVendorProductListingByVendorProductAsync(vendorId, productId, cancellationToken);
            if (existing is not null && !existing.IsDeleted)
            {
                return Result.Failure<VendorProductListingDto>(new Error(
                    "vendors.listing.duplicate",
                    "You already have an active listing for this product.",
                    ErrorCategory.Validation));
            }

            entity = existing ?? new VendorProductListing { VendorId = vendorId, ProductId = productId };

            if (entity.IsDeleted)
            {
                entity.IsDeleted = false;
                entity.DeletedAt = null;
                entity.DeletedBy = null;
            }
        }

        var wasOutOfStock = entity.Id != Guid.Empty && entity.AvailableQuantity <= 0;
        var isNowAvailable = request.AvailableQuantity > 0;

        entity.ListingTitle = request.ListingTitle;
        entity.DailyRent = product.DailyRent;
        entity.MonthlyRent = product.MonthlyRent;
        entity.SecurityDeposit = product.SecurityDeposit;
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

        if (wasOutOfStock && isNowAvailable && entity.Id != Guid.Empty)
        {
            var customerIds = await customerRepository.GetCustomersByFavoriteListingAsync(entity.Id, cancellationToken);
            foreach (var cid in customerIds)
            {
                var notification = new Prilixor.VendorPortal.Domain.Customers.CustomerNotification
                {
                    CustomerId = cid,
                    NotificationType = "back_in_stock",
                    Title = "A favorite item is back in stock!",
                    Body = $"Good news! {entity.ListingTitle} from your favorites is now available to rent."
                };
                await customerRepository.AddCustomerNotificationAsync(notification, cancellationToken);
            }
            if (customerIds.Any())
            {
                await customerRepository.SaveChangesAsync(cancellationToken);
            }
        }

        await repository.SaveChangesAsync(cancellationToken);
        
        var favoriteCounts = await customerRepository.GetFavoriteCountsByProductsAsync(cancellationToken);

        return Result.Success(new VendorProductListingDto(
            entity.Id.ToString(),
            entity.VendorId.ToString(),
            entity.ProductId.ToString(),
            entity.ListingTitle,
            entity.DailyRent,
            entity.MonthlyRent,
            entity.SecurityDeposit,
            entity.AvailableQuantity,
            entity.ListingStatus,
            favoriteCounts.GetValueOrDefault(entity.ProductId, 0)));
    }
}

public sealed record DeleteVendorProductListingCommand(string VendorId, string ListingId) : ICommand;

public sealed class DeleteVendorProductListingCommandValidator : AbstractValidator<DeleteVendorProductListingCommand>
{
    public DeleteVendorProductListingCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
    }
}

internal sealed class DeleteVendorProductListingCommandHandler(
    IVendorOnboardingRepository repository,
    ICustomerRepository customerRepository)
    : ICommandHandler<DeleteVendorProductListingCommand>
{
    public async Task<Result> Handle(DeleteVendorProductListingCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId)
            || !Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure(new Error("vendors.listing.invalid_id", "Vendor/listing id must be a valid UUID.", ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        // Check if there are active customer rental orders for this listing
        if (await customerRepository.HasActiveOrdersForListingAsync(listingId, cancellationToken))
        {
            return Result.Failure(new Error(
                "vendors.listing.active_orders",
                "Cannot delete listing because there are active or pending customer rental orders associated with it. Please complete or cancel those orders first.",
                ErrorCategory.Validation));
        }

        await repository.DeleteVendorProductListingAsync(vendorId, listingId, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public sealed record GetVendorProductListingsQuery(string VendorId) : IQuery<List<VendorProductListingDto>>;

internal sealed class GetVendorProductListingsQueryHandler(
    IVendorOnboardingRepository repository,
    ICustomerRepository customerRepository)
    : IQueryHandler<GetVendorProductListingsQuery, List<VendorProductListingDto>>
{
    public async Task<Result<List<VendorProductListingDto>>> Handle(GetVendorProductListingsQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<List<VendorProductListingDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var rows = await repository.GetVendorProductListingsAsync(vendorId, cancellationToken);
        
        var listingIds = rows.Select(x => x.Id).ToList();
        var favoriteCounts = new Dictionary<Guid, int>();
        if (listingIds.Any())
        {
            favoriteCounts = await customerRepository.GetFavoriteCountsByProductsAsync(cancellationToken);
        }

        // Determine which products belong to chemical categories
        var chemicalProductIds = await repository.GetChemicalProductIdsAsync(
            rows.Select(x => x.ProductId).Distinct().ToList(), cancellationToken);

        var result = rows.Select(x => new VendorProductListingDto(
            x.Id.ToString(),
            x.VendorId.ToString(),
            x.ProductId.ToString(),
            x.ListingTitle,
            x.DailyRent,
            x.MonthlyRent,
            x.SecurityDeposit,
            x.AvailableQuantity,
            x.ListingStatus,
            favoriteCounts.GetValueOrDefault(x.ProductId, 0),
            chemicalProductIds.Contains(x.ProductId))).ToList();

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

internal sealed class AddVendorProductImageCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
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

        if (request.IsPrimary)
        {
            var existingImages = await repository.GetVendorProductImagesAsync(listingId, cancellationToken);
            foreach (var img in existingImages.Where(i => i.IsPrimary))
            {
                img.IsPrimary = false;
                await repository.UpdateVendorProductImageAsync(img, cancellationToken);
            }
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
            fileUrlResolver.Resolve(entity.ImageUrl),
            entity.DisplayOrder,
            entity.IsPrimary));
    }
}

public sealed record GetVendorProductImagesQuery(string VendorId, string ListingId) : IQuery<List<VendorProductImageDto>>;

internal sealed class GetVendorProductImagesQueryHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
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
            fileUrlResolver.Resolve(x.ImageUrl),
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

internal sealed class DeleteVendorProductImageCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorUploadStorageService uploadStorage)
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

        await uploadStorage.DeleteStoredFileAsync(image.ImageUrl, cancellationToken);

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

public sealed record SetPrimaryProductImageCommand(string ProductId, string ImageId) : ICommand;

public sealed class SetPrimaryProductImageCommandValidator : AbstractValidator<SetPrimaryProductImageCommand>
{
    public SetPrimaryProductImageCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.ImageId).NotEmpty();
    }
}

internal sealed class SetPrimaryProductImageCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<SetPrimaryProductImageCommand>
{
    public async Task<Result> Handle(SetPrimaryProductImageCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.ProductId, out var productId)
            || !Guid.TryParse(request.ImageId, out var imageId))
        {
            return Result.Failure(new Error("products.image.invalid_id", "Product/image id must be a valid UUID.", ErrorCategory.Validation));
        }

        var product = await repository.GetProductByIdAsync(productId, cancellationToken);
        if (product is null)
        {
            return Result.Failure(new Error("products.not_found", "Product not found.", ErrorCategory.NotFound));
        }

        var image = await repository.GetProductImageByIdAsync(productId, imageId, cancellationToken);
        if (image is null)
        {
            return Result.Failure(new Error("products.image.not_found", "Product image not found.", ErrorCategory.NotFound));
        }

        var existing = await repository.GetProductImagesAsync(productId, cancellationToken);
        foreach (var row in existing.Where(x => x.IsPrimary && x.Id != imageId))
        {
            row.IsPrimary = false;
            await repository.UpdateProductImageAsync(row, cancellationToken);
        }

        if (!image.IsPrimary)
        {
            image.IsPrimary = true;
            await repository.UpdateProductImageAsync(image, cancellationToken);
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

internal sealed class AddVendorProductDocumentCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
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
            fileUrlResolver.Resolve(entity.FileUrl),
            entity.VerificationStatus,
            entity.RejectionReason,
            entity.VerifiedAt));
    }
}

public sealed record GetVendorProductDocumentsQuery(string VendorId, string ListingId) : IQuery<List<VendorProductDocumentDto>>;

internal sealed class GetVendorProductDocumentsQueryHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
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
            fileUrlResolver.Resolve(x.FileUrl),
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

internal sealed class DeleteVendorProductDocumentCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorUploadStorageService uploadStorage)
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

        await uploadStorage.DeleteStoredFileAsync(document.FileUrl, cancellationToken);

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
    bool IsChemical,
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
        entity.IsChemical = request.IsChemical;
        entity.IsActive = request.IsActive;

        await repository.UpdateProductCategoryAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new ProductCategoryDto(
            entity.Id.ToString(),
            entity.CategoryName,
            entity.PrescriptionRequired,
            entity.DepositRequired,
            entity.InstallationRequired,
            entity.IsChemical,
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
    decimal DailyRent,
    decimal MonthlyRent,
    decimal SecurityDeposit,
    decimal? BuyPrice,
    decimal VendorDailyRent,
    decimal VendorMonthlyRent,
    decimal VendorSecurityDeposit,
    decimal? VendorBuyPrice,
    decimal GstPercent,
    bool IsRentEnabled,
    bool IsBuyEnabled,
    bool IsActive,
    List<CreateOrUpdateProductVariantDto>? Variants = null,
    string? CasNumber = null,
    string? ChemicalFormula = null,
    decimal? PurityPercentage = null,
    decimal? MolecularWeight = null,
    string? BaseUnit = null,
    string? SdsDocumentUrl = null,
    string? CoaDocumentUrl = null) : ICommand<ProductDto>;

public sealed class UpdateProductCommandValidator : AbstractValidator<UpdateProductCommand>
{
    public UpdateProductCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.ProductName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.DailyRent).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MonthlyRent).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SecurityDeposit).GreaterThanOrEqualTo(0);
        RuleFor(x => x.BuyPrice).GreaterThanOrEqualTo(0).When(x => x.BuyPrice.HasValue);
        RuleFor(x => x.GstPercent).GreaterThanOrEqualTo(0).LessThanOrEqualTo(100);
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
        entity.DailyRent = request.DailyRent;
        entity.MonthlyRent = request.MonthlyRent;
        entity.SecurityDeposit = request.SecurityDeposit;
        entity.BuyPrice = request.BuyPrice;
        entity.VendorDailyRent = request.VendorDailyRent;
        entity.VendorMonthlyRent = request.VendorMonthlyRent;
        entity.VendorSecurityDeposit = request.VendorSecurityDeposit;
        entity.VendorBuyPrice = request.VendorBuyPrice;
        entity.GstPercent = request.GstPercent;
        entity.IsRentEnabled = request.IsRentEnabled;
        entity.IsBuyEnabled = request.IsBuyEnabled;
        entity.IsActive = request.IsActive;

        if (request.Variants != null)
        {
            entity.Variants ??= new List<ProductVariant>();
            foreach (var v in request.Variants)
            {
                var existing = entity.Variants.FirstOrDefault(x => (!string.IsNullOrEmpty(v.Id) && x.Id == Guid.Parse(v.Id)) || x.Sku == v.Sku);
                if (existing is null)
                {
                    entity.Variants.Add(new ProductVariant
                    {
                        Id = string.IsNullOrEmpty(v.Id) ? Guid.NewGuid() : Guid.Parse(v.Id),
                        ProductId = entity.Id,
                        Sku = v.Sku,
                        SizeValue = v.SizeValue,
                        SizeUnit = v.SizeUnit,
                        VendorPrice = v.VendorPrice,
                        BuyPrice = v.BuyPrice,
                        IsActive = v.IsActive
                    });
                }
                else
                {
                    existing.Sku = v.Sku;
                    existing.SizeValue = v.SizeValue;
                    existing.SizeUnit = v.SizeUnit;
                    existing.VendorPrice = v.VendorPrice;
                    existing.BuyPrice = v.BuyPrice;
                    existing.IsActive = v.IsActive;
                }
            }
            var toRemove = entity.Variants
                .Where(x => !request.Variants.Any(v => (!string.IsNullOrEmpty(v.Id) && x.Id == Guid.Parse(v.Id)) || x.Sku == v.Sku))
                .ToList();
            foreach (var tr in toRemove)
            {
                entity.Variants.Remove(tr);
            }
        }

        if (request.CasNumber != null || request.ChemicalFormula != null || request.BaseUnit != null)
        {
            entity.ChemicalProperty ??= new ChemicalProperty { ProductId = entity.Id };
            entity.ChemicalProperty.CasNumber = request.CasNumber;
            entity.ChemicalProperty.ChemicalFormula = request.ChemicalFormula;
            entity.ChemicalProperty.PurityPercentage = request.PurityPercentage;
            entity.ChemicalProperty.MolecularWeight = request.MolecularWeight;
            entity.ChemicalProperty.BaseUnit = request.BaseUnit ?? "Kg";
            entity.ChemicalProperty.SdsDocumentUrl = request.SdsDocumentUrl;
            entity.ChemicalProperty.CoaDocumentUrl = request.CoaDocumentUrl;
        }

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
            entity.DailyRent,
            entity.MonthlyRent,
            entity.SecurityDeposit,
            entity.BuyPrice,
            entity.VendorDailyRent,
            entity.VendorMonthlyRent,
            entity.VendorSecurityDeposit,
            entity.VendorBuyPrice,
            entity.GstPercent,
            entity.IsRentEnabled,
            entity.IsBuyEnabled,
            entity.IsActive,
            [],
            entity.Variants?.Select(v => new ProductVariantDto(
                v.Id.ToString(),
                v.ProductId.ToString(),
                v.Sku,
                v.SizeValue,
                v.SizeUnit,
                v.VendorPrice,
                v.BuyPrice,
                v.IsActive)).ToList() ?? [],
            entity.ChemicalProperty?.CasNumber,
            entity.ChemicalProperty?.ChemicalFormula,
            entity.ChemicalProperty?.PurityPercentage,
            entity.ChemicalProperty?.MolecularWeight,
            entity.ChemicalProperty?.BaseUnit,
            entity.ChemicalProperty?.SdsDocumentUrl,
            entity.ChemicalProperty?.CoaDocumentUrl,
            0));
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

public sealed record UploadCatalogExcelCommand(byte[] FileData, bool IsChemicalTemplate = false) : ICommand<ExcelUploadResponseDto>;

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
            ExcelPackage.License.SetNonCommercialPersonal("Prilixor");
            using var stream = new MemoryStream(request.FileData);
            using var package = new ExcelPackage(stream);
            
            // Get all sheets
            var categoriesSheet = package.Workbook.Worksheets.FirstOrDefault(ws => ws.Name.Equals("Categories", StringComparison.OrdinalIgnoreCase));
            var productsSheet = package.Workbook.Worksheets.FirstOrDefault(ws => ws.Name.Equals(request.IsChemicalTemplate ? "Chemicals" : "Products", StringComparison.OrdinalIgnoreCase))
                                ?? package.Workbook.Worksheets.FirstOrDefault(ws => ws.Name.Equals("Products", StringComparison.OrdinalIgnoreCase));
            var variantsSheet = package.Workbook.Worksheets.FirstOrDefault(ws => ws.Name.Equals("Variants", StringComparison.OrdinalIgnoreCase));
            
            if (categoriesSheet == null && productsSheet == null)
            {
                var sheetName = request.IsChemicalTemplate ? "'Chemicals'" : "'Products'";
                return Result.Failure<ExcelUploadResponseDto>(new Error("excel.no_sheets", $"Excel file must contain 'Categories' and/or {sheetName} sheets.", ErrorCategory.Validation));
            }

            // Process Variants sheet first if it exists
            var variantsLookup = new Dictionary<string, List<ProductVariant>>(StringComparer.OrdinalIgnoreCase);
            if (variantsSheet != null)
            {
                var vRowCount = variantsSheet.Dimension?.Rows ?? 0;
                if (vRowCount > 1)
                {
                    for (int row = 2; row <= vRowCount; row++)
                    {
                        try
                        {
                            var productName = variantsSheet.Cells[row, 1].Text?.Trim();
                            var sku = variantsSheet.Cells[row, 2].Text?.Trim();
                            var sizeValueText = variantsSheet.Cells[row, 3].Text?.Trim();
                            var sizeUnit = variantsSheet.Cells[row, 4].Text?.Trim();
                            var vendorPriceText = variantsSheet.Cells[row, 5].Text?.Trim();
                            var buyPriceText = variantsSheet.Cells[row, 6].Text?.Trim();
                            var isActiveText = variantsSheet.Cells[row, 7].Text?.Trim();

                            if (string.IsNullOrEmpty(productName) || string.IsNullOrEmpty(sku))
                            {
                                continue;
                            }

                            if (!decimal.TryParse(sizeValueText, out var sizeValue)) sizeValue = 1m;
                            if (!decimal.TryParse(vendorPriceText, out var vendorPrice)) vendorPrice = 0m;
                            if (!decimal.TryParse(buyPriceText, out var buyPrice)) buyPrice = 0m;
                            bool isActive = string.IsNullOrEmpty(isActiveText) || isActiveText?.ToLower() == "true" || isActiveText?.ToLower() == "yes" || isActiveText == "1";

                            var variant = new ProductVariant
                            {
                                Id = Guid.NewGuid(),
                                Sku = sku,
                                SizeValue = sizeValue,
                                SizeUnit = string.IsNullOrEmpty(sizeUnit) ? "Kg" : sizeUnit,
                                VendorPrice = vendorPrice,
                                BuyPrice = buyPrice,
                                IsActive = isActive
                            };

                            if (!variantsLookup.TryGetValue(productName, out var list))
                            {
                                list = new List<ProductVariant>();
                                variantsLookup[productName] = list;
                            }
                            list.Add(variant);
                        }
                        catch (Exception ex)
                        {
                            errors.Add(new ExcelUploadErrorDto(row, "Variants", "row", $"Error processing row: {ex.Message}"));
                        }
                    }
                }
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

                            // Check if category already exists (including deleted ones)
                            var existingCategories = await repository.GetProductCategoriesAsync(cancellationToken, includeDeleted: true);
                            var existingCategory = existingCategories.FirstOrDefault(c => c.CategoryName.Equals(categoryName, StringComparison.OrdinalIgnoreCase));

                            if (existingCategory != null)
                            {
                                if (!existingCategory.IsDeleted)
                                {
                                    errors.Add(new ExcelUploadErrorDto(row, "Categories", "category_name", $"Category '{categoryName}' already exists."));
                                    continue;
                                }

                                // Restore deleted category
                                existingCategory.IsDeleted = false;
                                existingCategory.DeletedAt = null;
                                existingCategory.DeletedBy = null;
                                existingCategory.PrescriptionRequired = prescriptionRequired;
                                existingCategory.DepositRequired = depositRequired;
                                existingCategory.InstallationRequired = installationRequired;
                                existingCategory.IsChemical = request.IsChemicalTemplate;
                                existingCategory.IsActive = isActive;

                                await repository.UpdateProductCategoryAsync(existingCategory, cancellationToken);
                                categoriesCreated++;
                            }
                            else
                            {
                                // Create category
                                var category = new ProductCategory
                                {
                                    CategoryName = categoryName,
                                    PrescriptionRequired = prescriptionRequired,
                                    DepositRequired = depositRequired,
                                    InstallationRequired = installationRequired,
                                    IsChemical = request.IsChemicalTemplate,
                                    IsActive = isActive
                                };

                                await repository.AddProductCategoryAsync(category, cancellationToken);
                                categoriesCreated++;
                            }
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
                            
                            string? modelName = null;
                            string? shortDescription;
                            string? longDescription;
                            string? dailyRentText = null;
                            string? monthlyRentText = null;
                            string? securityDepositText = null;
                            string? buyPriceText;
                            string? gstPercentText;
                            string? isRentEnabledText = null;
                            string? isBuyEnabledText = null;
                            string? isActiveText;
                            
                            // New fields for vendor pricing
                            string? vendorDailyRentText = null;
                            string? vendorMonthlyRentText = null;
                            string? vendorSecurityDepositText = null;
                            string? vendorBuyPriceText = null;
                            
                            string? casNumber = null;
                            string? chemicalFormula = null;
                            string? purityText = null;
                            string? molecularWeightText = null;
                            string? baseUnit = null;
                            string? sdsDocumentUrl = null;
                            string? coaDocumentUrl = null;

                            if (request.IsChemicalTemplate)
                            {
                                shortDescription = productsSheet.Cells[row, 4].Text?.Trim();
                                longDescription = productsSheet.Cells[row, 5].Text?.Trim();
                                buyPriceText = productsSheet.Cells[row, 6].Text?.Trim();
                                gstPercentText = productsSheet.Cells[row, 7].Text?.Trim();
                                casNumber = productsSheet.Cells[row, 8].Text?.Trim();
                                chemicalFormula = productsSheet.Cells[row, 9].Text?.Trim();
                                purityText = productsSheet.Cells[row, 10].Text?.Trim();
                                molecularWeightText = productsSheet.Cells[row, 11].Text?.Trim();
                                baseUnit = productsSheet.Cells[row, 12].Text?.Trim();
                                sdsDocumentUrl = productsSheet.Cells[row, 13].Text?.Trim();
                                coaDocumentUrl = productsSheet.Cells[row, 14].Text?.Trim();
                                isActiveText = productsSheet.Cells[row, 15].Text?.Trim();
                                vendorBuyPriceText = productsSheet.Cells[row, 16].Text?.Trim();

                                isRentEnabledText = "false";
                                isBuyEnabledText = "true";
                            }
                            else
                            {
                                modelName = productsSheet.Cells[row, 4].Text?.Trim();
                                shortDescription = productsSheet.Cells[row, 5].Text?.Trim();
                                longDescription = productsSheet.Cells[row, 6].Text?.Trim();
                                dailyRentText = productsSheet.Cells[row, 7].Text?.Trim();
                                monthlyRentText = productsSheet.Cells[row, 8].Text?.Trim();
                                securityDepositText = productsSheet.Cells[row, 9].Text?.Trim();
                                buyPriceText = productsSheet.Cells[row, 10].Text?.Trim();
                                gstPercentText = productsSheet.Cells[row, 11].Text?.Trim();
                                isRentEnabledText = productsSheet.Cells[row, 12].Text?.Trim();
                                isBuyEnabledText = productsSheet.Cells[row, 13].Text?.Trim();
                                isActiveText = productsSheet.Cells[row, 14].Text?.Trim();
                                vendorDailyRentText = productsSheet.Cells[row, 15].Text?.Trim();
                                vendorMonthlyRentText = productsSheet.Cells[row, 16].Text?.Trim();
                                vendorSecurityDepositText = productsSheet.Cells[row, 17].Text?.Trim();
                                vendorBuyPriceText = productsSheet.Cells[row, 18].Text?.Trim();
                            }

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
                            bool isRentEnabled = string.IsNullOrEmpty(isRentEnabledText) || isRentEnabledText?.ToLower() == "true" || isRentEnabledText?.ToLower() == "yes" || isRentEnabledText == "1";
                            bool isBuyEnabled = string.IsNullOrEmpty(isBuyEnabledText) || isBuyEnabledText?.ToLower() == "true" || isBuyEnabledText?.ToLower() == "yes" || isBuyEnabledText == "1";
                            if (!decimal.TryParse(dailyRentText, out var dailyRent)) dailyRent = 0m;
                            if (!decimal.TryParse(monthlyRentText, out var monthlyRent)) monthlyRent = 0m;
                            if (!decimal.TryParse(securityDepositText, out var securityDeposit)) securityDeposit = 0m;
                            decimal? buyPrice = null;
                            if (decimal.TryParse(buyPriceText, out var buyPriceParsed)) buyPrice = buyPriceParsed;

                            decimal? vendorDailyRent = decimal.TryParse(vendorDailyRentText, out var vdr) ? vdr : (decimal?)null;
                            decimal? vendorMonthlyRent = decimal.TryParse(vendorMonthlyRentText, out var vmr) ? vmr : (decimal?)null;
                            decimal? vendorSecurityDeposit = decimal.TryParse(vendorSecurityDepositText, out var vsd) ? vsd : (decimal?)null;
                            decimal? vendorBuyPrice = decimal.TryParse(vendorBuyPriceText, out var vbp) ? vbp : (decimal?)null;

                            if (!decimal.TryParse(gstPercentText, out var gstPercent)) gstPercent = 18m;

                            // Create product
                            var product = new Product
                            {
                                CategoryId = categoryId,
                                ProductName = productName,
                                BrandName = string.IsNullOrEmpty(brandName) ? null : brandName,
                                ModelName = string.IsNullOrEmpty(modelName) ? null : modelName,
                                ShortDescription = string.IsNullOrEmpty(shortDescription) ? null : shortDescription,
                                LongDescription = string.IsNullOrEmpty(longDescription) ? null : longDescription,
                                DailyRent = Math.Max(0m, dailyRent),
                                MonthlyRent = Math.Max(0m, monthlyRent),
                                SecurityDeposit = Math.Max(0m, securityDeposit),
                                BuyPrice = buyPrice is > 0m ? buyPrice : null,
                                VendorDailyRent = Math.Max(0m, vendorDailyRent ?? dailyRent),
                                VendorMonthlyRent = Math.Max(0m, vendorMonthlyRent ?? monthlyRent),
                                VendorSecurityDeposit = Math.Max(0m, vendorSecurityDeposit ?? securityDeposit),
                                VendorBuyPrice = vendorBuyPrice ?? buyPrice,
                                GstPercent = Math.Clamp(gstPercent, 0m, 100m),
                                IsRentEnabled = isRentEnabled,
                                IsBuyEnabled = isBuyEnabled,
                                IsActive = isActive,
                                Variants = new List<ProductVariant>()
                            };

                            if (variantsLookup.TryGetValue(productName, out var pVariants))
                            {
                                foreach (var v in pVariants)
                                {
                                    v.ProductId = product.Id;
                                    product.Variants.Add(v);
                                }
                            }

                            if (request.IsChemicalTemplate || !string.IsNullOrWhiteSpace(casNumber) || !string.IsNullOrWhiteSpace(chemicalFormula) || !string.IsNullOrWhiteSpace(baseUnit))
                            {
                                decimal? purity = decimal.TryParse(purityText, out var p) ? p : null;
                                decimal? molecularWeight = decimal.TryParse(molecularWeightText, out var mw) ? mw : null;

                                product.ChemicalProperty = new ChemicalProperty
                                {
                                    CasNumber = string.IsNullOrWhiteSpace(casNumber) ? null : casNumber,
                                    ChemicalFormula = string.IsNullOrWhiteSpace(chemicalFormula) ? null : chemicalFormula,
                                    PurityPercentage = purity,
                                    MolecularWeight = molecularWeight,
                                    BaseUnit = string.IsNullOrWhiteSpace(baseUnit) ? "Kg" : baseUnit,
                                    SdsDocumentUrl = string.IsNullOrWhiteSpace(sdsDocumentUrl) ? null : sdsDocumentUrl,
                                    CoaDocumentUrl = string.IsNullOrWhiteSpace(coaDocumentUrl) ? null : coaDocumentUrl
                                };
                            }

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

// Download existing catalog data as Excel
public sealed record DownloadCatalogExcelQuery(bool IsChemicalTemplate = false) : IQuery<byte[]>;

internal sealed class DownloadCatalogExcelQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<DownloadCatalogExcelQuery, byte[]>
{
    public async Task<Result<byte[]>> Handle(DownloadCatalogExcelQuery request, CancellationToken cancellationToken)
    {
        try
        {
            ExcelPackage.License.SetNonCommercialPersonal("Prilixor");
            using var package = new ExcelPackage();

            // Get all categories and products
            var categories = await repository.GetProductCategoriesAsync(cancellationToken);
            var products = await repository.GetProductsAsync(null, cancellationToken);

            // Create Categories sheet
            var categoriesSheet = package.Workbook.Worksheets.Add("Categories");
            categoriesSheet.Cells[1, 1].Value = "category_name";
            categoriesSheet.Cells[1, 2].Value = "prescription_required";
            categoriesSheet.Cells[1, 3].Value = "deposit_required";
            categoriesSheet.Cells[1, 4].Value = "installation_required";
            categoriesSheet.Cells[1, 5].Value = "is_active";

            // Style header row
            using (var headerRange = categoriesSheet.Cells[1, 1, 1, 5])
            {
                headerRange.Style.Font.Bold = true;
                headerRange.Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
                headerRange.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGray);
            }

            // Add category data
            var row = 2;
            foreach (var category in categories)
            {
                categoriesSheet.Cells[row, 1].Value = category.CategoryName;
                categoriesSheet.Cells[row, 2].Value = category.PrescriptionRequired;
                categoriesSheet.Cells[row, 3].Value = category.DepositRequired;
                categoriesSheet.Cells[row, 4].Value = category.InstallationRequired;
                categoriesSheet.Cells[row, 5].Value = category.IsActive;
                row++;
            }

            // Auto-fit columns
            categoriesSheet.Cells[1, 1, 1, 5].AutoFitColumns();

            // Create Products/Chemicals sheet
            var sheetName = request.IsChemicalTemplate ? "Chemicals" : "Products";
            var productsSheet = package.Workbook.Worksheets.Add(sheetName);
            
            if (request.IsChemicalTemplate)
            {
                productsSheet.Cells[1, 1].Value = "category_name";
                productsSheet.Cells[1, 2].Value = "product_name";
                productsSheet.Cells[1, 3].Value = "brand_name";
                productsSheet.Cells[1, 4].Value = "short_description";
                productsSheet.Cells[1, 5].Value = "long_description";
                productsSheet.Cells[1, 6].Value = "buy_price";
                productsSheet.Cells[1, 7].Value = "gst_percent";
                productsSheet.Cells[1, 8].Value = "cas_number";
                productsSheet.Cells[1, 9].Value = "chemical_formula";
                productsSheet.Cells[1, 10].Value = "purity_percentage";
                productsSheet.Cells[1, 11].Value = "molecular_weight";
                productsSheet.Cells[1, 12].Value = "base_unit";
                productsSheet.Cells[1, 13].Value = "sds_document_url";
                productsSheet.Cells[1, 14].Value = "coa_document_url";
                productsSheet.Cells[1, 15].Value = "is_active";
                productsSheet.Cells[1, 16].Value = "vendor_buy_price";

                using (var headerRange = productsSheet.Cells[1, 1, 1, 16])
                {
                    headerRange.Style.Font.Bold = true;
                    headerRange.Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
                    headerRange.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGray);
                }

                row = 2;
                foreach (var product in products.Where(p => p.ChemicalProperty != null))
                {
                    var category = categories.FirstOrDefault(c => c.Id == product.CategoryId);
                    productsSheet.Cells[row, 1].Value = category?.CategoryName ?? "";
                    productsSheet.Cells[row, 2].Value = product.ProductName;
                    productsSheet.Cells[row, 3].Value = product.BrandName;
                    productsSheet.Cells[row, 4].Value = product.ShortDescription;
                    productsSheet.Cells[row, 5].Value = product.LongDescription;
                    productsSheet.Cells[row, 6].Value = product.BuyPrice;
                    productsSheet.Cells[row, 7].Value = product.GstPercent;
                    productsSheet.Cells[row, 8].Value = product.ChemicalProperty?.CasNumber;
                    productsSheet.Cells[row, 9].Value = product.ChemicalProperty?.ChemicalFormula;
                    productsSheet.Cells[row, 10].Value = product.ChemicalProperty?.PurityPercentage;
                    productsSheet.Cells[row, 11].Value = product.ChemicalProperty?.MolecularWeight;
                    productsSheet.Cells[row, 12].Value = product.ChemicalProperty?.BaseUnit;
                    productsSheet.Cells[row, 13].Value = product.ChemicalProperty?.SdsDocumentUrl;
                    productsSheet.Cells[row, 14].Value = product.ChemicalProperty?.CoaDocumentUrl;
                    productsSheet.Cells[row, 15].Value = product.IsActive;
                    productsSheet.Cells[row, 16].Value = product.VendorBuyPrice;
                    row++;
                }
                productsSheet.Cells[1, 1, 1, 16].AutoFitColumns();
            }
            else
            {
                productsSheet.Cells[1, 1].Value = "category_name";
                productsSheet.Cells[1, 2].Value = "product_name";
                productsSheet.Cells[1, 3].Value = "brand_name";
                productsSheet.Cells[1, 4].Value = "model_name";
                productsSheet.Cells[1, 5].Value = "short_description";
                productsSheet.Cells[1, 6].Value = "long_description";
                productsSheet.Cells[1, 7].Value = "daily_rent";
                productsSheet.Cells[1, 8].Value = "monthly_rent";
                productsSheet.Cells[1, 9].Value = "security_deposit";
                productsSheet.Cells[1, 10].Value = "buy_price";
                productsSheet.Cells[1, 11].Value = "gst_percent";
                productsSheet.Cells[1, 12].Value = "is_rent_enabled";
                productsSheet.Cells[1, 13].Value = "is_buy_enabled";
                productsSheet.Cells[1, 14].Value = "is_active";
                productsSheet.Cells[1, 15].Value = "vendor_daily_rent";
                productsSheet.Cells[1, 16].Value = "vendor_monthly_rent";
                productsSheet.Cells[1, 17].Value = "vendor_security_deposit";
                productsSheet.Cells[1, 18].Value = "vendor_buy_price";

                using (var headerRange = productsSheet.Cells[1, 1, 1, 18])
                {
                    headerRange.Style.Font.Bold = true;
                    headerRange.Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
                    headerRange.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGray);
                }

                row = 2;
                foreach (var product in products.Where(p => p.ChemicalProperty == null))
                {
                    var category = categories.FirstOrDefault(c => c.Id == product.CategoryId);
                    productsSheet.Cells[row, 1].Value = category?.CategoryName ?? "";
                    productsSheet.Cells[row, 2].Value = product.ProductName;
                    productsSheet.Cells[row, 3].Value = product.BrandName;
                    productsSheet.Cells[row, 4].Value = product.ModelName;
                    productsSheet.Cells[row, 5].Value = product.ShortDescription;
                    productsSheet.Cells[row, 6].Value = product.LongDescription;
                    productsSheet.Cells[row, 7].Value = product.DailyRent;
                    productsSheet.Cells[row, 8].Value = product.MonthlyRent;
                    productsSheet.Cells[row, 9].Value = product.SecurityDeposit;
                    productsSheet.Cells[row, 10].Value = product.BuyPrice;
                    productsSheet.Cells[row, 11].Value = product.GstPercent;
                    productsSheet.Cells[row, 12].Value = product.IsRentEnabled;
                    productsSheet.Cells[row, 13].Value = product.IsBuyEnabled;
                    productsSheet.Cells[row, 14].Value = product.IsActive;
                    productsSheet.Cells[row, 15].Value = product.VendorDailyRent;
                    productsSheet.Cells[row, 16].Value = product.VendorMonthlyRent;
                    productsSheet.Cells[row, 17].Value = product.VendorSecurityDeposit;
                    productsSheet.Cells[row, 18].Value = product.VendorBuyPrice;
                    row++;
                }
                productsSheet.Cells[1, 1, 1, 18].AutoFitColumns();
            }

            // Create Variants sheet if chemical template or if there are variants
            var downloadVariantsSheet = package.Workbook.Worksheets.Add("Variants");
            downloadVariantsSheet.Cells[1, 1].Value = "product_name";
            downloadVariantsSheet.Cells[1, 2].Value = "sku";
            downloadVariantsSheet.Cells[1, 3].Value = "size_value";
            downloadVariantsSheet.Cells[1, 4].Value = "size_unit";
            downloadVariantsSheet.Cells[1, 5].Value = "vendor_price";
            downloadVariantsSheet.Cells[1, 6].Value = "buy_price";
            downloadVariantsSheet.Cells[1, 7].Value = "is_active";

            using (var headerRange = downloadVariantsSheet.Cells[1, 1, 1, 7])
            {
                headerRange.Style.Font.Bold = true;
                headerRange.Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
                headerRange.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGray);
            }

            var variantRow = 2;
            foreach (var product in products)
            {
                if (product.Variants != null && product.Variants.Count > 0)
                {
                    foreach (var v in product.Variants)
                    {
                        downloadVariantsSheet.Cells[variantRow, 1].Value = product.ProductName;
                        downloadVariantsSheet.Cells[variantRow, 2].Value = v.Sku;
                        downloadVariantsSheet.Cells[variantRow, 3].Value = v.SizeValue;
                        downloadVariantsSheet.Cells[variantRow, 4].Value = v.SizeUnit;
                        downloadVariantsSheet.Cells[variantRow, 5].Value = v.VendorPrice;
                        downloadVariantsSheet.Cells[variantRow, 6].Value = v.BuyPrice;
                        downloadVariantsSheet.Cells[variantRow, 7].Value = v.IsActive;
                        variantRow++;
                    }
                }
            }
            downloadVariantsSheet.Cells[1, 1, 1, 7].AutoFitColumns();

            // Save to byte array
            var excelData = package.GetAsByteArray();
            return Result.Success(excelData);
        }
        catch (Exception ex)
        {
            return Result.Failure<byte[]>(new Error("excel.download_failed", $"Failed to generate Excel file: {ex.Message}"));
        }
    }
}
