using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class Vendor : AuditableEntity<Guid>, ISoftDelete
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool EmailVerified { get; set; }
    public string AccountStatus { get; set; } = "pending";
    public string RegistrationStage { get; set; } = "email_registered";
    public DateTimeOffset? LastLoginAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public VendorProfile? Profile { get; set; }
    public ICollection<VendorDocument> Documents { get; set; } = [];
    public ICollection<VendorVerificationRequest> VerificationRequests { get; set; } = [];
    public ICollection<VendorServiceArea> ServiceAreas { get; set; } = [];
    public ICollection<VendorWorkingHour> WorkingHours { get; set; } = [];
    public ICollection<VendorAvailabilityOverride> AvailabilityOverrides { get; set; } = [];
    public ICollection<VendorBankAccount> BankAccounts { get; set; } = [];
    public ICollection<VendorProductListing> ProductListings { get; set; } = [];
    public ICollection<VendorNotification> Notifications { get; set; } = [];
    public VendorNotificationPreference? NotificationPreference { get; set; }
}
