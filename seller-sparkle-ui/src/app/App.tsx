import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/app/components/ui/sonner";
import { Toaster } from "@/app/components/ui/toaster";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { AuthProvider } from "@/app/guards/AuthContext";
import { CartProvider } from "@/app/contexts/CartContext";
import { AppShell } from "@/app/components/layout/AppShell";
import { OfflineBanner } from "@/app/components/shared/OfflineBanner";

import Index from "@/app/components/common/Index";
import NotFound from "@/app/components/common/NotFound";
import { PortalHostGuard } from "@/app/components/common/PortalHostGuard";
import Login from "@/app/components/auth/Login";
import Register from "@/app/components/auth/Register";
import ForgotPassword from "@/app/components/auth/ForgotPassword";
import ResetPassword from "@/app/components/auth/ResetPassword";
import VerifyEmailSent from "@/app/components/auth/VerifyEmailSent";
import VerifyEmail from "@/app/components/auth/VerifyEmail";
import ContactUs from "@/app/components/common/ContactUs";
import DoctorPublicPage from "@/app/components/common/DoctorPublicPage";
import TermsAndConditions from "@/app/components/legal/TermsAndConditions";
import PrivacyPolicy from "@/app/components/legal/PrivacyPolicy";
import AboutPage from "@/app/components/landing/AboutPage";
import FAQPage from "@/app/components/landing/FAQPage";
import ContactPage from "@/app/components/landing/ContactPage";

import VendorDashboard from "@/app/components/vendor/Dashboard";
import Onboarding from "@/app/components/vendor/Onboarding";
import ServiceAreas from "@/app/components/vendor/ServiceAreas";
import WorkingHours from "@/app/components/vendor/WorkingHours";
import Availability from "@/app/components/vendor/Availability";
import Products from "@/app/components/vendor/Products";
import Inventory from "@/app/components/vendor/Inventory";
import VendorOrderRequests from "@/app/components/vendor/VendorOrderRequests";
import VendorOrders from "@/app/components/vendor/VendorOrders";
import VendorOrderDetail from "@/app/components/vendor/VendorOrderDetail";
import VendorExpirations from "@/app/components/vendor/VendorExpirations";
import Notifications from "@/app/components/vendor/Notifications";
import Settings from "@/app/components/vendor/Settings";
import VendorChats from "@/app/components/vendor/VendorChats";
import { VendorOperationsGuard } from "@/app/components/vendor/VendorOperationsGuard";

import AdminDashboard from "@/app/components/admin/AdminDashboard";
import Verification from "@/app/components/admin/Verification";
import Vendors from "@/app/components/admin/Vendors";
import VendorDetails from "@/app/components/admin/VendorDetails";
import ProductManagement from "@/app/components/admin/ProductManagement";
import ChemicalManagement from "@/app/components/admin/ChemicalManagement";
import AdminDoctors from "@/app/components/admin/AdminDoctors";
import AdminHospitals from "@/app/components/admin/AdminHospitals";
import AdminRentalSetup from "@/app/components/admin/AdminRentalSetup";
import Admins from "@/app/components/admin/Admins";
import AdminRoles from "@/app/components/admin/AdminRoles";
import AdminCustomers, { AdminCustomerDetail } from "@/app/components/admin/AdminCustomers";
import AuditLogs from "@/app/components/admin/AuditLogs";
import AdminLogin from "@/app/components/admin/AdminLogin";
import SupportManagement from "@/app/components/admin/SupportManagement";
import AdminOrders from "@/app/components/admin/AdminOrders";
import AdminOrderDetail from "@/app/components/admin/AdminOrderDetail";
import { AdminNotifications } from "@/app/components/admin/AdminNotifications";
import AdminSettings from "@/app/components/admin/AdminSettings";
import WebsiteContentManagement from "@/app/components/admin/WebsiteContentManagement";
import ImpersonationConsume from "@/app/components/auth/ImpersonationConsume";

import CustomerBrowse from "@/app/components/customer/CustomerBrowse";
import CustomerListingDetail from "@/app/components/customer/CustomerListingDetail";
import CustomerCart from "@/app/components/customer/CustomerCart";
import CustomerCheckout from "@/app/components/customer/CustomerCheckout";
import CustomerOrders from "@/app/components/customer/CustomerOrders";
import CustomerOrderDetail from "@/app/components/customer/CustomerOrderDetail";
import CustomerAddresses from "@/app/components/customer/CustomerAddresses";
import CustomerSettings from "@/app/components/customer/CustomerSettings";
import CustomerDashboard from "@/app/components/customer/CustomerDashboard";
import CustomerHomeRedirect from "@/app/components/customer/CustomerHomeRedirect";
import CustomerNotifications from "@/app/components/customer/CustomerNotifications";
import CustomerSupport from "@/app/components/customer/CustomerSupport";
import CustomerLogin from "@/app/components/customer/CustomerLogin";
import CustomerRegister from "@/app/components/customer/CustomerRegister";
import CustomerExpirations from "@/app/components/customer/CustomerExpirations";

