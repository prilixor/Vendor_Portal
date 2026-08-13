using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.Shared.Abstractions.DI;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Platform;
using Prilixor.VendorPortal.Infrastructure.Persistence;

namespace Prilixor.VendorPortal.Infrastructure.Services;

public sealed class PlatformSmsSettingsService(
    ApplicationDbContext db,
    ISmsService sms,
    IOptions<TwilioOptions> twilioOptions,
    IMemoryCache cache,
    ILogger<PlatformSmsSettingsService> logger) : IPlatformSmsSettingsService, IScopedService
{
    private const string CacheKey = "platform_sms_settings_v1";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(30);

    public async Task<PlatformSmsSettingsDto> GetAsync(CancellationToken ct = default)
    {
        var entity = await GetOrCreateEntityAsync(ct);
        return Map(entity);
    }

    public async Task<PlatformSmsSettingsDto> UpdateAsync(PlatformSmsSettingsDto settings, CancellationToken ct = default)
    {
        var entity = await GetOrCreateEntityAsync(ct, asTracking: true);
        entity.TransactionalSmsEnabled = settings.TransactionalSmsEnabled;
        entity.CustomerOrderPlaced = settings.CustomerOrderPlaced;
        entity.CustomerOrderConfirmed = settings.CustomerOrderConfirmed;
        entity.CustomerOrderCancelled = settings.CustomerOrderCancelled;
        entity.CustomerOrderStatusUpdated = settings.CustomerOrderStatusUpdated;
        entity.CustomerOrderDispatchFailed = settings.CustomerOrderDispatchFailed;
        entity.CustomerOrderExpiring = settings.CustomerOrderExpiring;
        entity.VendorNewOrder = settings.VendorNewOrder;
        entity.VendorAccountApproved = settings.VendorAccountApproved;
        entity.VendorAccountRejected = settings.VendorAccountRejected;
        entity.VendorAccountSuspended = settings.VendorAccountSuspended;
        entity.VendorAccountBanned = settings.VendorAccountBanned;
        entity.VendorAccountReactivated = settings.VendorAccountReactivated;
        entity.VendorBankVerified = settings.VendorBankVerified;
        entity.VendorDocumentVerified = settings.VendorDocumentVerified;
        entity.VendorServiceAreaUpdated = settings.VendorServiceAreaUpdated;
        entity.ModifiedOnUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        cache.Remove(CacheKey);
        logger.LogInformation("Platform SMS settings updated. TransactionalEnabled={Enabled}", entity.TransactionalSmsEnabled);
        return Map(entity);
    }

    public async Task<bool> IsCustomerEventEnabledAsync(CustomerSmsKind kind, CancellationToken ct = default)
    {
        var s = await GetCachedAsync(ct);
        if (!s.TransactionalSmsEnabled)
            return false;

        return kind switch
        {
            CustomerSmsKind.OrderPlaced => s.CustomerOrderPlaced,
            CustomerSmsKind.OrderConfirmed => s.CustomerOrderConfirmed,
            CustomerSmsKind.OrderCancelled => s.CustomerOrderCancelled,
            CustomerSmsKind.OrderStatusUpdated => s.CustomerOrderStatusUpdated,
            CustomerSmsKind.OrderDispatchFailed => s.CustomerOrderDispatchFailed,
            CustomerSmsKind.Expiration => s.CustomerOrderExpiring,
            _ => false,
        };
    }

    public async Task<bool> IsVendorEventEnabledAsync(VendorSmsKind kind, CancellationToken ct = default)
    {
        var s = await GetCachedAsync(ct);
        if (!s.TransactionalSmsEnabled)
            return false;

        return kind switch
        {
            VendorSmsKind.NewOrder => s.VendorNewOrder,
            VendorSmsKind.AccountApproved => s.VendorAccountApproved,
            VendorSmsKind.AccountRejected => s.VendorAccountRejected,
            VendorSmsKind.AccountSuspended => s.VendorAccountSuspended,
            VendorSmsKind.AccountBanned => s.VendorAccountBanned,
            VendorSmsKind.AccountReactivated => s.VendorAccountReactivated,
            VendorSmsKind.BankVerified => s.VendorBankVerified,
            VendorSmsKind.DocumentVerified => s.VendorDocumentVerified,
            VendorSmsKind.ServiceAreaUpdated => s.VendorServiceAreaUpdated,
            _ => false,
        };
    }

    private async Task<PlatformSmsSettingsDto> GetCachedAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(CacheKey, out PlatformSmsSettingsDto? cached) && cached is not null)
            return cached;

        var dto = await GetAsync(ct);
        cache.Set(CacheKey, dto, CacheDuration);
        return dto;
    }

    private async Task<PlatformSmsSettings> GetOrCreateEntityAsync(CancellationToken ct, bool asTracking = false)
    {
        IQueryable<PlatformSmsSettings> q = db.Set<PlatformSmsSettings>();
        if (!asTracking)
            q = q.AsNoTracking();

        var existing = await q.FirstOrDefaultAsync(ct);
        if (existing is not null)
            return existing;

        var created = new PlatformSmsSettings { Id = Guid.CreateVersion7() };
        db.Set<PlatformSmsSettings>().Add(created);
        await db.SaveChangesAsync(ct);
        cache.Remove(CacheKey);

        if (!asTracking)
            db.Entry(created).State = EntityState.Detached;

        return created;
    }

    private PlatformSmsSettingsDto Map(PlatformSmsSettings e) =>
        new(
            e.TransactionalSmsEnabled,
            e.CustomerOrderPlaced,
            e.CustomerOrderConfirmed,
            e.CustomerOrderCancelled,
            e.CustomerOrderStatusUpdated,
            e.CustomerOrderDispatchFailed,
            e.CustomerOrderExpiring,
            e.VendorNewOrder,
            e.VendorAccountApproved,
            e.VendorAccountRejected,
            e.VendorAccountSuspended,
            e.VendorAccountBanned,
            e.VendorAccountReactivated,
            e.VendorBankVerified,
            e.VendorDocumentVerified,
            e.VendorServiceAreaUpdated,
            TwilioConfigured: sms.IsEnabled || IsTwilioConfigured());

    private bool IsTwilioConfigured()
    {
        var o = twilioOptions.Value;
        return o.Enabled
               && !string.IsNullOrWhiteSpace(o.AccountSid)
               && !string.IsNullOrWhiteSpace(o.AuthToken);
    }
}
