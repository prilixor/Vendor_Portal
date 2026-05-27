using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public sealed class CreateProductCategoryRequest
{
    public string CategoryName { get; set; } = string.Empty;
    public bool PrescriptionRequired { get; set; }
    public bool DepositRequired { get; set; }
    public bool InstallationRequired { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class GetProductsRequest
{
    public string? CategoryId { get; set; }
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

public class UpsertVendorProductListingRequest : VendorIdRequest
{
    public string ProductId { get; set; } = string.Empty;
    public string ListingTitle { get; set; } = string.Empty;
    public int AvailableQuantity { get; set; }
    public string ListingStatus { get; set; } = "draft";
}

public sealed class UpdateVendorProductListingRequest : UpsertVendorProductListingRequest
{
    public string ListingId { get; set; } = string.Empty;
}

public sealed class AddVendorProductImageRequest : VendorIdRequest
{
    public string ListingId { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; } = 1;
    public bool IsPrimary { get; set; }
}

public sealed class VendorListingRequest : VendorIdRequest
{
    public string ListingId { get; set; } = string.Empty;
}

public sealed class AddVendorProductDocumentRequest : VendorIdRequest
{
    public string ListingId { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
}

public sealed class DeleteVendorProductImageRequest : VendorIdRequest
{
    public string ListingId { get; set; } = string.Empty;
    public string ImageId { get; set; } = string.Empty;
}

public sealed class DeleteVendorProductDocumentRequest : VendorIdRequest
{
    public string ListingId { get; set; } = string.Empty;
    public string DocumentId { get; set; } = string.Empty;
}

public sealed class DeleteVendorProductListingRequest : VendorIdRequest
{
    public string ListingId { get; set; } = string.Empty;
}

public sealed class CreateProductCategoryEndpoint(IMediator mediator)
    : Endpoint<CreateProductCategoryRequest, Results<Ok<ProductCategoryDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/categories");
        Group<VendorOnboardingGroup>();
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

public sealed class GetProductCategoriesEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<ProductCategoryDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/categories");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<ProductCategoryDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetProductCategoriesQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CreateProductEndpoint(IMediator mediator)
    : Endpoint<CreateProductRequest, Results<Ok<ProductDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/products");
        Group<VendorOnboardingGroup>();
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
            0m,
            0m,
            0m,
            null,
            18m,
            true,
            true,
            req.IsActive), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetProductsEndpoint(IMediator mediator)
    : Endpoint<GetProductsRequest, Results<Ok<List<ProductDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/products");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<ProductDto>>, ProblemHttpResult>> ExecuteAsync(GetProductsRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetProductsQuery(req.CategoryId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CreateVendorProductListingEndpoint(IMediator mediator)
    : Endpoint<UpsertVendorProductListingRequest, Results<Ok<VendorProductListingDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/listings");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorProductListingDto>, ProblemHttpResult>> ExecuteAsync(UpsertVendorProductListingRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpsertVendorProductListingCommand(
            req.VendorId,
            null,
            req.ProductId,
            req.ListingTitle,
            req.AvailableQuantity,
            req.ListingStatus), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateVendorProductListingEndpoint(IMediator mediator)
    : Endpoint<UpdateVendorProductListingRequest, Results<Ok<VendorProductListingDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("{vendorId}/listings/{listingId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorProductListingDto>, ProblemHttpResult>> ExecuteAsync(UpdateVendorProductListingRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpsertVendorProductListingCommand(
            req.VendorId,
            req.ListingId,
            req.ProductId,
            req.ListingTitle,
            req.AvailableQuantity,
            req.ListingStatus), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorProductListingsEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<List<VendorProductListingDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/listings");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorProductListingDto>>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorProductListingsQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AddVendorProductImageEndpoint(IMediator mediator)
    : Endpoint<AddVendorProductImageRequest, Results<Ok<VendorProductImageDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/listings/{listingId}/images");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorProductImageDto>, ProblemHttpResult>> ExecuteAsync(AddVendorProductImageRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new AddVendorProductImageCommand(
            req.VendorId,
            req.ListingId,
            req.ImageUrl,
            req.DisplayOrder,
            req.IsPrimary), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorProductImagesEndpoint(IMediator mediator)
    : Endpoint<VendorListingRequest, Results<Ok<List<VendorProductImageDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/listings/{listingId}/images");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorProductImageDto>>, ProblemHttpResult>> ExecuteAsync(VendorListingRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorProductImagesQuery(req.VendorId, req.ListingId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AddVendorProductDocumentEndpoint(IMediator mediator)
    : Endpoint<AddVendorProductDocumentRequest, Results<Ok<VendorProductDocumentDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/listings/{listingId}/documents");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorProductDocumentDto>, ProblemHttpResult>> ExecuteAsync(AddVendorProductDocumentRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new AddVendorProductDocumentCommand(
            req.VendorId,
            req.ListingId,
            req.DocumentType,
            req.FileUrl), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorProductDocumentsEndpoint(IMediator mediator)
    : Endpoint<VendorListingRequest, Results<Ok<List<VendorProductDocumentDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/listings/{listingId}/documents");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorProductDocumentDto>>, ProblemHttpResult>> ExecuteAsync(VendorListingRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorProductDocumentsQuery(req.VendorId, req.ListingId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteVendorProductImageEndpoint(IMediator mediator)
    : Endpoint<DeleteVendorProductImageRequest, Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("{vendorId}/listings/{listingId}/images/{imageId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(DeleteVendorProductImageRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteVendorProductImageCommand(req.VendorId, req.ListingId, req.ImageId), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}

public sealed class DeleteVendorProductDocumentEndpoint(IMediator mediator)
    : Endpoint<DeleteVendorProductDocumentRequest, Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("{vendorId}/listings/{listingId}/documents/{documentId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(DeleteVendorProductDocumentRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteVendorProductDocumentCommand(req.VendorId, req.ListingId, req.DocumentId), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}

public sealed class DeleteVendorProductListingEndpoint(IMediator mediator)
    : Endpoint<DeleteVendorProductListingRequest, Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("{vendorId}/listings/{listingId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(DeleteVendorProductListingRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteVendorProductListingCommand(req.VendorId, req.ListingId), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}
