using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.API.Services;

/// <summary>
/// Creates the first system SuperAdmin from configuration when none exist.
/// </summary>
public sealed class BootstrapSuperAdminHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<BootstrapSuperAdminOptions> options,
    ILogger<BootstrapSuperAdminHostedService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var opts = options.Value;
        if (!opts.Enabled)
            return;

        if (string.IsNullOrWhiteSpace(opts.Email) || string.IsNullOrWhiteSpace(opts.Password))
        {
            logger.LogWarning("BootstrapSuperAdmin is enabled but Email/Password are missing; skipping.");
            return;
        }

        if (opts.Password.Length < 8)
        {
            logger.LogWarning("BootstrapSuperAdmin password must be at least 8 characters; skipping.");
            return;
        }

        try
        {
            using var scope = scopeFactory.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IVendorOnboardingRepository>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasherService>();

            var existingCount = await repo.CountActiveSuperAdminsAsync(cancellationToken);
            if (existingCount > 0)
            {
                logger.LogInformation("BootstrapSuperAdmin skipped; {Count} SuperAdmin(s) already exist.", existingCount);
                return;
            }

            var role = await repo.GetAdminRoleByCodeAsync(SuperAdminRules.RoleCode, cancellationToken);
            if (role is null)
            {
                logger.LogWarning("BootstrapSuperAdmin skipped; super_admin role not found. Apply RBAC migrations first.");
                return;
            }

            var email = opts.Email.Trim().ToLowerInvariant();
            var existing = await repo.GetAdminUserByEmailAsync(email, cancellationToken);
            if (existing is not null)
            {
                // Promote existing bootstrap email to system SuperAdmin if no supers yet
                existing.Role = SuperAdminRules.RoleCode;
                existing.RoleId = role.Id;
                existing.IsSystemUser = true;
                existing.IsActive = true;
                existing.MustChangePassword = true;
                existing.PasswordHash = hasher.HashPassword(opts.Password);
                if (!string.IsNullOrWhiteSpace(opts.FullName))
                    existing.FullName = opts.FullName.Trim();
                await repo.UpdateAdminUserAsync(existing, cancellationToken);
                await repo.SaveChangesAsync(cancellationToken);
                logger.LogWarning("BootstrapSuperAdmin promoted existing admin {Email} to system SuperAdmin. Change password immediately.", email);
                return;
            }

            var entity = new AdminUser
            {
                Id = Guid.Parse("a2000000-0000-4000-8000-000000000001"),
                Email = email,
                FullName = string.IsNullOrWhiteSpace(opts.FullName) ? "System Super Admin" : opts.FullName.Trim(),
                PasswordHash = hasher.HashPassword(opts.Password),
                Role = SuperAdminRules.RoleCode,
                RoleId = role.Id,
                IsActive = true,
                IsSystemUser = true,
                MustChangePassword = true
            };
            await repo.AddAdminUserAsync(entity, cancellationToken);
            await repo.SaveChangesAsync(cancellationToken);
            logger.LogWarning(
                "BootstrapSuperAdmin created {Email}. MustChangePassword=true — change password on first login.",
                email);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "BootstrapSuperAdmin failed");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
