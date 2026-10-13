using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Platform;

/// <summary>Single-row admin toggles for transactional SMS. OTP stays on ShreeSMS config.</summary>
public class PlatformSmsSettings : AuditableEntity<Guid>, ISoftDelete
{
    /// <summary>Master switch for all transactional SMS below.</summary>
    public bool TransactionalSmsEnabled { get; set; }

    /// <summary>
    /// When true, phone OTP is shown for sign-in, registration, and password reset.
    /// When false, those screens use email or mobile plus password and do not send an OTP.
    /// </summary>
    public bool PhoneOtpEnabled { get; set; } = true;

    // Customer order lifecycle
    public bool CustomerOrderPlaced { get; set; }
    public bool CustomerOrderConfirmed { get; set; }
    public bool CustomerOrderCancelled { get; set; }
    public bool CustomerOrderStatusUpdated { get; set; }
    public bool CustomerOrderDispatchFailed { get; set; }
    public bool CustomerOrderExpiring { get; set; }

    // Vendor ops / account
    public bool VendorNewOrder { get; set; }
    public bool VendorAccountApproved { get; set; }
    public bool VendorAccountRejected { get; set; }
    public bool VendorAccountSuspended { get; set; }
    public bool VendorAccountBanned { get; set; }
    public bool VendorAccountReactivated { get; set; }
    public bool VendorBankVerified { get; set; }
    public bool VendorDocumentVerified { get; set; }
    public bool VendorServiceAreaUpdated { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
