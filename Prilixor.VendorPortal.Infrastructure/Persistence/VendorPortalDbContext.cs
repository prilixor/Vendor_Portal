using Microsoft.EntityFrameworkCore;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

/// <summary>
/// Vendor portal bounded context.
/// Uses configuration key <c>VendorPortalConnection</c> and falls back to <c>DefaultConnection</c> when unset.
/// </summary>
public sealed class VendorPortalDbContext(DbContextOptions<VendorPortalDbContext> options)
    : ApplicationDbContext(options);