const queryClient = new QueryClient();

/** Keeps old /customer/browse/:id bookmarks working after rename to /shop. */
function LegacyBrowseListingRedirect() {
  const { listingId } = useParams();
  return <Navigate to={`/customer/shop/${encodeURIComponent(listingId ?? "")}`} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <OfflineBanner />
            <PortalHostGuard>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/register" element={<Navigate to="/admin/login" replace />} />
            <Route path="/impersonation/consume" element={<ImpersonationConsume />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email-sent" element={<VerifyEmailSent />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/faqs" element={<Navigate to="/faq" replace />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/contact-us" element={<ContactPage />} />
            <Route path="/dr/:code" element={<DoctorPublicPage />} />

            <Route path="/vendor" element={<AppShell variant="vendor" />}>
              <Route index element={<VendorDashboard />} />
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="service-areas" element={<ServiceAreas />} />
              {/* Temporarily disabled */}
              {/* <Route path="working-hours" element={<WorkingHours />} /> */}
              {/* <Route path="availability" element={<Availability />} /> */}
              <Route path="products" element={<VendorOperationsGuard><Products /></VendorOperationsGuard>} />
              <Route path="inventory" element={<VendorOperationsGuard><Inventory /></VendorOperationsGuard>} />
              <Route path="order-requests" element={<VendorOperationsGuard><VendorOrderRequests /></VendorOperationsGuard>} />
              <Route path="orders" element={<VendorOperationsGuard><VendorOrders /></VendorOperationsGuard>} />
              <Route path="orders/:orderId" element={<VendorOperationsGuard><VendorOrderDetail /></VendorOperationsGuard>} />
              <Route path="expirations" element={<VendorOperationsGuard><VendorExpirations /></VendorOperationsGuard>} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="settings" element={<Settings />} />
              <Route path="chats" element={<VendorChats />} />
            </Route>

            <Route path="/admin" element={<AppShell variant="admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="verification" element={<Verification />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="vendors/:vendorId" element={<VendorDetails />} />
              <Route path="products" element={<ProductManagement />} />
              <Route path="rental-setup" element={<AdminRentalSetup />} />
              <Route path="rental-durations" element={<Navigate to="/admin/rental-setup" replace />} />
              <Route
                path="rental-duration-icons"
                element={<Navigate to="/admin/rental-setup?tab=icons" replace />}
              />
              <Route path="chemicals" element={<ChemicalManagement />} />
              <Route path="doctors" element={<AdminDoctors />} />
              <Route path="hospitals" element={<AdminHospitals />} />
              <Route path="admins" element={<Admins />} />
              <Route path="roles" element={<AdminRoles />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="customers/:customerId" element={<AdminCustomerDetail />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="support" element={<SupportManagement />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="orders/:orderId" element={<AdminOrderDetail />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="website-content" element={<WebsiteContentManagement />} />
              <Route path="website-content/home" element={<WebsiteContentManagement initialTab="home" />} />
              <Route path="website-content/about" element={<WebsiteContentManagement initialTab="about" />} />
              <Route path="website-content/services" element={<WebsiteContentManagement initialTab="services" />} />
              <Route path="website-content/how-it-works" element={<WebsiteContentManagement initialTab="how-it-works" />} />
              <Route path="website-content/rent-or-buy" element={<WebsiteContentManagement initialTab="rent-or-buy" />} />
              <Route path="website-content/faq" element={<WebsiteContentManagement initialTab="faq" />} />
              <Route path="website-content/contact" element={<WebsiteContentManagement initialTab="contact" />} />
              <Route path="website-content/settings" element={<WebsiteContentManagement initialTab="settings" />} />
            </Route>

            <Route path="/customer/login" element={<CustomerLogin />} />
            <Route path="/customer/register" element={<CustomerRegister />} />

            <Route path="/customer" element={<AppShell variant="customer" />}>
              <Route index element={<CustomerHomeRedirect />} />
              <Route path="dashboard" element={<CustomerDashboard />} />
              <Route path="shop" element={<CustomerBrowse />} />
              <Route path="shop/:listingId" element={<CustomerListingDetail />} />
              <Route path="browse" element={<Navigate to="/customer/shop" replace />} />
              <Route path="browse/:listingId" element={<LegacyBrowseListingRedirect />} />
              <Route path="cart" element={<CustomerCart />} />
              <Route path="checkout" element={<CustomerCheckout />} />
              <Route path="orders" element={<CustomerOrders />} />
              <Route path="orders/:orderId" element={<CustomerOrderDetail />} />
              <Route path="expirations" element={<CustomerExpirations />} />
              <Route path="addresses" element={<CustomerAddresses />} />
              <Route path="notifications" element={<CustomerNotifications />} />
              <Route path="support" element={<CustomerSupport />} />
              <Route path="settings" element={<CustomerSettings />} />
              <Route path="profile" element={<Navigate to="/customer/settings" replace />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
            </PortalHostGuard>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;


