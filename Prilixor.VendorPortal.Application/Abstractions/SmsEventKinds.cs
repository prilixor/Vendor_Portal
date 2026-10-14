namespace Prilixor.VendorPortal.Application.Abstractions;

public enum CustomerSmsKind
{
    OrderPlaced,
    OrderConfirmed,
    OrderCancelled,
    OrderStatusUpdated,
    OrderDispatchFailed,
    Expiration,
}

public enum VendorSmsKind
{
    NewOrder,
    AccountApproved,
    AccountRejected,
    AccountSuspended,
    AccountBanned,
    AccountReactivated,
    BankVerified,
    DocumentVerified,
    ServiceAreaUpdated,
}
