using Microsoft.EntityFrameworkCore;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

/// <summary>
/// Shared/common bounded context for data consumed by multiple portals.
/// Uses configuration key <c>CommonPortalConnection</c> and falls back to <c>DefaultConnection</c> when unset.
/// </summary>
public sealed class CommonPortalDbContext(DbContextOptions<CommonPortalDbContext> options)
    : ApplicationDbContext(options);
