using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public class CreateVendorBankAccountRequest : VendorIdRequest
{
    public string AccountHolderName { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string IfscCode { get; set; } = string.Empty;
}

public sealed class UpdateVendorBankAccountRequest : CreateVendorBankAccountRequest
{
    public string BankAccountId { get; set; } = string.Empty;
}

public sealed class CreateVendorBankAccountEndpoint(IMediator mediator)
    : Endpoint<CreateVendorBankAccountRequest, Results<Ok<VendorBankAccountDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/bank-accounts");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorBankAccountDto>, ProblemHttpResult>> ExecuteAsync(CreateVendorBankAccountRequest req, CancellationToken ct)
    {
        var command = new UpsertVendorBankAccountCommand(
            req.VendorId,
            null,
            req.AccountHolderName,
            req.BankName,
            req.AccountNumber,
            req.IfscCode);

        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateVendorBankAccountEndpoint(IMediator mediator)
    : Endpoint<UpdateVendorBankAccountRequest, Results<Ok<VendorBankAccountDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("{vendorId}/bank-accounts/{bankAccountId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorBankAccountDto>, ProblemHttpResult>> ExecuteAsync(UpdateVendorBankAccountRequest req, CancellationToken ct)
    {
        var command = new UpsertVendorBankAccountCommand(
            req.VendorId,
            req.BankAccountId,
            req.AccountHolderName,
            req.BankName,
            req.AccountNumber,
            req.IfscCode);

        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorBankAccountsEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<List<VendorBankAccountDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/bank-accounts");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorBankAccountDto>>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorBankAccountsQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
