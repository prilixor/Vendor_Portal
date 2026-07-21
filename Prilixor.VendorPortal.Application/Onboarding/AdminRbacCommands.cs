using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Extensions;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record AdminRoleDto(
    string Id,
    string Code,
    string Name,
    string? Description,
    bool IsSystem,
    bool IsActive,
    IReadOnlyList<string> PermissionCodes);

public sealed record AdminPermissionDto(
    string Id,
    string Code,
    string Name,
    string? Description,
    string Category);

public sealed record GetAdminRolesQuery : IQuery<List<AdminRoleDto>>;

internal sealed class GetAdminRolesQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetAdminRolesQuery, List<AdminRoleDto>>
{
    public async Task<Result<List<AdminRoleDto>>> Handle(GetAdminRolesQuery request, CancellationToken cancellationToken)
    {
        var roles = await repository.GetAdminRolesAsync(cancellationToken);
        var result = new List<AdminRoleDto>();
        foreach (var role in roles)
        {
            var codes = await repository.GetPermissionCodesForRoleAsync(role.Id, cancellationToken);
            result.Add(new AdminRoleDto(
                role.Id.ToString(),
                role.Code,
                role.Name,
                role.Description,
                role.IsSystem,
                role.IsActive,
                codes));
        }
        return Result.Success(result);
    }
}

public sealed record GetAdminPermissionsQuery : IQuery<List<AdminPermissionDto>>;

internal sealed class GetAdminPermissionsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetAdminPermissionsQuery, List<AdminPermissionDto>>
{
    public async Task<Result<List<AdminPermissionDto>>> Handle(GetAdminPermissionsQuery request, CancellationToken cancellationToken)
    {
        var rows = await repository.GetAdminPermissionsAsync(cancellationToken);
        return Result.Success(rows.Select(p => new AdminPermissionDto(
            p.Id.ToString(),
            p.Code,
            p.Name,
            p.Description,
            p.Category)).ToList());
    }
}

public sealed record CreateAdminRoleCommand(
    string Code,
    string Name,
    string? Description,
    IReadOnlyList<string> PermissionCodes,
    Guid ActorAdminId) : ICommand<AdminRoleDto>;

public sealed class CreateAdminRoleCommandValidator : AbstractValidator<CreateAdminRoleCommand>
{
    public CreateAdminRoleCommandValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(64)
            .Matches(@"^[a-z][a-z0-9_]*$").WithMessage("Code must be lowercase snake_case.");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.PermissionCodes).NotEmpty();
    }
}

internal sealed class CreateAdminRoleCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<CreateAdminRoleCommand, AdminRoleDto>
{
    public async Task<Result<AdminRoleDto>> Handle(CreateAdminRoleCommand request, CancellationToken cancellationToken)
    {
        var code = request.Code.Trim().ToLowerInvariant();
        if (code == SuperAdminRules.RoleCode)
            return Result.Failure<AdminRoleDto>(new Error("admin.role_reserved", "The super_admin role is system-reserved and cannot be recreated.", ErrorCategory.Validation));
        if (await repository.GetAdminRoleByCodeAsync(code, cancellationToken) is not null)
            return Result.Failure<AdminRoleDto>(new Error("admin.role_exists", "A role with this code already exists.", ErrorCategory.Validation));

        var allPerms = await repository.GetAdminPermissionsAsync(cancellationToken);
        var byCode = allPerms.ToDictionary(p => p.Code, StringComparer.OrdinalIgnoreCase);
        var missing = request.PermissionCodes.Where(c => !byCode.ContainsKey(c)).ToList();
        if (missing.Count > 0)
            return Result.Failure<AdminRoleDto>(new Error("admin.permission_invalid", $"Unknown permissions: {string.Join(", ", missing)}", ErrorCategory.Validation));

        var role = new AdminRole
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            IsSystem = false,
            IsActive = true
        };
        await repository.AddAdminRoleAsync(role, cancellationToken);
        var permissionIds = request.PermissionCodes.Select(c => byCode[c].Id).ToList();
        await repository.SetAdminRolePermissionsAsync(role.Id, permissionIds, cancellationToken);
        await repository.AddAdminAuditLogAsync(new AdminAuditLog
        {
            Id = Guid.NewGuid(),
            AdminId = request.ActorAdminId,
            ActionType = "ADMIN_ROLE_CREATED",
            EntityType = "AdminRole",
            EntityId = role.Id,
            NewValue = $"{{\"code\":\"{role.Code}\",\"permissions\":[{string.Join(",", permissionIds.Select(id => $"\"{id}\""))}]}}"
        }, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new AdminRoleDto(
            role.Id.ToString(), role.Code, role.Name, role.Description, role.IsSystem, role.IsActive,
            request.PermissionCodes.ToList()));
    }
}

public sealed record UpdateAdminRoleCommand(
    Guid RoleId,
    string Name,
    string? Description,
    bool IsActive,
    IReadOnlyList<string> PermissionCodes,
    Guid ActorAdminId) : ICommand<AdminRoleDto>;

