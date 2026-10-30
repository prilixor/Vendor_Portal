using Prilixor.Shared.Abstractions.DI;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Abstractions;

public interface IDiscountCodeRepository : IScopedService
{
    Task<List<DiscountCode>> ListAsync(CancellationToken cancellationToken);
    Task<DiscountCode?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<DiscountCode?> GetByCodeAsync(string normalizedCode, CancellationToken cancellationToken);
    Task<List<DiscountCode>> ListShownToCustomersAsync(CancellationToken cancellationToken);
    Task<Dictionary<Guid, (int Total, int Customer)>> CountActiveUsesAsync(
        IReadOnlyCollection<Guid> codeIds,
        Guid customerId,
        CancellationToken cancellationToken);
    Task<int> CountActiveUsesAsync(Guid codeId, CancellationToken cancellationToken);
    Task AddAsync(DiscountCode code, CancellationToken cancellationToken);
    Task<Result> ReserveAsync(
        Guid checkoutSessionId,
        Guid customerId,
        Guid discountCodeId,
        decimal discountAmount,
        CancellationToken cancellationToken);
    Task ReleaseOpenReservationsAsync(Guid customerId, CancellationToken cancellationToken);
    Task ReleaseBySessionAsync(Guid checkoutSessionId, CancellationToken cancellationToken);
    Task MarkPaidBySessionAsync(Guid checkoutSessionId, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
