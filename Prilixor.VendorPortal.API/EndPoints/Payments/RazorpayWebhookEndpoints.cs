using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.API.EndPoints.Payments;

public sealed class RazorpayWebhookEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("webhooks/razorpay");
        AllowAnonymous();
        DontAutoTag();
        Options(x => x.WithTags("Payments"));
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        using var reader = new StreamReader(HttpContext.Request.Body);
        var rawBody = await reader.ReadToEndAsync(ct);
        var signature = HttpContext.Request.Headers["X-Razorpay-Signature"].FirstOrDefault() ?? string.Empty;
        var result = await mediator.Send(new ProcessRazorpayWebhookCommand(rawBody, signature), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}
