using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Services;

/// <summary>
/// Free-form bodies for upgraded accounts + Twilio trial template keys
/// (see https://www.twilio.com/docs/usage/trials/try-out-sms).
/// </summary>
public static class SmsTemplates
{
    // Twilio trial predefined body values:
    // sms_2fa, sms_appointment_reminders, sms_order_confirmation, sms_delivery_updates,
    // sms_customer_support, sms_marketing_promotions, sms_event_notifications,
    // sms_account_alerts, sms_feedback_surveys, sms_internal_alerts

    public static SmsMessage VendorDispatchOffer(string orderNumber) =>
        new(
            $"BlinksMed: New order request {orderNumber}. Open the Vendor Portal to accept or decline.",
            // Trial: must differ from customer sms_order_confirmation so same-phone tests
            // show two distinct Twilio sample texts (event vs order confirmation).
            "sms_event_notifications");

    public static SmsMessage VendorAccountApproved() =>
        new(
            "BlinksMed: Your vendor account is approved. You can now list products in the Vendor Portal.",
            "sms_account_alerts");

    public static SmsMessage VendorAccountRejected(string? reason = null) =>
        new(
            string.IsNullOrWhiteSpace(reason)
                ? "BlinksMed: Your vendor account application was rejected. Please check the Vendor Portal."
                : $"BlinksMed: Your vendor account was rejected. Reason: {reason.Trim()}",
            "sms_account_alerts");

    public static SmsMessage VendorAccountSuspended(string? reason = null) =>
        new(
            string.IsNullOrWhiteSpace(reason)
                ? "BlinksMed: Your vendor account has been suspended. Sign in to the Vendor Portal for details."
                : $"BlinksMed: Your vendor account was suspended. Reason: {reason.Trim()}",
            "sms_account_alerts");

    public static SmsMessage VendorAccountBanned(string? reason = null) =>
        new(
            string.IsNullOrWhiteSpace(reason)
                ? "BlinksMed: Your vendor account has been permanently banned."
                : $"BlinksMed: Your vendor account was permanently banned. Reason: {reason.Trim()}",
            "sms_account_alerts");

    public static SmsMessage VendorAccountReactivated() =>
        new(
            "BlinksMed: Your vendor account has been reactivated. You can resume activity in the Vendor Portal.",
            "sms_account_alerts");

    public static SmsMessage VendorBankVerified(bool approved, string last4) =>
        new(
            approved
                ? $"BlinksMed: Your bank account ending {last4} was verified."
                : $"BlinksMed: Your bank account ending {last4} was rejected. Please update it in the Vendor Portal.",
            "sms_account_alerts");

    public static SmsMessage VendorDocumentVerified(bool approved, string documentType) =>
        new(
            approved
                ? $"BlinksMed: Your {documentType} document was approved."
                : $"BlinksMed: Your {documentType} document was rejected. Please resubmit in the Vendor Portal.",
            "sms_account_alerts");

    public static SmsMessage VendorServiceAreaRadiusSet(string areaName, decimal radiusKm) =>
        new(
            $"BlinksMed: Service area \"{areaName}\" coverage set to {radiusKm:0.##} km by admin.",
            "sms_event_notifications");

    /// <summary>
    /// Customer order lifecycle status SMS (in transit / delivered / returned / reassigned).
    /// Trial: sms_delivery_updates ≈ "Your package is out for delivery…".
    /// </summary>
    public static SmsMessage CustomerOrderStatus(string orderNumber, string statusLabel) =>
        new(
            $"BlinksMed: Order {orderNumber} — {statusLabel}",
            "sms_delivery_updates");

    public static SmsMessage CustomerOrderPending(string orderNumber) =>
        new(
            $"BlinksMed: Order {orderNumber} placed. Waiting for a vendor to accept.",
            "sms_order_confirmation");

    public static SmsMessage CustomerOrderConfirmed(string orderNumber) =>
        new(
            $"BlinksMed: Order {orderNumber} confirmed by the vendor.",
            "sms_order_confirmation");

    public static SmsMessage CustomerOrderCancelled(string orderNumber) =>
        new(
            $"BlinksMed: Order {orderNumber} was cancelled.",
            // Trial: do not use sms_delivery_updates (reads as "out for delivery").
            "sms_account_alerts");

    public static SmsMessage CustomerOrderDispatchFailed(string orderNumber) =>
        new(
            $"BlinksMed: Order {orderNumber} could not be assigned to a vendor. Please re-book.",
            "sms_account_alerts");

    public static SmsMessage CustomerOrderExpiringSoon(string orderNumber, int daysLeft, DateOnly endDate) =>
        new(
            $"BlinksMed: Order {orderNumber} expires in {daysLeft} day(s) on {endDate:dd MMM yyyy}.",
            "sms_appointment_reminders");

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
