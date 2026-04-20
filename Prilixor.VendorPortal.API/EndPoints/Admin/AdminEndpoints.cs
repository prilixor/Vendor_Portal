using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public sealed class RegisterAdminUserRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public sealed class AddAdminAuditLogRequest : AdminUserIdRequest
{
    public string ActionType { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? Notes { get; set; }
}

public sealed class GetAdminAuditLogsRequest
{
    public string? AdminUserId { get; set; }
}

public sealed class RegisterAdminUserEndpoint(IMediator mediator)
    : Endpoint<RegisterAdminUserRequest, Results<Ok<AdminUserDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("users");
        Group<AdminApiGroup>();
    }

    public override async Task<Results<Ok<AdminUserDto>, ProblemHttpResult>> ExecuteAsync(RegisterAdminUserRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new RegisterAdminUserCommand(
            req.Email,
            req.Password,
            req.FullName,
            req.Role,
            req.IsActive), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminUsersEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<AdminUserDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("users");
        Group<AdminApiGroup>();
    }

    public override async Task<Results<Ok<List<AdminUserDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetAdminUsersQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AddAdminAuditLogEndpoint(IMediator mediator)
    : Endpoint<AddAdminAuditLogRequest, Results<Ok<AdminAuditLogDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("audit-logs");
        Group<AdminApiGroup>();
    }

    public override async Task<Results<Ok<AdminAuditLogDto>, ProblemHttpResult>> ExecuteAsync(AddAdminAuditLogRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new AddAdminAuditLogCommand(
            req.AdminUserId,
            req.ActionType,
            req.EntityType,
            req.EntityId,
            req.OldValue,
            req.NewValue,
            req.Notes), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminAuditLogsEndpoint(IMediator mediator)
    : Endpoint<GetAdminAuditLogsRequest, Results<Ok<List<AdminAuditLogDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("audit-logs");
        Group<AdminApiGroup>();
    }

    public override async Task<Results<Ok<List<AdminAuditLogDto>>, ProblemHttpResult>> ExecuteAsync(GetAdminAuditLogsRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetAdminAuditLogsQuery(req.AdminUserId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
