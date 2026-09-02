using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.API.EndPoints.Vendors;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class CreateProductCategoryRequest
{
    public string CategoryName { get; set; } = string.Empty;
    public bool PrescriptionRequired { get; set; }
    public bool DepositRequired { get; set; }
    public bool InstallationRequired { get; set; }
    public bool IsChemical { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class UpdateProductCategoryRequest
{
    public string Id { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public bool PrescriptionRequired { get; set; }
    public bool DepositRequired { get; set; }
    public bool InstallationRequired { get; set; }
    public bool IsChemical { get; set; }
    public bool IsActive { get; set; }
}

public sealed class CreateProductRequest
{
    public string CategoryId { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string? BrandName { get; set; }
    public string? ModelName { get; set; }
    public string? ShortDescription { get; set; }
    public string? LongDescription { get; set; }
    public decimal DailyRent { get; set; }
    public decimal WeeklyRent { get; set; }
    public decimal MonthlyRent { get; set; }
    public decimal SecurityDeposit { get; set; }
    public decimal? BuyPrice { get; set; }
    public decimal VendorDailyRent { get; set; }
    public decimal VendorWeeklyRent { get; set; }
    public decimal VendorMonthlyRent { get; set; }
    public decimal VendorSecurityDeposit { get; set; }
    public decimal? VendorBuyPrice { get; set; }
    public decimal GstPercent { get; set; } = 18m;
    public bool IsRentEnabled { get; set; } = true;
    public bool IsBuyEnabled { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public List<CreateOrUpdateProductVariantDto>? Variants { get; set; }
    public List<CreateOrUpdateProductRentalPricingPlanDto>? RentalPricingPlans { get; set; }
    public string? CasNumber { get; set; }
    public string? ChemicalFormula { get; set; }
    public decimal? PurityPercentage { get; set; }
    public decimal? MolecularWeight { get; set; }
    public string? BaseUnit { get; set; }
    public string? SdsDocumentUrl { get; set; }
    public string? CoaDocumentUrl { get; set; }
}

public sealed class UpdateProductRequest
{
    public string Id { get; set; } = string.Empty;
    public string CategoryId { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string? BrandName { get; set; }
    public string? ModelName { get; set; }
    public string? ShortDescription { get; set; }
    public string? LongDescription { get; set; }
    public decimal DailyRent { get; set; }
    public decimal WeeklyRent { get; set; }
    public decimal MonthlyRent { get; set; }
    public decimal SecurityDeposit { get; set; }
    public decimal? BuyPrice { get; set; }
    public decimal VendorDailyRent { get; set; }
    public decimal VendorWeeklyRent { get; set; }
    public decimal VendorMonthlyRent { get; set; }
    public decimal VendorSecurityDeposit { get; set; }
    public decimal? VendorBuyPrice { get; set; }
    public decimal GstPercent { get; set; } = 18m;
    public bool IsRentEnabled { get; set; } = true;
    public bool IsBuyEnabled { get; set; } = true;
    public bool IsActive { get; set; }
    public List<CreateOrUpdateProductVariantDto>? Variants { get; set; }
    public List<CreateOrUpdateProductRentalPricingPlanDto>? RentalPricingPlans { get; set; }
    public string? CasNumber { get; set; }
    public string? ChemicalFormula { get; set; }
    public decimal? PurityPercentage { get; set; }
    public decimal? MolecularWeight { get; set; }
    public string? BaseUnit { get; set; }
    public string? SdsDocumentUrl { get; set; }
    public string? CoaDocumentUrl { get; set; }
}

public sealed class AddProductImageRequest
{
    public string ProductId { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public int DisplayOrder { get; set; } = 1;
    public bool IsPrimary { get; set; }
}

public sealed class ProductImagesRequest
{
    public string ProductId { get; set; } = string.Empty;
}

public sealed class DeleteProductImageRequest
{
    public string ProductId { get; set; } = string.Empty;
    public string ImageId { get; set; } = string.Empty;
}

public sealed class SetPrimaryProductImageRequest
{
    public string ProductId { get; set; } = string.Empty;
    public string ImageId { get; set; } = string.Empty;
}

public sealed class AddProductDocumentRequest
{
    public string ProductId { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
}

public sealed class ProductDocumentsRequest
{
    public string ProductId { get; set; } = string.Empty;
}

public sealed class DeleteProductDocumentRequest
{
    public string ProductId { get; set; } = string.Empty;
    public string DocumentId { get; set; } = string.Empty;
}

// Category Endpoints
public sealed class GetProductCategoriesEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<ProductCategoryDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/categories");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<List<ProductCategoryDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetProductCategoriesQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CreateProductCategoryEndpoint(IMediator mediator)
    : Endpoint<CreateProductCategoryRequest, Results<Ok<ProductCategoryDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/categories");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<ProductCategoryDto>, ProblemHttpResult>> ExecuteAsync(CreateProductCategoryRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateProductCategoryCommand(
            req.CategoryName,
            req.PrescriptionRequired,
            req.DepositRequired,
            req.InstallationRequired,
            req.IsChemical,
            req.IsActive), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateProductCategoryEndpoint(IMediator mediator)
    : Endpoint<UpdateProductCategoryRequest, Results<Ok<ProductCategoryDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("catalog/categories/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<ProductCategoryDto>, ProblemHttpResult>> ExecuteAsync(UpdateProductCategoryRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateProductCategoryCommand(
            req.Id,
            req.CategoryName,
            req.PrescriptionRequired,
            req.DepositRequired,
            req.InstallationRequired,
            req.IsChemical,
            req.IsActive), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteProductCategoryEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("catalog/categories/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var id = Route<string>("id");
        if (string.IsNullOrEmpty(id))
        {
            return TypedResults.Problem("Category ID is required.");
        }

        var result = await mediator.Send(new DeleteProductCategoryCommand(id), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}

// Product Endpoints
public sealed class GetProductsRequest
{
    public string? CategoryId { get; set; }
}

public sealed class GetProductsEndpoint(IMediator mediator)
    : Endpoint<GetProductsRequest, Results<Ok<List<ProductDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/products");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<List<ProductDto>>, ProblemHttpResult>> ExecuteAsync(GetProductsRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetProductsQuery(req.CategoryId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CreateProductEndpoint(IMediator mediator)
    : Endpoint<CreateProductRequest, Results<Ok<ProductDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/products");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<ProductDto>, ProblemHttpResult>> ExecuteAsync(CreateProductRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateProductCommand(
            req.CategoryId,
            req.ProductName,
            req.BrandName,
            req.ModelName,
            req.ShortDescription,
            req.LongDescription,
            req.DailyRent,
            req.WeeklyRent,
            req.MonthlyRent,
            req.SecurityDeposit,
            req.BuyPrice,
            req.VendorDailyRent,
            req.VendorWeeklyRent,
            req.VendorMonthlyRent,
            req.VendorSecurityDeposit,
            req.VendorBuyPrice,
            req.GstPercent,
            req.IsRentEnabled,
            req.IsBuyEnabled,
            req.IsActive,
            req.Variants,
            req.RentalPricingPlans,
            req.CasNumber,
            req.ChemicalFormula,
            req.PurityPercentage,
            req.MolecularWeight,
            req.BaseUnit,
            req.SdsDocumentUrl,
            req.CoaDocumentUrl), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateProductEndpoint(IMediator mediator)
    : Endpoint<UpdateProductRequest, Results<Ok<ProductDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("catalog/products/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<ProductDto>, ProblemHttpResult>> ExecuteAsync(UpdateProductRequest req, CancellationToken ct)
    {
        req.Id = Route<string>("id") ?? req.Id;
        var result = await mediator.Send(new UpdateProductCommand(
            req.Id,
            req.CategoryId,
            req.ProductName,
            req.BrandName,
            req.ModelName,
            req.ShortDescription,
            req.LongDescription,
            req.DailyRent,
            req.WeeklyRent,
            req.MonthlyRent,
            req.SecurityDeposit,
            req.BuyPrice,
            req.VendorDailyRent,
            req.VendorWeeklyRent,
            req.VendorMonthlyRent,
            req.VendorSecurityDeposit,
            req.VendorBuyPrice,
            req.GstPercent,
            req.IsRentEnabled,
            req.IsBuyEnabled,
            req.IsActive,
            req.Variants,
            req.RentalPricingPlans,
            req.CasNumber,
            req.ChemicalFormula,
            req.PurityPercentage,
            req.MolecularWeight,
            req.BaseUnit,
            req.SdsDocumentUrl,
            req.CoaDocumentUrl), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteProductEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("catalog/products/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var id = Route<string>("id");
        if (string.IsNullOrEmpty(id))
        {
            return TypedResults.Problem("Product ID is required.");
        }

        var result = await mediator.Send(new DeleteProductCommand(id), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}

public sealed class RecalculateProductRentalPricingRequest
{
    public string ProductId { get; set; } = string.Empty;
    public bool ResetManualOverrides { get; set; }
}

public sealed class RecalculateProductRentalPricingEndpoint(IMediator mediator)
    : Endpoint<RecalculateProductRentalPricingRequest, Results<Ok<ProductDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/products/{productId}/rental-pricing/recalculate");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<ProductDto>, ProblemHttpResult>> ExecuteAsync(
        RecalculateProductRentalPricingRequest req,
        CancellationToken ct)
    {
        req.ProductId = Route<string>("productId") ?? req.ProductId;
        var result = await mediator.Send(
            new RecalculateProductRentalPricingCommand(req.ProductId, req.ResetManualOverrides),
            ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class RecalculateAllProductRentalPricingRequest
{
    public bool ResetManualOverrides { get; set; }
}

public sealed class RecalculateAllProductRentalPricingEndpoint(IMediator mediator)
    : Endpoint<RecalculateAllProductRentalPricingRequest, Results<Ok<RecalculateAllProductRentalPricingResultDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/rental-pricing/recalculate");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<RecalculateAllProductRentalPricingResultDto>, ProblemHttpResult>> ExecuteAsync(
        RecalculateAllProductRentalPricingRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new RecalculateAllProductRentalPricingCommand(req.ResetManualOverrides),
            ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class PreviewProductRentalPricingRequest
{
    public decimal DailyRent { get; set; }
    public decimal? BuyPrice { get; set; }
    public bool IsRentEnabled { get; set; } = true;
    public List<CreateOrUpdateProductRentalPricingPlanDto>? ExistingPlans { get; set; }
}

public sealed class PreviewProductRentalPricingEndpoint(IMediator mediator)
    : Endpoint<PreviewProductRentalPricingRequest, Results<Ok<PreviewProductRentalPricingDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/rental-pricing/preview");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<PreviewProductRentalPricingDto>, ProblemHttpResult>> ExecuteAsync(
        PreviewProductRentalPricingRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new PreviewProductRentalPricingQuery(req.DailyRent, req.BuyPrice, req.IsRentEnabled, req.ExistingPlans),
            ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AddProductImageEndpoint(IMediator mediator)
    : Endpoint<AddProductImageRequest, Results<Ok<ProductImageDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/products/{productId}/images");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<ProductImageDto>, ProblemHttpResult>> ExecuteAsync(AddProductImageRequest req, CancellationToken ct)
    {
        req.ProductId = Route<string>("productId") ?? req.ProductId;
        var result = await mediator.Send(new AddProductImageCommand(
            req.ProductId,
            req.ImageUrl,
            req.DisplayOrder,
            req.IsPrimary,
            req.ThumbnailUrl), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetProductImagesEndpoint(IMediator mediator)
    : Endpoint<ProductImagesRequest, Results<Ok<List<ProductImageDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/products/{productId}/images");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<List<ProductImageDto>>, ProblemHttpResult>> ExecuteAsync(ProductImagesRequest req, CancellationToken ct)
    {
        req.ProductId = Route<string>("productId") ?? req.ProductId;
        var result = await mediator.Send(new GetProductImagesQuery(req.ProductId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteProductImageEndpoint(IMediator mediator)
    : Endpoint<DeleteProductImageRequest, Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("catalog/products/{productId}/images/{imageId}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(DeleteProductImageRequest req, CancellationToken ct)
    {
        req.ProductId = Route<string>("productId") ?? req.ProductId;
        req.ImageId = Route<string>("imageId") ?? req.ImageId;
        var result = await mediator.Send(new DeleteProductImageCommand(req.ProductId, req.ImageId), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}

public sealed class SetPrimaryProductImageEndpoint(IMediator mediator)
    : Endpoint<SetPrimaryProductImageRequest, Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("catalog/products/{productId}/images/{imageId}/primary");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(SetPrimaryProductImageRequest req, CancellationToken ct)
    {
        req.ProductId = Route<string>("productId") ?? req.ProductId;
        req.ImageId = Route<string>("imageId") ?? req.ImageId;
        var result = await mediator.Send(new SetPrimaryProductImageCommand(req.ProductId, req.ImageId), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}

public sealed class AddProductDocumentEndpoint(IMediator mediator)
    : Endpoint<AddProductDocumentRequest, Results<Ok<ProductDocumentDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/products/{productId}/documents");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<ProductDocumentDto>, ProblemHttpResult>> ExecuteAsync(AddProductDocumentRequest req, CancellationToken ct)
    {
        req.ProductId = Route<string>("productId") ?? req.ProductId;
        var result = await mediator.Send(new AddProductDocumentCommand(
            req.ProductId,
            req.DocumentType,
            req.FileUrl), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetProductDocumentsEndpoint(IMediator mediator)
    : Endpoint<ProductDocumentsRequest, Results<Ok<List<ProductDocumentDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/products/{productId}/documents");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<List<ProductDocumentDto>>, ProblemHttpResult>> ExecuteAsync(ProductDocumentsRequest req, CancellationToken ct)
    {
        req.ProductId = Route<string>("productId") ?? req.ProductId;
        var result = await mediator.Send(new GetProductDocumentsQuery(req.ProductId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteProductDocumentEndpoint(IMediator mediator)
    : Endpoint<DeleteProductDocumentRequest, Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("catalog/products/{productId}/documents/{documentId}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(DeleteProductDocumentRequest req, CancellationToken ct)
    {
        req.ProductId = Route<string>("productId") ?? req.ProductId;
        req.DocumentId = Route<string>("documentId") ?? req.DocumentId;
        var result = await mediator.Send(new DeleteProductDocumentCommand(req.ProductId, req.DocumentId), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}

// Excel Upload Endpoint
public sealed class UploadCatalogExcelEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<ExcelUploadResponseDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/upload-excel");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
        AllowFileUploads();
    }

    public override async Task<Results<Ok<ExcelUploadResponseDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var file = Files.FirstOrDefault();
        if (file == null)
        {
            return TypedResults.Problem("No file uploaded.");
        }

        var isChemical = Query<bool>("isChemical", false);

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream, ct);
        var fileData = memoryStream.ToArray();

        var result = await mediator.Send(new UploadCatalogExcelCommand(fileData, isChemical), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

// Excel Download Endpoint
public sealed class DownloadCatalogExcelEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<FileStreamHttpResult, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/download-excel");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<FileStreamHttpResult, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var isChemical = Query<bool>("isChemical", false);
        var result = await mediator.Send(new DownloadCatalogExcelQuery(isChemical), ct);
        
        if (!result.IsSuccess)
        {
            return result.ToErrorResponse();
        }

        var stream = new MemoryStream(result.Value);
        return TypedResults.File(
            stream,
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileDownloadName: $"catalog_export_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx"
        );
    }
}

public sealed class BackfillProductImageThumbnailsRequest
{
    public int Limit { get; set; } = 50;
}

/// <summary>
/// One-time / repeatable Prod job: create missing _thumb files for existing S3/local product images.
/// POST /api/admin/catalog/images/backfill-thumbnails?limit=50
/// Re-run until response moreRemaining = false.
/// </summary>
public sealed class BackfillProductImageThumbnailsEndpoint(IMediator mediator)
    : Endpoint<BackfillProductImageThumbnailsRequest, Results<Ok<BackfillProductImageThumbnailsResult>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/images/backfill-thumbnails");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<BackfillProductImageThumbnailsResult>, ProblemHttpResult>> ExecuteAsync(
        BackfillProductImageThumbnailsRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new BackfillProductImageThumbnailsCommand(req.Limit <= 0 ? 50 : req.Limit), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetRentalDurationMastersRequest
{
    public bool ActiveOnly { get; set; }
}

public sealed class GetRentalDurationMastersEndpoint(IMediator mediator)
    : Endpoint<GetRentalDurationMastersRequest, Results<Ok<List<RentalDurationMasterDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/rental-durations");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<List<RentalDurationMasterDto>>, ProblemHttpResult>> ExecuteAsync(
        GetRentalDurationMastersRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new GetRentalDurationMastersQuery(req.ActiveOnly), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CreateRentalDurationMasterRequest
{
    public string DurationLabel { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    public decimal BillingCycles { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class CreateRentalDurationMasterEndpoint(IMediator mediator)
    : Endpoint<CreateRentalDurationMasterRequest, Results<Ok<RentalDurationMasterDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/rental-durations");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<RentalDurationMasterDto>, ProblemHttpResult>> ExecuteAsync(
        CreateRentalDurationMasterRequest req,
        CancellationToken ct)
    {
        var billingCycles = req.BillingCycles > 0
            ? req.BillingCycles
            : Math.Round(req.DurationDays / 28m, 2, MidpointRounding.AwayFromZero);
        var result = await mediator.Send(new CreateRentalDurationMasterCommand(
            req.DurationLabel,
            req.DurationDays,
            req.SortOrder,
            req.IsActive,
            billingCycles), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateRentalDurationMasterRequest
{
    public string Id { get; set; } = string.Empty;
    public string DurationLabel { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    public decimal BillingCycles { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class UpdateRentalDurationMasterEndpoint(IMediator mediator)
    : Endpoint<UpdateRentalDurationMasterRequest, Results<Ok<RentalDurationMasterDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("catalog/rental-durations/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<RentalDurationMasterDto>, ProblemHttpResult>> ExecuteAsync(
        UpdateRentalDurationMasterRequest req,
        CancellationToken ct)
    {
        req.Id = Route<string>("id") ?? req.Id;
        var billingCycles = req.BillingCycles > 0
            ? req.BillingCycles
            : Math.Round(req.DurationDays / 28m, 2, MidpointRounding.AwayFromZero);
        var result = await mediator.Send(new UpdateRentalDurationMasterCommand(
            req.Id,
            req.DurationLabel,
            req.DurationDays,
            req.SortOrder,
            req.IsActive,
            billingCycles), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteRentalDurationMasterRequest
{
    public string Id { get; set; } = string.Empty;
}

public sealed class DeleteRentalDurationMasterEndpoint(IMediator mediator)
    : Endpoint<DeleteRentalDurationMasterRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("catalog/rental-durations/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(
        DeleteRentalDurationMasterRequest req,
        CancellationToken ct)
    {
        req.Id = Route<string>("id") ?? req.Id;
        var result = await mediator.Send(new DeleteRentalDurationMasterCommand(req.Id), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class GetRentalDurationIconsRequest
{
    public bool ActiveOnly { get; set; }
}

public sealed class GetRentalDurationIconsEndpoint(IMediator mediator)
    : Endpoint<GetRentalDurationIconsRequest, Results<Ok<List<RentalDurationIconDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/rental-duration-icons");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<List<RentalDurationIconDto>>, ProblemHttpResult>> ExecuteAsync(
        GetRentalDurationIconsRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new GetRentalDurationIconsQuery(req.ActiveOnly), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CreateRentalDurationIconRequest
{
    public string Name { get; set; } = string.Empty;
    public string ValueTier { get; set; } = "good";
    public string ImageUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class CreateRentalDurationIconEndpoint(IMediator mediator)
    : Endpoint<CreateRentalDurationIconRequest, Results<Ok<RentalDurationIconDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/rental-duration-icons");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<RentalDurationIconDto>, ProblemHttpResult>> ExecuteAsync(
        CreateRentalDurationIconRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new CreateRentalDurationIconCommand(
            req.Name,
            req.ValueTier,
            req.ImageUrl,
            req.ThumbnailUrl,
            req.SortOrder,
            req.IsActive), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateRentalDurationIconRequest
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ValueTier { get; set; } = "good";
    public string ImageUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class UpdateRentalDurationIconEndpoint(IMediator mediator)
    : Endpoint<UpdateRentalDurationIconRequest, Results<Ok<RentalDurationIconDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("catalog/rental-duration-icons/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<RentalDurationIconDto>, ProblemHttpResult>> ExecuteAsync(
        UpdateRentalDurationIconRequest req,
        CancellationToken ct)
    {
        req.Id = Route<string>("id") ?? req.Id;
        var result = await mediator.Send(new UpdateRentalDurationIconCommand(
            req.Id,
            req.Name,
            req.ValueTier,
            req.ImageUrl,
            req.ThumbnailUrl,
            req.SortOrder,
            req.IsActive), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteRentalDurationIconRequest
{
    public string Id { get; set; } = string.Empty;
}

public sealed class DeleteRentalDurationIconEndpoint(IMediator mediator)
    : Endpoint<DeleteRentalDurationIconRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("catalog/rental-duration-icons/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(
        DeleteRentalDurationIconRequest req,
        CancellationToken ct)
    {
        req.Id = Route<string>("id") ?? req.Id;
        var result = await mediator.Send(new DeleteRentalDurationIconCommand(req.Id), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}
