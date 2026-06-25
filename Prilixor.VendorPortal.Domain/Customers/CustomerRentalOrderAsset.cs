using Prilixor.Shared.Abstractions.DB;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Domain.Customers;

public class CustomerRentalOrderAsset
{
    public Guid CustomerRentalOrderId { get; set; }
    public Guid VendorProductAssetId { get; set; }

    public CustomerRentalOrder CustomerRentalOrder { get; set; } = null!;
    
    /// <summary>
    /// Cross-domain navigation property to the asset. Ensure this is configured correctly in DbContext.
    /// </summary>
    public VendorProductAsset VendorProductAsset { get; set; } = null!;
}
