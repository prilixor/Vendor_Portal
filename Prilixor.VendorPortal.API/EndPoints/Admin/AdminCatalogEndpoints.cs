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
    public bool IsActive { get; set; } = true;
}

public sealed class UpdateProductCategoryRequest
{
    public string Id { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public bool PrescriptionRequired { get; set; }
    public bool DepositRequired { get; set; }
    public bool InstallationRequired { get; set; }
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
    public bool IsActive { get; set; } = true;
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
    public bool IsActive { get; set; }
}

// Category Endpoints
public sealed class GetProductCategoriesEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<ProductCategoryDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/categories");
        Group<AdminApiGroup>();
        AllowAnonymous();
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
        AllowAnonymous();
    }

    public override async Task<Results<Ok<ProductCategoryDto>, ProblemHttpResult>> ExecuteAsync(CreateProductCategoryRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateProductCategoryCommand(
            req.CategoryName,
            req.PrescriptionRequired,
            req.DepositRequired,
            req.InstallationRequired,
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
        AllowAnonymous();
    }

    public override async Task<Results<Ok<ProductCategoryDto>, ProblemHttpResult>> ExecuteAsync(UpdateProductCategoryRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateProductCategoryCommand(
            req.Id,
            req.CategoryName,
            req.PrescriptionRequired,
            req.DepositRequired,
            req.InstallationRequired,
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
        AllowAnonymous();
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
        AllowAnonymous();
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
        AllowAnonymous();
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
            req.IsActive), ct);

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
        AllowAnonymous();
    }

    public override async Task<Results<Ok<ProductDto>, ProblemHttpResult>> ExecuteAsync(UpdateProductRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateProductCommand(
            req.Id,
            req.CategoryId,
            req.ProductName,
            req.BrandName,
            req.ModelName,
            req.ShortDescription,
            req.LongDescription,
            req.IsActive), ct);

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
        AllowAnonymous();
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

// Excel Upload Endpoint
public sealed class UploadCatalogExcelEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<ExcelUploadResponseDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/upload-excel");
        Group<AdminApiGroup>();
        AllowAnonymous();
        AllowFileUploads();
    }

    public override async Task<Results<Ok<ExcelUploadResponseDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var file = Files.FirstOrDefault();
        if (file == null)
        {
            return TypedResults.Problem("No file uploaded.");
        }

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream, ct);
        var fileData = memoryStream.ToArray();

        var result = await mediator.Send(new UploadCatalogExcelCommand(fileData), ct);
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
        AllowAnonymous();
    }

    public override async Task<Results<FileStreamHttpResult, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new DownloadCatalogExcelQuery(), ct);
        
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