internal sealed class UpdateAdminRoleCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpdateAdminRoleCommand, AdminRoleDto>
{
    public async Task<Result<AdminRoleDto>> Handle(UpdateAdminRoleCommand request, CancellationToken cancellationToken)
    {
        var role = await repository.GetAdminRoleByIdAsync(request.RoleId, cancellationToken);
        if (role is null)
            return Result.Failure<AdminRoleDto>(new Error("admin.role_not_found", "Role not found.", ErrorCategory.NotFound));

        var allPerms = await repository.GetAdminPermissionsAsync(cancellationToken);
        var byCode = allPerms.ToDictionary(p => p.Code, StringComparer.OrdinalIgnoreCase);
        var missing = request.PermissionCodes.Where(c => !byCode.ContainsKey(c)).ToList();
        if (missing.Count > 0)
            return Result.Failure<AdminRoleDto>(new Error("admin.permission_invalid", $"Unknown permissions: {string.Join(", ", missing)}", ErrorCategory.Validation));

        List<string> codes;
        if (role.Code == SuperAdminRules.RoleCode)
        {
            // System SuperAdmin role is immutable: always full permission set, always active.
            role.IsActive = true;
            codes = AdminPermissions.AllCodes.ToList();
        }
        else
        {
            codes = request.PermissionCodes.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            role.Name = request.Name.Trim();
            role.Description = request.Description?.Trim();
            if (!role.IsSystem)
                role.IsActive = request.IsActive;
        }

        await repository.UpdateAdminRoleAsync(role, cancellationToken);
        var permissionIds = codes.Select(c => byCode[c].Id).ToList();
        await repository.SetAdminRolePermissionsAsync(role.Id, permissionIds, cancellationToken);
        await repository.AddAdminAuditLogAsync(new AdminAuditLog
        {
            Id = Guid.NewGuid(),
            AdminId = request.ActorAdminId,
            ActionType = "ADMIN_ROLE_UPDATED",
            EntityType = "AdminRole",
            EntityId = role.Id,
            Notes = role.Code == SuperAdminRules.RoleCode
                ? "System SuperAdmin role permissions forced to full set"
                : $"Permissions count={codes.Count}"
        }, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new AdminRoleDto(
            role.Id.ToString(), role.Code, role.Name, role.Description, role.IsSystem, role.IsActive, codes));
    }
}

public sealed record StartVendorImpersonationCommand(Guid AdminUserId, Guid VendorId) : ICommand<PortalImpersonationStartDto>;

public sealed record StartCustomerImpersonationCommand(Guid AdminUserId, Guid CustomerId) : ICommand<PortalImpersonationStartDto>;

public sealed record PortalImpersonationStartDto(
    string ExchangeCode,
    string TargetType,
    string TargetId,
    string TargetName,
    DateTimeOffset ExpiresAt);

/// <summary>Backward-compatible alias used by existing admin API clients.</summary>
public sealed record VendorImpersonationStartDto(
    string ExchangeCode,
    string VendorId,
    string VendorName,
    DateTimeOffset ExpiresAt);

internal sealed class StartVendorImpersonationCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<StartVendorImpersonationCommand, PortalImpersonationStartDto>
{
    public async Task<Result<PortalImpersonationStartDto>> Handle(StartVendorImpersonationCommand request, CancellationToken cancellationToken)
    {
        var vendor = await repository.GetVendorByIdAsync(request.VendorId, cancellationToken);
        if (vendor is null || vendor.IsDeleted)
            return Result.Failure<PortalImpersonationStartDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));

        var profile = await repository.GetVendorProfileAsync(vendor.Id, cancellationToken);
        var rawCode = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawCode)));

        var exchange = new AdminImpersonationExchange
        {
            Id = Guid.NewGuid(),
            CodeHash = hash,
            AdminUserId = request.AdminUserId,
            TargetType = "vendor",
            VendorId = vendor.Id,
            ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(60),
            IsConsumed = false
        };
        await repository.AddImpersonationExchangeAsync(exchange, cancellationToken);
        await repository.AddAdminAuditLogAsync(new AdminAuditLog
        {
            Id = Guid.NewGuid(),
            AdminId = request.AdminUserId,
            ActionType = "VENDOR_IMPERSONATION_START",
            EntityType = "Vendor",
            EntityId = vendor.Id,
            Notes = "One-time exchange code issued"
        }, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new PortalImpersonationStartDto(
            rawCode,
            "vendor",
            vendor.Id.ToString(),
            profile?.BusinessName ?? vendor.Email,
            exchange.ExpiresAt));
    }
}

