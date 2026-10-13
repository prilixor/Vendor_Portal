using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Services;

/// <summary>Transactional SMS bodies. Live sends still require an approved DLT template.</summary>
public static class SmsTemplates
{
    public static SmsMessage VendorDispatchOffer(string orderNumber) =>
        new($"BlinksMed: New order request {orderNumber}. Open the Vendor Portal to accept or decline.");

    public static SmsMessage VendorAccountApproved() =>
        new("BlinksMed: Your vendor account is approved. You can now list products in the Vendor Portal.");

    public static SmsMessage VendorAccountRejected(string? reason = null) =>
        new(string.IsNullOrWhiteSpace(reason)
            ? "BlinksMed: Your vendor account application was rejected. Please check the Vendor Portal."
            : $"BlinksMed: Your vendor account was rejected. Reason: {reason.Trim()}");

    public static SmsMessage VendorAccountSuspended(string? reason = null) =>
        new(string.IsNullOrWhiteSpace(reason)
            ? "BlinksMed: Your vendor account has been suspended. Sign in to the Vendor Portal for details."
            : $"BlinksMed: Your vendor account was suspended. Reason: {reason.Trim()}");

    public static SmsMessage VendorAccountBanned(string? reason = null) =>
        new(string.IsNullOrWhiteSpace(reason)
            ? "BlinksMed: Your vendor account has been permanently banned."
            : $"BlinksMed: Your vendor account was permanently banned. Reason: {reason.Trim()}");

    public static SmsMessage VendorAccountReactivated() =>
        new("BlinksMed: Your vendor account has been reactivated. You can resume activity in the Vendor Portal.");

    public static SmsMessage VendorBankVerified(bool approved, string last4) =>
        new(approved
            ? $"BlinksMed: Your bank account ending {last4} was verified."
            : $"BlinksMed: Your bank account ending {last4} was rejected. Please update it in the Vendor Portal.");

    public static SmsMessage VendorDocumentVerified(bool approved, string documentType) =>
        new(approved
            ? $"BlinksMed: Your {documentType} document was approved."
            : $"BlinksMed: Your {documentType} document was rejected. Please resubmit in the Vendor Portal.");

    public static SmsMessage VendorServiceAreaRadiusSet(string areaName, decimal radiusKm) =>
        new($"BlinksMed: Service area \"{areaName}\" coverage set to {radiusKm:0.##} km by admin.");

    public static SmsMessage CustomerOrderStatus(string orderNumber, string statusLabel) =>
        new($"BlinksMed: Order {orderNumber} — {statusLabel}");

    public static SmsMessage CustomerOrderPending(string orderNumber) =>
        new($"BlinksMed: Order {orderNumber} placed. Waiting for a vendor to accept.");

    public static SmsMessage CustomerOrderConfirmed(string orderNumber) =>
        new($"BlinksMed: Order {orderNumber} confirmed by the vendor.");

    public static SmsMessage CustomerOrderCancelled(string orderNumber) =>
        new($"BlinksMed: Order {orderNumber} was cancelled.");

    public static SmsMessage CustomerOrderDispatchFailed(string orderNumber) =>
        new($"BlinksMed: Order {orderNumber} could not be assigned to a vendor. Please re-book.");

    public static SmsMessage CustomerOrderExpiringSoon(string orderNumber, int daysLeft, DateOnly endDate) =>
        new($"BlinksMed: Order {orderNumber} expires in {daysLeft} day(s) on {endDate:dd MMM yyyy}.");

    /// <summary>Short SMS-friendly label for vendor-driven status changes.</summary>
    public static string CustomerStatusSmsLabel(string status, string orderType) =>
        status switch
        {
            "in_transit" => "Out for delivery",
            "active" => string.Equals(orderType, "buy", StringComparison.OrdinalIgnoreCase)
                ? "Delivered"
                : "Delivered and now active",
            "returned" => "Return completed",
            "bought_out" => "Buyout completed",
            _ => "Status updated",
        };
}
