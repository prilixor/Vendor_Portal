using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.EndPoints.Vendors;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Admin.WebsiteContent;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class GetAdminWebsiteContentEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<FullWebsiteContentDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("website-content");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<FullWebsiteContentDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetFullWebsiteContentQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateHomeContentEndpoint(IMediator mediator)
    : Endpoint<UpdateHomeContentCommand, Results<Ok<HomeContentDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("website-content/home");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<HomeContentDto>, ProblemHttpResult>> ExecuteAsync(UpdateHomeContentCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateAboutContentEndpoint(IMediator mediator)
    : Endpoint<UpdateAboutContentCommand, Results<Ok<AboutContentDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("website-content/about");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<AboutContentDto>, ProblemHttpResult>> ExecuteAsync(UpdateAboutContentCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpsertAudienceCategoryEndpoint(IMediator mediator)
    : Endpoint<UpsertAudienceCategoryCommand, Results<Ok<AudienceCategoryDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("website-content/about/audiences");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<AudienceCategoryDto>, ProblemHttpResult>> ExecuteAsync(UpsertAudienceCategoryCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteAudienceCategoryEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<bool>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("website-content/about/audiences/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<bool>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var idStr = Route<string>("id");
        if (!Guid.TryParse(idStr, out var id))
            return TypedResults.Problem("Invalid category ID.");

        var result = await mediator.Send(new DeleteAudienceCategoryCommand(id), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateServicesHeaderEndpoint(IMediator mediator)
    : Endpoint<UpdateServicesHeaderCommand, Results<Ok<ServicesHeaderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("website-content/services");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<ServicesHeaderDto>, ProblemHttpResult>> ExecuteAsync(UpdateServicesHeaderCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpsertServiceItemEndpoint(IMediator mediator)
    : Endpoint<UpsertServiceItemCommand, Results<Ok<ServiceItemDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("website-content/services/items");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<ServiceItemDto>, ProblemHttpResult>> ExecuteAsync(UpsertServiceItemCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteServiceItemEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<bool>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("website-content/services/items/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<bool>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var idStr = Route<string>("id");
        if (!Guid.TryParse(idStr, out var id))
            return TypedResults.Problem("Invalid service ID.");

        var result = await mediator.Send(new DeleteServiceItemCommand(id), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpsertFaqCategoryEndpoint(IMediator mediator)
    : Endpoint<UpsertFaqCategoryCommand, Results<Ok<FaqCategoryDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("website-content/faqs/categories");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<FaqCategoryDto>, ProblemHttpResult>> ExecuteAsync(UpsertFaqCategoryCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpsertFaqItemEndpoint(IMediator mediator)
    : Endpoint<UpsertFaqItemCommand, Results<Ok<FaqItemDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("website-content/faqs/items");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<FaqItemDto>, ProblemHttpResult>> ExecuteAsync(UpsertFaqItemCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteFaqItemEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<bool>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("website-content/faqs/items/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<bool>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var idStr = Route<string>("id");
        if (!Guid.TryParse(idStr, out var id))
            return TypedResults.Problem("Invalid FAQ ID.");

        var result = await mediator.Send(new DeleteFaqItemCommand(id), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateContactContentEndpoint(IMediator mediator)
    : Endpoint<UpdateContactContentCommand, Results<Ok<ContactContentDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("website-content/contact");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<ContactContentDto>, ProblemHttpResult>> ExecuteAsync(UpdateContactContentCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateRentVsBuyHeaderEndpoint(IMediator mediator)
    : Endpoint<UpdateRentVsBuyHeaderCommand, Results<Ok<RentVsBuyContentDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("website-content/rent-vs-buy");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<RentVsBuyContentDto>, ProblemHttpResult>> ExecuteAsync(UpdateRentVsBuyHeaderCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpsertRentVsBuyFeatureEndpoint(IMediator mediator)
    : Endpoint<UpsertRentVsBuyFeatureCommand, Results<Ok<RentVsBuyFeatureRowDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("website-content/rent-vs-buy/features");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<RentVsBuyFeatureRowDto>, ProblemHttpResult>> ExecuteAsync(UpsertRentVsBuyFeatureCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteRentVsBuyFeatureEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<bool>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("website-content/rent-vs-buy/features/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<bool>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var idStr = Route<string>("id");
        if (!Guid.TryParse(idStr, out var id))
            return TypedResults.Problem("Invalid Feature Row ID.");

        var result = await mediator.Send(new DeleteRentVsBuyFeatureCommand(id), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpsertRentVsBuyCardEndpoint(IMediator mediator)
    : Endpoint<UpsertRentVsBuyCardCommand, Results<Ok<RentVsBuyCardDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("website-content/rent-vs-buy/cards");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<RentVsBuyCardDto>, ProblemHttpResult>> ExecuteAsync(UpsertRentVsBuyCardCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteRentVsBuyCardEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<bool>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("website-content/rent-vs-buy/cards/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<bool>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var idStr = Route<string>("id");
        if (!Guid.TryParse(idStr, out var id))
            return TypedResults.Problem("Invalid Card ID.");

        var result = await mediator.Send(new DeleteRentVsBuyCardCommand(id), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateGlobalSettingsEndpoint(IMediator mediator)
    : Endpoint<UpdateGlobalSettingsCommand, Results<Ok<WebsiteSettingsDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("website-content/settings");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<WebsiteSettingsDto>, ProblemHttpResult>> ExecuteAsync(UpdateGlobalSettingsCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateHowItWorksHeaderEndpoint(IMediator mediator)
    : Endpoint<UpdateHowItWorksHeaderCommand, Results<Ok<HowItWorksHeaderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("website-content/how-it-works/header");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<HowItWorksHeaderDto>, ProblemHttpResult>> ExecuteAsync(UpdateHowItWorksHeaderCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpsertHowItWorksStepEndpoint(IMediator mediator)
    : Endpoint<UpsertHowItWorksStepCommand, Results<Ok<HowItWorksStepDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("website-content/how-it-works/steps");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<HowItWorksStepDto>, ProblemHttpResult>> ExecuteAsync(UpsertHowItWorksStepCommand req, CancellationToken ct)
    {
        var result = await mediator.Send(req, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteHowItWorksStepEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<bool>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("website-content/how-it-works/steps/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<bool>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var idStr = Route<string>("id");
        if (!Guid.TryParse(idStr, out var id))
            return TypedResults.Problem("Invalid Step ID.");

        var result = await mediator.Send(new DeleteHowItWorksStepCommand(id), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}


