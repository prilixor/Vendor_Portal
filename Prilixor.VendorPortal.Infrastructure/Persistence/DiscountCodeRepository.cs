using Microsoft.EntityFrameworkCore;
using Prilixor.Shared.Abstractions.DI;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Customers;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

public sealed class DiscountCodeRepository(CustomerPortalDbContext db)
    : IDiscountCodeRepository, IScopedService
{
    public Task<List<DiscountCode>> ListAsync(CancellationToken cancellationToken) =>
        db.DiscountCodes
            .Include(x => x.Products)
            .Include(x => x.Categories)
            .Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);

    public Task<DiscountCode?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        db.DiscountCodes
            .Include(x => x.Products)
            .Include(x => x.Categories)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken);

    public Task<DiscountCode?> GetByCodeAsync(string normalizedCode, CancellationToken cancellationToken) =>
        db.DiscountCodes
            .Include(x => x.Products)
            .Include(x => x.Categories)
            .FirstOrDefaultAsync(x => !x.IsDeleted && x.Code == normalizedCode, cancellationToken);

    public Task<List<DiscountCode>> ListShownToCustomersAsync(CancellationToken cancellationToken) =>
        db.DiscountCodes
            .Include(x => x.Products)
            .Include(x => x.Categories)
            .Where(x => !x.IsDeleted && x.IsActive && x.ShowToCustomers)
            .ToListAsync(cancellationToken);

    public async Task<Dictionary<Guid, (int Total, int Customer)>> CountActiveUsesAsync(
        IReadOnlyCollection<Guid> codeIds,
        Guid customerId,
        CancellationToken cancellationToken)
    {
        if (codeIds.Count == 0)
            return [];

        var rows = await db.DiscountCodeRedemptions
            .AsNoTracking()
            .Where(x =>
                codeIds.Contains(x.DiscountCodeId)
                && !x.IsDeleted
                && (x.Status == DiscountRedemptionStatuses.Reserved || x.Status == DiscountRedemptionStatuses.Paid))
            .GroupBy(x => new { x.DiscountCodeId, ForCustomer = x.CustomerId == customerId })
            .Select(g => new { g.Key.DiscountCodeId, g.Key.ForCustomer, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var map = codeIds.ToDictionary(id => id, _ => (Total: 0, Customer: 0));
        foreach (var row in rows)
        {
            var current = map[row.DiscountCodeId];
            current.Total += row.Count;
            if (row.ForCustomer)
                current.Customer += row.Count;
            map[row.DiscountCodeId] = current;
        }

        return map;
    }

    public Task<int> CountActiveUsesAsync(Guid codeId, CancellationToken cancellationToken) =>
        db.DiscountCodeRedemptions.CountAsync(
            x => x.DiscountCodeId == codeId
                && !x.IsDeleted
                && (x.Status == DiscountRedemptionStatuses.Reserved || x.Status == DiscountRedemptionStatuses.Paid),
            cancellationToken);

    public Task AddAsync(DiscountCode code, CancellationToken cancellationToken)
    {
        db.DiscountCodes.Add(code);
        return Task.CompletedTask;
    }

    public async Task<Result> ReserveAsync(
        Guid checkoutSessionId,
        Guid customerId,
        Guid discountCodeId,
        decimal discountAmount,
        CancellationToken cancellationToken)
    {
        await ReleaseOpenReservationsAsync(customerId, cancellationToken);

        var code = await db.DiscountCodes.FirstOrDefaultAsync(
            x => x.Id == discountCodeId && !x.IsDeleted,
            cancellationToken);
        if (code is null || !code.IsActive)
        {
            return Result.Failure(new Error(
                "customers.discount_invalid",
                DiscountCodeEngine.InactiveMessage,
                ErrorCategory.Validation));
        }

        var counts = await CountActiveUsesAsync([discountCodeId], customerId, cancellationToken);
        counts.TryGetValue(discountCodeId, out var use);
        if (code.MaxTotalUses is int totalLimit && use.Total >= totalLimit)
        {
            return Result.Failure(new Error(
                "customers.discount_invalid",
                DiscountCodeEngine.TotalLimitMessage,
                ErrorCategory.Validation));
        }

        if (code.MaxUsesPerCustomer is int customerLimit && use.Customer >= customerLimit)
        {
            return Result.Failure(new Error(
                "customers.discount_invalid",
                DiscountCodeEngine.CustomerLimitMessage,
                ErrorCategory.Validation));
        }

        db.DiscountCodeRedemptions.Add(new DiscountCodeRedemption
        {
            Id = Guid.CreateVersion7(),
            DiscountCodeId = discountCodeId,
            CustomerId = customerId,
            CheckoutSessionId = checkoutSessionId,
            Status = DiscountRedemptionStatuses.Reserved,
            DiscountAmount = discountAmount,
        });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task ReleaseOpenReservationsAsync(Guid customerId, CancellationToken cancellationToken)
    {
        var open = await db.DiscountCodeRedemptions
            .Include(x => x.CheckoutSession)
            .Where(x =>
                x.CustomerId == customerId
                && !x.IsDeleted
                && x.Status == DiscountRedemptionStatuses.Reserved)
            .ToListAsync(cancellationToken);

        var changed = false;
        foreach (var row in open)
        {
            if (!string.Equals(row.CheckoutSession?.Status, CheckoutSessionStatuses.Created, StringComparison.OrdinalIgnoreCase))
                continue;

            row.Status = DiscountRedemptionStatuses.Released;
            changed = true;
        }

        if (changed)
            await db.SaveChangesAsync(cancellationToken);
    }

    public async Task ReleaseBySessionAsync(Guid checkoutSessionId, CancellationToken cancellationToken)
    {
        var row = await db.DiscountCodeRedemptions.FirstOrDefaultAsync(
            x => x.CheckoutSessionId == checkoutSessionId && !x.IsDeleted,
            cancellationToken);
        if (row is null || row.Status != DiscountRedemptionStatuses.Reserved)
            return;

        row.Status = DiscountRedemptionStatuses.Released;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task MarkPaidBySessionAsync(Guid checkoutSessionId, CancellationToken cancellationToken)
    {
        var row = await db.DiscountCodeRedemptions.FirstOrDefaultAsync(
            x => x.CheckoutSessionId == checkoutSessionId && !x.IsDeleted,
            cancellationToken);
        if (row is null || row.Status == DiscountRedemptionStatuses.Paid)
            return;

        row.Status = DiscountRedemptionStatuses.Paid;
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
