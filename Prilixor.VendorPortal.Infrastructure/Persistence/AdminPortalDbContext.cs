using Microsoft.EntityFrameworkCore;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

/// <summary>
/// Admin portal bounded context.
/// Uses configuration key <c>AdminPortalConnection</c> and falls back to <c>DefaultConnection</c> when unset.
/// </summary>
public sealed class AdminPortalDbContext(DbContextOptions<AdminPortalDbContext> options)
    : ApplicationDbContext(options);
