using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.EndPoints.Vendors;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class CreateAdminRoleRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> PermissionCodes { get; set; } = [];
}

public sealed class UpdateAdminRoleRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public List<string> PermissionCodes { get; set; } = [];
}

public sealed class GetAdminRolesEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<AdminRoleDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("roles");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.RolesManage}");
    }

    public override async Task<Results<Ok<List<AdminRoleDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetAdminRolesQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminPermissionsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<AdminPermissionDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("permissions");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.RolesManage}");
    }

    public override async Task<Results<Ok<List<AdminPermissionDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetAdminPermissionsQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CreateAdminRoleEndpoint(IMediator mediator)
    : Endpoint<CreateAdminRoleRequest, Results<Ok<AdminRoleDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("roles");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.RolesManage}");
    }

    public override async Task<Results<Ok<AdminRoleDto>, ProblemHttpResult>> ExecuteAsync(CreateAdminRoleRequest req, CancellationToken ct)
    {
        var adminId = HttpContext.ResolveAdminUserId();
        if (!Guid.TryParse(adminId, out var actorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Admin identity required.", statusCode: 401);

        var result = await mediator.Send(new CreateAdminRoleCommand(
            req.Code, req.Name, req.Description, req.PermissionCodes, actorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateAdminRoleEndpoint(IMediator mediator)
    : Endpoint<UpdateAdminRoleRequest, Results<Ok<AdminRoleDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("roles/{roleId}");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.RolesManage}");
    }

    public override async Task<Results<Ok<AdminRoleDto>, ProblemHttpResult>> ExecuteAsync(UpdateAdminRoleRequest req, CancellationToken ct)
    {
        var adminId = HttpContext.ResolveAdminUserId();
        if (!Guid.TryParse(adminId, out var actorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Admin identity required.", statusCode: 401);
        var roleIdStr = Route<string>("roleId");
        if (!Guid.TryParse(roleIdStr, out var roleId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid role id.", statusCode: 400);

        var result = await mediator.Send(new UpdateAdminRoleCommand(
            roleId, req.Name, req.Description, req.IsActive, req.PermissionCodes, actorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class ImpersonateVendorRequest
{
    public string VendorId { get; set; } = string.Empty;
}

public sealed class ImpersonateVendorEndpoint(IMediator mediator)
    : Endpoint<ImpersonateVendorRequest, Results<Ok<object>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("vendors/{vendorId}/impersonate");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.VendorsImpersonate}");
    }

    public override async Task<Results<Ok<object>, ProblemHttpResult>> ExecuteAsync(ImpersonateVendorRequest req, CancellationToken ct)
    {
        var adminId = HttpContext.ResolveAdminUserId();
        if (!Guid.TryParse(adminId, out var actorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Admin identity required.", statusCode: 401);

        var vendorIdStr = string.IsNullOrWhiteSpace(req.VendorId) ? Route<string>("vendorId") : req.VendorId;
        if (!Guid.TryParse(vendorIdStr, out var vendorId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid vendor id.", statusCode: 400);

        var result = await mediator.Send(new StartVendorImpersonationCommand(actorId, vendorId), ct);
        if (!result.IsSuccess)
            return result.ToErrorResponse();

        // Keep legacy shape for existing admin UI while also returning targetType.
        var dto = result.Value;
        return TypedResults.Ok<object>(new
        {
            exchangeCode = dto.ExchangeCode,
            vendorId = dto.TargetId,
            vendorName = dto.TargetName,
            targetType = dto.TargetType,
            targetId = dto.TargetId,
            targetName = dto.TargetName,
            expiresAt = dto.ExpiresAt
        });
    }
}

public sealed class ImpersonateCustomerRequest
{
    public string CustomerId { get; set; } = string.Empty;
}

public sealed class ImpersonateCustomerEndpoint(IMediator mediator)
    : Endpoint<ImpersonateCustomerRequest, Results<Ok<PortalImpersonationStartDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("customers/{customerId}/impersonate");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.CustomersImpersonate}");
    }

    public override async Task<Results<Ok<PortalImpersonationStartDto>, ProblemHttpResult>> ExecuteAsync(
        ImpersonateCustomerRequest req, CancellationToken ct)
    {
        var adminId = HttpContext.ResolveAdminUserId();
        if (!Guid.TryParse(adminId, out var actorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Admin identity required.", statusCode: 401);

        var customerIdStr = string.IsNullOrWhiteSpace(req.CustomerId) ? Route<string>("customerId") : req.CustomerId;
        if (!Guid.TryParse(customerIdStr, out var customerId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid customer id.", statusCode: 400);

        var result = await mediator.Send(new StartCustomerImpersonationCommand(actorId, customerId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
