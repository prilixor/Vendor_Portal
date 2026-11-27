using Microsoft.EntityFrameworkCore;
using Prilixor.Shared.Abstractions.DI;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Platform;
using Prilixor.VendorPortal.Infrastructure.Persistence;

namespace Prilixor.VendorPortal.Infrastructure.Services;

public sealed class PlatformEmergencySettingsService(ApplicationDbContext db)
    : IPlatformEmergencySettingsService, IScopedService
{
    public async Task<bool> IsVendorAlertEnabledAsync(CancellationToken cancellationToken = default)
    {
        var entity = await GetOrCreateAsync(cancellationToken, asTracking: false);
        return entity.AlertVendorEnabled;
    }

    public async Task<bool> SetVendorAlertEnabledAsync(bool enabled, CancellationToken cancellationToken = default)
    {
        var entity = await GetOrCreateAsync(cancellationToken, asTracking: true);
        entity.AlertVendorEnabled = enabled;
        entity.ModifiedOnUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return entity.AlertVendorEnabled;
    }

    private async Task<PlatformEmergencySettings> GetOrCreateAsync(CancellationToken cancellationToken, bool asTracking)
    {
        IQueryable<PlatformEmergencySettings> query = db.PlatformEmergencySettings;
        if (!asTracking)
            query = query.AsNoTracking();

        var existing = await query.FirstOrDefaultAsync(cancellationToken);
        if (existing is not null)
            return existing;

        var created = new PlatformEmergencySettings
        {
            Id = Guid.CreateVersion7(),
            AlertVendorEnabled = false,
        };
        db.PlatformEmergencySettings.Add(created);
        await db.SaveChangesAsync(cancellationToken);
        if (!asTracking)
            db.Entry(created).State = EntityState.Detached;
        return created;
    }
}