internal sealed class StartCustomerImpersonationCommandHandler(
    IVendorOnboardingRepository repository,
    ICustomerRepository customers)
    : ICommandHandler<StartCustomerImpersonationCommand, PortalImpersonationStartDto>
{
    public async Task<Result<PortalImpersonationStartDto>> Handle(StartCustomerImpersonationCommand request, CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null || customer.IsDeleted)
            return Result.Failure<PortalImpersonationStartDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var rawCode = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawCode)));

        var exchange = new AdminImpersonationExchange
        {
            Id = Guid.NewGuid(),
            CodeHash = hash,
            AdminUserId = request.AdminUserId,
            TargetType = "customer",
            CustomerId = customer.Id,
            ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(60),
            IsConsumed = false
        };
        await repository.AddImpersonationExchangeAsync(exchange, cancellationToken);
        await repository.AddAdminAuditLogAsync(new AdminAuditLog
        {
            Id = Guid.NewGuid(),
            AdminId = request.AdminUserId,
            ActionType = "CUSTOMER_IMPERSONATION_START",
            EntityType = "Customer",
            EntityId = customer.Id,
            Notes = "One-time exchange code issued"
        }, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        var name = string.IsNullOrWhiteSpace(customer.FullName) ? customer.Email : customer.FullName;
        return Result.Success(new PortalImpersonationStartDto(
            rawCode,
            "customer",
            customer.Id.ToString(),
            name,
            exchange.ExpiresAt));
    }
}

public sealed record ExchangeImpersonationCodeCommand(string Code) : ICommand<ImpersonationExchangeResultDto>;

public sealed record ImpersonationExchangeResultDto(
    string TargetType,
    Guid TargetId,
    Guid AdminUserId,
    string Email,
    string Name);

internal sealed class ExchangeImpersonationCodeCommandHandler(
    IVendorOnboardingRepository repository,
    ICustomerRepository customers)
    : ICommandHandler<ExchangeImpersonationCodeCommand, ImpersonationExchangeResultDto>
{
    public async Task<Result<ImpersonationExchangeResultDto>> Handle(ExchangeImpersonationCodeCommand request, CancellationToken cancellationToken)
    {
        var code = (request.Code ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(code))
            return Result.Failure<ImpersonationExchangeResultDto>(new Error("auth.invalid_code", "Exchange code is required.", ErrorCategory.Validation));

        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));
        var exchange = await repository.GetImpersonationExchangeByCodeHashAsync(hash, cancellationToken);
        if (exchange is null || exchange.IsConsumed || exchange.ExpiresAt < DateTimeOffset.UtcNow)
            return Result.Failure<ImpersonationExchangeResultDto>(new Error("auth.invalid_code", "Exchange code is invalid or expired.", ErrorCategory.Unauthorized));

        exchange.IsConsumed = true;
        exchange.ConsumedAt = DateTimeOffset.UtcNow;
        await repository.UpdateImpersonationExchangeAsync(exchange, cancellationToken);

        var targetType = string.IsNullOrWhiteSpace(exchange.TargetType) ? "vendor" : exchange.TargetType.Trim().ToLowerInvariant();

        if (targetType == "customer")
        {
            if (exchange.CustomerId is not Guid customerId)
                return Result.Failure<ImpersonationExchangeResultDto>(new Error("auth.invalid_code", "Exchange code is invalid.", ErrorCategory.Unauthorized));

            var customer = await customers.GetCustomerByIdAsync(customerId, cancellationToken);
            if (customer is null || customer.IsDeleted)
                return Result.Failure<ImpersonationExchangeResultDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

            await repository.AddAdminAuditLogAsync(new AdminAuditLog
            {
                Id = Guid.NewGuid(),
                AdminId = exchange.AdminUserId,
                ActionType = "CUSTOMER_IMPERSONATION_CONSUMED",
                EntityType = "Customer",
                EntityId = customer.Id
            }, cancellationToken);
            await repository.SaveChangesAsync(cancellationToken);

            var name = string.IsNullOrWhiteSpace(customer.FullName) ? customer.Email : customer.FullName;
            return Result.Success(new ImpersonationExchangeResultDto(
                "customer", customer.Id, exchange.AdminUserId, customer.Email, name));
        }

        if (exchange.VendorId is not Guid vendorId)
            return Result.Failure<ImpersonationExchangeResultDto>(new Error("auth.invalid_code", "Exchange code is invalid.", ErrorCategory.Unauthorized));

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null || vendor.IsDeleted)
            return Result.Failure<ImpersonationExchangeResultDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));

        var profile = await repository.GetVendorProfileAsync(vendor.Id, cancellationToken);
        await repository.AddAdminAuditLogAsync(new AdminAuditLog
        {
            Id = Guid.NewGuid(),
            AdminId = exchange.AdminUserId,
            ActionType = "VENDOR_IMPERSONATION_CONSUMED",
            EntityType = "Vendor",
            EntityId = vendor.Id
        }, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new ImpersonationExchangeResultDto(
            "vendor",
            vendor.Id,
            exchange.AdminUserId,
            vendor.Email,
            profile?.BusinessName ?? profile?.OwnerName ?? vendor.Email));
    }
}

