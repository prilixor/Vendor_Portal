namespace Prilixor.VendorPortal.Domain.Legal;

public static class LegalCatalog
{
    public static class DocumentTypes
    {
        public const string TermsOfUse = "terms-of-use";
        public const string VendorSellerPolicy = "vendor-seller-policy";
        public const string RentalAndPurchasePolicy = "rental-and-purchase-policy";
        public const string CancellationRefundPolicy = "cancellation-refund-policy";
        public const string ShippingDeliveryPolicy = "shipping-delivery-policy";
        public const string PrivacyPolicy = "privacy-policy";
        public const string GrievanceRedressalPolicy = "grievance-redressal-policy";

        public static readonly IReadOnlyList<string> All =
        [
            TermsOfUse,
            VendorSellerPolicy,
            RentalAndPurchasePolicy,
            CancellationRefundPolicy,
            ShippingDeliveryPolicy,
            PrivacyPolicy,
            GrievanceRedressalPolicy,
        ];
    }

    public static class Audiences
    {
        public const string Customer = "customer";
        public const string Vendor = "vendor";
        public const string Both = "both";
        public const string Platform = "platform";
    }

    public static class VersionStatuses
    {
        public const string Draft = "draft";
        public const string Published = "published";
        public const string Archived = "archived";
    }

    public static class Surfaces
    {
        public const string AdminWeb = "admin_web";
        public const string VendorWeb = "vendor_web";
        public const string CustomerWeb = "customer_web";
        public const string CustomerMobile = "customer_mobile";
        public const string VendorMobile = "vendor_mobile";

        public static readonly IReadOnlyList<string> All =
        [
            AdminWeb,
            VendorWeb,
            CustomerWeb,
            CustomerMobile,
            VendorMobile,
        ];

        public static bool IsCustomer(string surface) =>
            surface is CustomerWeb or CustomerMobile;

        public static bool IsVendor(string surface) =>
            surface is VendorWeb or VendorMobile;
    }

    public static class Screens
    {
        public const string Footer = "footer";
        public const string Register = "register";
        public const string Login = "login";
        public const string Checkout = "checkout";
        public const string ProfileSettings = "profile_settings";
        public const string Landing = "landing";
        public const string Onboarding = "onboarding";
        public const string Support = "support";
        public const string LegalHub = "legal_hub";
        public const string OrderConfirm = "order_confirm";
        public const string FirstLaunch = "first_launch";
        public const string ProductDetail = "product_detail";
        public const string OrderCancel = "order_cancel";
        public const string Prescription = "prescription";
        public const string VendorDashboard = "vendor_dashboard";
        public const string Reconsent = "reconsent";

        public static readonly IReadOnlyList<string> All =
        [
            Footer,
            Register,
            Login,
            Checkout,
            ProfileSettings,
            Landing,
            Onboarding,
            Support,
            LegalHub,
            OrderConfirm,
            FirstLaunch,
            ProductDetail,
            OrderCancel,
            Prescription,
            VendorDashboard,
            Reconsent,
        ];
    }

    public static class ActorTypes
    {
        public const string Customer = "customer";
        public const string Vendor = "vendor";
        public const string Admin = "admin";
    }

    public readonly record struct PlacementDefault(bool IsVisible, bool IsRequiredToProceed);

    public readonly record struct SeedDocumentSpec(
        Guid Id,
        string Slug,
        string DocumentType,
        string Title,
        string Audience,
        string Summary,
        string PublicPath,
        int SortOrder,
        bool IsRequiredAcceptance);

    public static readonly IReadOnlyList<SeedDocumentSpec> SeedDocuments =
    [
        new(Guid.Parse("a1111111-1111-4111-8111-111111111111"), "terms-of-use", DocumentTypes.TermsOfUse,
            "Terms of Use", Audiences.Both,
            "Platform terms governing access to and use of BlinksMed.",
            "/terms-and-conditions", 1, true),
        new(Guid.Parse("a2222222-2222-4222-8222-222222222222"), "vendor-seller-policy", DocumentTypes.VendorSellerPolicy,
            "Vendor / Seller Policy", Audiences.Vendor,
            "Rules for vendors listing equipment for rent or sale on BlinksMed.",
            "/vendor-seller-policy", 2, true),
        new(Guid.Parse("a3333333-3333-4333-8333-333333333333"), "rental-and-purchase-policy", DocumentTypes.RentalAndPurchasePolicy,
            "Rental & Purchase Policy", Audiences.Customer,
            "How rentals, purchases, deposits, and ownership work on BlinksMed.",
            "/rental-and-purchase-policy", 3, false),
        new(Guid.Parse("a4444444-4444-4444-8444-444444444444"), "cancellation-refund-policy", DocumentTypes.CancellationRefundPolicy,
            "Cancellation & Refund Policy", Audiences.Customer,
            "Cancellation windows, refunds, and deposit handling.",
            "/cancellation-refund-policy", 4, false),
        new(Guid.Parse("a5555555-5555-4555-8555-555555555555"), "shipping-delivery-policy", DocumentTypes.ShippingDeliveryPolicy,
            "Shipping & Delivery Policy", Audiences.Customer,
            "Delivery, setup, and handover of equipment ordered on BlinksMed.",
            "/shipping-delivery-policy", 5, false),
        new(Guid.Parse("a6666666-6666-4666-8666-666666666666"), "privacy-policy", DocumentTypes.PrivacyPolicy,
            "Privacy Policy", Audiences.Both,
            "How BlinksMed collects, uses, and protects personal data.",
            "/privacy-policy", 6, true),
        new(Guid.Parse("a7777777-7777-4777-8777-777777777777"), "grievance-redressal-policy", DocumentTypes.GrievanceRedressalPolicy,
            "Grievance Redressal Policy", Audiences.Both,
            "How to raise a complaint and statutory grievance timelines.",
            "/grievance-redressal-policy", 7, false),
    ];

