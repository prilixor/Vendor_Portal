using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Customers;
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

public sealed class GetAdminOrderExpirationsRequest
{
    public int WithinDays { get; set; } = 7;
}

public sealed class VerifyVendorBankAccountRequest : AdminUserIdRequest
{
    public string VendorId { get; set; } = string.Empty;
    public string BankAccountId { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public sealed class VerifyVendorDocumentRequest : AdminUserIdRequest
{
    public string VendorId { get; set; } = string.Empty;
    public string DocumentId { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public sealed class VerifyVendorListingRequest : AdminUserIdRequest
{
    public string VendorId { get; set; } = string.Empty;
    public string ListingId { get; set; } = string.Empty;
    public string ListingStatus { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public sealed class ApproveVendorRequest : AdminUserIdRequest
{
    public string VendorId { get; set; } = string.Empty;
}

public sealed class RejectVendorRequest : AdminUserIdRequest
{
    public string VendorId { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public sealed class SuspendVendorRequest : AdminUserIdRequest
{
    public string VendorId { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public sealed class BanVendorRequest : AdminUserIdRequest
{
    public string VendorId { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public sealed class ReactivateVendorRequest : AdminUserIdRequest
{
    public string VendorId { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public sealed class ForceResetVendorPasswordRequest : AdminUserIdRequest
{
    public string VendorId { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public sealed class RegisterAdminUserEndpoint(IMediator mediator)
    : Endpoint<RegisterAdminUserRequest, Results<Ok<AdminUserDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("users");
        Group<AdminApiGroup>();
        Policies("Perm:admins.manage");
    }

    public override async Task<Results<Ok<AdminUserDto>, ProblemHttpResult>> ExecuteAsync(RegisterAdminUserRequest req, CancellationToken ct)
    {
        var actorIdStr = HttpContext.ResolveAdminUserId();
        Guid? actorId = Guid.TryParse(actorIdStr, out var aid) ? aid : null;

        var result = await mediator.Send(new RegisterAdminUserCommand(
            req.Email,
            req.Password,
            req.FullName,
            req.Role,
            req.IsActive,
            RoleId: null,
            ActorAdminId: actorId), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateAdminUserRequest
{
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? Role { get; set; }
    public string? RoleId { get; set; }
    public bool? IsActive { get; set; }
}

public sealed class UpdateAdminUserEndpoint(IMediator mediator)
    : Endpoint<UpdateAdminUserRequest, Results<Ok<AdminUserDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("users/{adminId}");
        Group<AdminApiGroup>();
        Policies("Perm:admins.manage");
    }

    public override async Task<Results<Ok<AdminUserDto>, ProblemHttpResult>> ExecuteAsync(UpdateAdminUserRequest req, CancellationToken ct)
    {
        var actorIdStr = HttpContext.ResolveAdminUserId();
        if (!Guid.TryParse(actorIdStr, out var actorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Admin identity required.", statusCode: 401);

        var targetStr = Route<string>("adminId");
        if (!Guid.TryParse(targetStr, out var targetId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid admin id.", statusCode: 400);

        Guid? roleId = null;
        if (!string.IsNullOrWhiteSpace(req.RoleId) && Guid.TryParse(req.RoleId, out var rid))
            roleId = rid;

        var result = await mediator.Send(new UpdateAdminUserCommand(
            targetId, actorId, req.FullName, req.Email, req.Role, roleId, req.IsActive), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateOwnAdminProfileRequest
{
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? CurrentPassword { get; set; }
    public string? NewPassword { get; set; }
}

public sealed class ForceResetAdminPasswordRequest
{
    /// <summary>Optional. If omitted, API generates a secure temporary password.</summary>
    public string? NewPassword { get; set; }
    public string? Notes { get; set; }
}

public sealed class UpdateOwnAdminProfileEndpoint(IMediator mediator)
    : Endpoint<UpdateOwnAdminProfileRequest, Results<Ok<AdminUserDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("me");
        Group<AdminApiGroup>();
    }

    public override async Task<Results<Ok<AdminUserDto>, ProblemHttpResult>> ExecuteAsync(UpdateOwnAdminProfileRequest req, CancellationToken ct)
    {
        var actorIdStr = HttpContext.ResolveAdminUserId();
        if (!Guid.TryParse(actorIdStr, out var actorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Admin identity required.", statusCode: 401);

        var result = await mediator.Send(new UpdateOwnAdminProfileCommand(
            actorId, req.FullName, req.Email, req.CurrentPassword, req.NewPassword), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class ForceResetAdminPasswordEndpoint(IMediator mediator)
    : Endpoint<ForceResetAdminPasswordRequest, Results<Ok<ForceResetAdminPasswordDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("users/{adminId}/password/reset");
        Group<AdminApiGroup>();
        Policies("Perm:admins.manage");
    }

    public override async Task<Results<Ok<ForceResetAdminPasswordDto>, ProblemHttpResult>> ExecuteAsync(
        ForceResetAdminPasswordRequest req,
        CancellationToken ct)
    {
        var actorIdStr = HttpContext.ResolveAdminUserId();
        if (!Guid.TryParse(actorIdStr, out var actorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Admin identity required.", statusCode: 401);

        var targetStr = Route<string>("adminId");
        if (!Guid.TryParse(targetStr, out var targetId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid admin id.", statusCode: 400);

        var result = await mediator.Send(new ForceResetAdminPasswordCommand(
            actorId, targetId, req.NewPassword, req.Notes), ct);
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
        Policies("Perm:admins.manage");
    }

    public override async Task<Results<Ok<List<AdminUserDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetAdminUsersQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<VendorDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("vendors");
        Group<AdminApiGroup>();
        Policies("Perm:vendors.view");
    }

    public override async Task<Results<Ok<List<VendorDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorsQuery(), ct);
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
        Policies("Perm:audit.view");
    }

    public override async Task<Results<Ok<AdminAuditLogDto>, ProblemHttpResult>> ExecuteAsync(AddAdminAuditLogRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new AddAdminAuditLogCommand(
            HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty,
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
        Policies("Perm:audit.view");
    }

    public override async Task<Results<Ok<List<AdminAuditLogDto>>, ProblemHttpResult>> ExecuteAsync(GetAdminAuditLogsRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetAdminAuditLogsQuery(req.AdminUserId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class VerifyVendorBankAccountEndpoint(IMediator mediator)
    : Endpoint<VerifyVendorBankAccountRequest, Results<Ok<VendorBankAccountDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("vendors/{vendorId}/bank-accounts/{bankAccountId}/verification");
        Group<AdminApiGroup>();
        Policies("Perm:vendors.verify");
    }

    public override async Task<Results<Ok<VendorBankAccountDto>, ProblemHttpResult>> ExecuteAsync(VerifyVendorBankAccountRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new VerifyVendorBankAccountCommand(
            HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty,
            req.VendorId,
            req.BankAccountId,
            req.VerificationStatus,
            req.Notes), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class VerifyVendorDocumentEndpoint(IMediator mediator)
    : Endpoint<VerifyVendorDocumentRequest, Results<Ok<VendorDocumentDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("vendors/{vendorId}/documents/{documentId}/verification");
        Group<AdminApiGroup>();
        Policies("Perm:vendors.verify");
    }

    public override async Task<Results<Ok<VendorDocumentDto>, ProblemHttpResult>> ExecuteAsync(VerifyVendorDocumentRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new VerifyVendorDocumentCommand(
            HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty,
            req.VendorId,
            req.DocumentId,
            req.VerificationStatus,
            req.Notes), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class VerifyVendorListingEndpoint(IMediator mediator)
    : Endpoint<VerifyVendorListingRequest, Results<Ok<VendorProductListingDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("vendors/{vendorId}/listings/{listingId}/verification");
        Group<AdminApiGroup>();
        Policies("Perm:vendors.verify");
    }

    public override async Task<Results<Ok<VendorProductListingDto>, ProblemHttpResult>> ExecuteAsync(VerifyVendorListingRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new VerifyVendorListingCommand(
            HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty,
            req.VendorId,
            req.ListingId,
            req.ListingStatus,
            req.Notes), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class ForceResetVendorPasswordEndpoint(IMediator mediator)
    : Endpoint<ForceResetVendorPasswordRequest, Results<Ok<AdminPasswordResetDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("vendors/{vendorId}/password/reset");
        Group<AdminApiGroup>();
        Policies("Perm:vendors.manage");
    }

    public override async Task<Results<Ok<AdminPasswordResetDto>, ProblemHttpResult>> ExecuteAsync(ForceResetVendorPasswordRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new ForceResetVendorPasswordCommand(
            HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty,
            req.VendorId,
            req.NewPassword,
            req.Notes), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class ApproveVendorEndpoint(IMediator mediator)
    : Endpoint<ApproveVendorRequest, Results<Ok<VendorDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("vendors/{vendorId}/approve");
        Group<AdminApiGroup>();
        Policies("Perm:vendors.verify");
    }

    public override async Task<Results<Ok<VendorDto>, ProblemHttpResult>> ExecuteAsync(ApproveVendorRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new ApproveVendorCommand(
            req.VendorId,
            HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class RejectVendorEndpoint(IMediator mediator)
    : Endpoint<RejectVendorRequest, Results<Ok<VendorDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("vendors/{vendorId}/reject");
        Group<AdminApiGroup>();
        Policies("Perm:vendors.verify");
    }

    public override async Task<Results<Ok<VendorDto>, ProblemHttpResult>> ExecuteAsync(RejectVendorRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new RejectVendorCommand(
            req.VendorId,
            HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty,
            req.Reason), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class SuspendVendorEndpoint(IMediator mediator)
    : Endpoint<SuspendVendorRequest, Results<Ok<VendorDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("vendors/{vendorId}/suspend");
        Group<AdminApiGroup>();
        Policies("Perm:vendors.manage");
    }

    public override async Task<Results<Ok<VendorDto>, ProblemHttpResult>> ExecuteAsync(SuspendVendorRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new SuspendVendorCommand(
            req.VendorId,
            HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty,
            req.Reason), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class BanVendorEndpoint(IMediator mediator)
    : Endpoint<BanVendorRequest, Results<Ok<VendorDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("vendors/{vendorId}/ban");
        Group<AdminApiGroup>();
        Policies("Perm:vendors.manage");
    }

    public override async Task<Results<Ok<VendorDto>, ProblemHttpResult>> ExecuteAsync(BanVendorRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new BanVendorCommand(
            req.VendorId,
            HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty,
            req.Reason), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class ReactivateVendorEndpoint(IMediator mediator)
    : Endpoint<ReactivateVendorRequest, Results<Ok<VendorDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("vendors/{vendorId}/reactivate");
        Group<AdminApiGroup>();
        Policies("Perm:vendors.manage");
    }

    public override async Task<Results<Ok<VendorDto>, ProblemHttpResult>> ExecuteAsync(ReactivateVendorRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new ReactivateVendorCommand(
            req.VendorId,
            HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty,
            req.Reason), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminOrderExpirationsEndpoint(IMediator mediator)
    : Endpoint<GetAdminOrderExpirationsRequest, Results<Ok<List<ExpiringOrderDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("orders/expirations");
        Group<AdminApiGroup>();
        Policies("Perm:orders.view");
    }

    public override async Task<Results<Ok<List<ExpiringOrderDto>>, ProblemHttpResult>> ExecuteAsync(GetAdminOrderExpirationsRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetAdminOrderExpirationsQuery(req.WithinDays), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminOrdersEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<AdminOrderDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("orders");
        Group<AdminApiGroup>();
        Policies("Perm:orders.view");
    }

    public override async Task<Results<Ok<List<AdminOrderDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetAdminAllOrdersQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateAdminOrderStatusRequest : AdminUserIdRequest
{
    public Guid OrderId { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<string>? AssetTags { get; set; }
}

public sealed class UpdateAdminOrderStatusEndpoint(IMediator mediator)
    : Endpoint<UpdateAdminOrderStatusRequest, Results<Ok<AdminOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("orders/{orderId}/status");
        Group<AdminApiGroup>();
        Policies("Perm:orders.manage");
    }

    public override async Task<Results<Ok<AdminOrderDto>, ProblemHttpResult>> ExecuteAsync(UpdateAdminOrderStatusRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateAdminOrderStatusCommand(
            HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty,
            req.OrderId,
            req.Status,
            req.AssetTags), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AdminReassignVendorOrderRequest : AdminUserIdRequest
{
    public Guid OrderId { get; set; }
}

public sealed class AdminReassignVendorOrderEndpoint(IMediator mediator)
    : Endpoint<AdminReassignVendorOrderRequest, Results<Ok<AdminOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("orders/{orderId}/reassign");
        Group<AdminApiGroup>();
        Policies("Perm:orders.manage");
    }

    public override async Task<Results<Ok<AdminOrderDto>, ProblemHttpResult>> ExecuteAsync(AdminReassignVendorOrderRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new AdminReassignVendorOrderCommand(HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty, req.OrderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AdminForceCancelRefundOrderRequest : AdminUserIdRequest
{
    public Guid OrderId { get; set; }
}

public sealed class AdminForceCancelRefundOrderEndpoint(IMediator mediator)
    : Endpoint<AdminForceCancelRefundOrderRequest, Results<Ok<AdminOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("orders/{orderId}/cancel-refund");
        Group<AdminApiGroup>();
        Policies("Perm:orders.manage");
    }

    public override async Task<Results<Ok<AdminOrderDto>, ProblemHttpResult>> ExecuteAsync(AdminForceCancelRefundOrderRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new AdminForceCancelRefundOrderCommand(HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty, req.OrderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AdminRestartOrderDispatchRequest : AdminUserIdRequest
{
    public Guid OrderId { get; set; }
}

public sealed class AdminRestartOrderDispatchEndpoint(IMediator mediator)
    : Endpoint<AdminRestartOrderDispatchRequest, Results<Ok<AdminOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("orders/{orderId}/restart-dispatch");
        Group<AdminApiGroup>();
        Policies("Perm:orders.manage");
    }

    public override async Task<Results<Ok<AdminOrderDto>, ProblemHttpResult>> ExecuteAsync(AdminRestartOrderDispatchRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new AdminRestartOrderDispatchCommand(HttpContext.ResolveAdminUserId(req.AdminUserId) ?? string.Empty, req.OrderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
