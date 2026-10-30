using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

/// <summary>
/// Checkout code that reduces the customer's item price. Deposit, delivery fees, and vendor payout are unchanged.
/// </summary>
public class DiscountCode : AuditableEntity<Guid>, ISoftDelete
{
    public string Code { get; set; } = string.Empty;
    /// <summary>percentage | fixed</summary>
    public string DiscountType { get; set; } = "percentage";
    public decimal DiscountValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public decimal? MinimumItemTotal { get; set; }
    public DateTimeOffset? StartsAt { get; set; }
    public DateTimeOffset? EndsAt { get; set; }
    public bool IsActive { get; set; } = true;
    public int? MaxTotalUses { get; set; }
    public int? MaxUsesPerCustomer { get; set; }
    /// <summary>rent | buy | both</summary>
    public string AppliesTo { get; set; } = "both";
    public bool ShowToCustomers { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public ICollection<DiscountCodeProduct> Products { get; set; } = [];
    public ICollection<DiscountCodeCategory> Categories { get; set; } = [];
    public ICollection<DiscountCodeRedemption> Redemptions { get; set; } = [];
}

public class DiscountCodeProduct
{
    public Guid DiscountCodeId { get; set; }
    public Guid ProductId { get; set; }

    public DiscountCode DiscountCode { get; set; } = null!;
}

public class DiscountCodeCategory
{
    public Guid DiscountCodeId { get; set; }
    public Guid CategoryId { get; set; }

    public DiscountCode DiscountCode { get; set; } = null!;
}

public class DiscountCodeRedemption : AuditableEntity<Guid>, ISoftDelete
{
    public Guid DiscountCodeId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid CheckoutSessionId { get; set; }
    /// <summary>reserved | paid | released</summary>
    public string Status { get; set; } = DiscountRedemptionStatuses.Reserved;
    public decimal DiscountAmount { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public DiscountCode DiscountCode { get; set; } = null!;
    public CustomerCheckoutSession CheckoutSession { get; set; } = null!;
}

public static class DiscountRedemptionStatuses
{
    public const string Reserved = "reserved";
    public const string Paid = "paid";
    public const string Released = "released";
}
