namespace Prilixor.VendorPortal.Application.Abstractions;

public sealed record PlatformSmsSettingsDto(
    bool TransactionalSmsEnabled,
    bool CustomerOrderPlaced,
    bool CustomerOrderConfirmed,
    bool CustomerOrderCancelled,
    bool CustomerOrderStatusUpdated,
    bool CustomerOrderDispatchFailed,
    bool CustomerOrderExpiring,
    bool VendorNewOrder,
    bool VendorAccountApproved,
    bool VendorAccountRejected,
    bool VendorAccountSuspended,
    bool VendorAccountBanned,
    bool VendorAccountReactivated,
    bool VendorBankVerified,
    bool VendorDocumentVerified,
    bool VendorServiceAreaUpdated,
    bool TwilioConfigured);

public interface IPlatformSmsSettingsService
{
    Task<PlatformSmsSettingsDto> GetAsync(CancellationToken ct = default);
    Task<PlatformSmsSettingsDto> UpdateAsync(PlatformSmsSettingsDto settings, CancellationToken ct = default);
    Task<bool> IsCustomerEventEnabledAsync(CustomerSmsKind kind, CancellationToken ct = default);
    Task<bool> IsVendorEventEnabledAsync(VendorSmsKind kind, CancellationToken ct = default);
}
