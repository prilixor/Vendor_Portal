using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

public static class EquipmentEmergencyStatuses
{
    public const string Open = "open";
    public const string Acknowledged = "acknowledged";
    public const string Resolved = "resolved";

    /// <summary>Open or acknowledged: the customer is still waiting for the issue to be fixed.</summary>
    public static bool IsActive(string? status) =>
        string.Equals(status, Open, StringComparison.OrdinalIgnoreCase)
        || string.Equals(status, Acknowledged, StringComparison.OrdinalIgnoreCase);
}

public static class EquipmentEmergencyReasons
{
    public const string WillNotStart = "will_not_start";
    public const string Alarm = "alarm";
    public const string LeakOrPressure = "leak_or_pressure";
    public const string Power = "power";
    public const string SetupHelp = "setup_help";
    public const string PatientUnsafe = "patient_unsafe";

    public static bool IsKnown(string? reason) =>
        Label(reason) is not null;

    public static string? Label(string? reason) => reason?.Trim().ToLowerInvariant() switch
    {
        WillNotStart => "Will not start",
        Alarm => "Alarm",
        LeakOrPressure => "Leak or pressure",
        Power => "Power",
        SetupHelp => "Need help with setup",
        PatientUnsafe => "Patient is unsafe",
        _ => null,
    };
}

/// <summary>
/// Equipment emergency raised by a customer on a delivered order.
/// Stored in the customer database. Admin is always alerted in the portal.
/// </summary>
public class CustomerOrderEmergency : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerRentalOrderId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid VendorId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public string VendorName { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string? Note { get; set; }
    public string Status { get; set; } = EquipmentEmergencyStatuses.Open;
    public bool VendorNotified { get; set; }
    public DateTimeOffset? AcknowledgedAt { get; set; }
    public Guid? AcknowledgedByAdminId { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public Guid? ResolvedByAdminId { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
