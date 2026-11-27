namespace Prilixor.VendorPortal.Application.Abstractions;

public interface IPlatformEmergencySettingsService
{
    Task<bool> IsVendorAlertEnabledAsync(CancellationToken cancellationToken = default);
    Task<bool> SetVendorAlertEnabledAsync(bool enabled, CancellationToken cancellationToken = default);
}