    public static readonly IReadOnlyList<string> MaterialReconsentTypes =
    [
        DocumentTypes.TermsOfUse,
        DocumentTypes.PrivacyPolicy,
        DocumentTypes.VendorSellerPolicy,
    ];

    /// <summary>
    /// CEO placement defaults. Admin can override any cell later.
    /// </summary>
    public static PlacementDefault DefaultPlacement(string documentType, string surface, string screen)
    {
        var isCustomer = Surfaces.IsCustomer(surface);
        var isVendor = Surfaces.IsVendor(surface);
        var isAdmin = surface == Surfaces.AdminWeb;

        if (documentType is DocumentTypes.TermsOfUse or DocumentTypes.PrivacyPolicy)
        {
            if (isCustomer || isVendor)
            {
                var visible = screen is Screens.Footer or Screens.Register or Screens.Login
                    or Screens.ProfileSettings or Screens.Landing or Screens.Onboarding
                    or Screens.LegalHub or Screens.FirstLaunch or Screens.VendorDashboard
                    or Screens.Reconsent
                    || (isCustomer && documentType == DocumentTypes.PrivacyPolicy && screen == Screens.Prescription);
                var required = (visible && screen is Screens.Register or Screens.Reconsent)
                    || (documentType == DocumentTypes.PrivacyPolicy && screen == Screens.Prescription && isCustomer);
                return new(visible, required);
            }

            return new(isAdmin && screen == Screens.LegalHub, false);
        }

        if (documentType == DocumentTypes.VendorSellerPolicy)
        {
            if (isVendor)
            {
                var visible = screen is Screens.Footer or Screens.Register or Screens.Login
                    or Screens.ProfileSettings or Screens.Onboarding or Screens.LegalHub
                    or Screens.FirstLaunch or Screens.VendorDashboard or Screens.Reconsent;
                return new(visible, visible && screen is Screens.Register or Screens.Reconsent or Screens.Onboarding);
            }

            return new(isAdmin && screen == Screens.LegalHub, false);
        }

        if (documentType == DocumentTypes.RentalAndPurchasePolicy)
        {
            if (isCustomer)
            {
                var visible = screen is Screens.Checkout or Screens.ProductDetail or Screens.Footer or Screens.LegalHub;
                return new(visible, screen == Screens.Checkout);
            }

            if (isVendor)
            {
                var visible = screen is Screens.Footer or Screens.ProfileSettings or Screens.Onboarding
                    or Screens.VendorDashboard or Screens.LegalHub;
                return new(visible, false);
            }

            return new(isAdmin && screen == Screens.LegalHub, false);
        }

        if (documentType == DocumentTypes.CancellationRefundPolicy)
        {
            if (isCustomer)
            {
                var visible = screen is Screens.Checkout or Screens.OrderConfirm or Screens.OrderCancel
                    or Screens.Footer or Screens.LegalHub;
                return new(visible, screen == Screens.Checkout);
            }

            return new(isAdmin && screen == Screens.LegalHub, false);
        }

        if (documentType == DocumentTypes.ShippingDeliveryPolicy)
        {
            if (isCustomer)
            {
                var visible = screen is Screens.Checkout or Screens.ProductDetail or Screens.OrderConfirm
                    or Screens.Footer or Screens.LegalHub;
                return new(visible, screen == Screens.Checkout);
            }

            return new(isAdmin && screen == Screens.LegalHub, false);
        }

        if (documentType == DocumentTypes.GrievanceRedressalPolicy)
        {
            if (isCustomer || isVendor)
                return new(screen is Screens.Support or Screens.Footer or Screens.LegalHub, false);
            return new(isAdmin && screen == Screens.LegalHub, false);
        }

        return new(false, false);
    }
}
