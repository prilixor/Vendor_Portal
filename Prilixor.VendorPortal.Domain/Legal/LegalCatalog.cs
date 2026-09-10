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
        ];
    }

    public static class ActorTypes
    {
        public const string Customer = "customer";
        public const string Vendor = "vendor";
        public const string Admin = "admin";
    }
}
