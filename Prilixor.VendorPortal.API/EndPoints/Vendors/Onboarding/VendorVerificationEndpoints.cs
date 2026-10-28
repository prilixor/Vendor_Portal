using FastEndpoints;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public sealed class AutoVerifyVendorDocumentRequest : VendorIdRequest
{
    public string DocumentId { get; set; } = string.Empty;
    public string? DocumentNumber { get; set; }
}

public sealed class AutoVerifyVendorDocumentEndpoint(MediatR.IMediator mediator)
    : Endpoint<AutoVerifyVendorDocumentRequest, Results<Ok<VendorDocumentDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/documents/{documentId}/verify");
        Group<VendorOnboardingGroup>();
        Policies("AdminOnly", $"Perm:{AdminPermissions.VendorsAutoVerify}");
    }

    public override async Task<Results<Ok<VendorDocumentDto>, ProblemHttpResult>> ExecuteAsync(
        AutoVerifyVendorDocumentRequest req,
        CancellationToken ct)
    {
        var command = new AutoVerifyVendorDocumentCommand(req.VendorId, req.DocumentId, req.DocumentNumber);
        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : Prilixor.VendorPortal.API.Extensions.ResultExtensions.ToErrorResponse(result);
    }
}

public sealed class AutoVerifyVendorBankAccountRequest : VendorIdRequest
{
    public string BankAccountId { get; set; } = string.Empty;
}

public sealed class AutoVerifyVendorBankAccountEndpoint(MediatR.IMediator mediator)
    : Endpoint<AutoVerifyVendorBankAccountRequest, Results<Ok<VendorBankAccountDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/bank-accounts/{bankAccountId}/verify");
        Group<VendorOnboardingGroup>();
        Policies("AdminOnly", $"Perm:{AdminPermissions.VendorsAutoVerify}");
    }

    public override async Task<Results<Ok<VendorBankAccountDto>, ProblemHttpResult>> ExecuteAsync(
        AutoVerifyVendorBankAccountRequest req,
        CancellationToken ct)
    {
        var command = new AutoVerifyVendorBankAccountCommand(req.VendorId, req.BankAccountId);
        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : Prilixor.VendorPortal.API.Extensions.ResultExtensions.ToErrorResponse(result);
    }
}
