using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class ProductVariant : AuditableEntity<Guid>
{
    public Guid ProductId { get; set; }
    public string Sku { get; set; } = string.Empty;
    public decimal SizeValue { get; set; }
    public string SizeUnit { get; set; } = string.Empty;
    public decimal VendorPrice { get; set; }
    public decimal BuyPrice { get; set; }
    public bool IsActive { get; set; } = true;

    public Product Product { get; set; } = null!;
}
