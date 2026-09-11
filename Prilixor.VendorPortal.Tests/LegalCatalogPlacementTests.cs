using Prilixor.VendorPortal.Domain.Legal;

namespace Prilixor.VendorPortal.Tests;

public class LegalCatalogPlacementTests
{
    [Theory]
    [InlineData(LegalCatalog.DocumentTypes.TermsOfUse, true, true, true, true)]
    [InlineData(LegalCatalog.DocumentTypes.PrivacyPolicy, true, true, true, true)]
    [InlineData(LegalCatalog.DocumentTypes.VendorSellerPolicy, false, true, false, true)]
    [InlineData(LegalCatalog.DocumentTypes.RentalAndPurchasePolicy, true, true, false, false)]
    [InlineData(LegalCatalog.DocumentTypes.CancellationRefundPolicy, true, false, false, false)]
    [InlineData(LegalCatalog.DocumentTypes.ShippingDeliveryPolicy, true, false, false, false)]
    [InlineData(LegalCatalog.DocumentTypes.GrievanceRedressalPolicy, true, true, false, false)]
    public void Screenshot_defaults_match_customer_vendor_and_register_accept(
        string documentType,
        bool customerVisible,
        bool vendorVisible,
        bool customerRegisterRequired,
        bool vendorRegisterRequired)
    {
        var customer = LegalCatalog.DefaultPlacement(documentType, LegalCatalog.Surfaces.CustomerWeb, LegalCatalog.Screens.Register);
        var vendor = LegalCatalog.DefaultPlacement(documentType, LegalCatalog.Surfaces.VendorWeb, LegalCatalog.Screens.Register);
        var vendorCheckout = LegalCatalog.DefaultPlacement(documentType, LegalCatalog.Surfaces.VendorWeb, LegalCatalog.Screens.Checkout);

        Assert.Equal(customerVisible, AnyVisible(documentType, LegalCatalog.Surfaces.CustomerWeb, LegalCatalog.Surfaces.CustomerMobile));
        Assert.Equal(vendorVisible, AnyVisible(documentType, LegalCatalog.Surfaces.VendorWeb, LegalCatalog.Surfaces.VendorMobile));
        Assert.Equal(customerRegisterRequired, customer.IsRequiredToProceed);
        Assert.Equal(vendorRegisterRequired, vendor.IsRequiredToProceed);
        Assert.False(vendorCheckout.IsRequiredToProceed);
    }

    [Fact]
    public void Seven_seed_documents_are_defined()
    {
        Assert.Equal(7, LegalCatalog.SeedDocuments.Count);
        Assert.Equal(LegalCatalog.DocumentTypes.All, LegalCatalog.SeedDocuments.Select(d => d.DocumentType));
    }

    [Fact]
    public void Checkout_requires_rental_refund_and_shipping_for_customers()
    {
        foreach (var type in new[]
                 {
                     LegalCatalog.DocumentTypes.RentalAndPurchasePolicy,
                     LegalCatalog.DocumentTypes.CancellationRefundPolicy,
                     LegalCatalog.DocumentTypes.ShippingDeliveryPolicy,
                 })
        {
            var placement = LegalCatalog.DefaultPlacement(type, LegalCatalog.Surfaces.CustomerWeb, LegalCatalog.Screens.Checkout);
            Assert.True(placement.IsVisible);
            Assert.True(placement.IsRequiredToProceed);
        }
    }

    [Fact]
    public void Vendor_seller_policy_is_hidden_from_customers()
    {
        foreach (var screen in LegalCatalog.Screens.All)
        {
            var web = LegalCatalog.DefaultPlacement(
                LegalCatalog.DocumentTypes.VendorSellerPolicy, LegalCatalog.Surfaces.CustomerWeb, screen);
            var mobile = LegalCatalog.DefaultPlacement(
                LegalCatalog.DocumentTypes.VendorSellerPolicy, LegalCatalog.Surfaces.CustomerMobile, screen);
            Assert.False(web.IsVisible);
            Assert.False(mobile.IsVisible);
        }
    }

    private static bool AnyVisible(string documentType, params string[] surfaces) =>
        surfaces.Any(surface =>
            LegalCatalog.Screens.All.Any(screen =>
                LegalCatalog.DefaultPlacement(documentType, surface, screen).IsVisible));
}
