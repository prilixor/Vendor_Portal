import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/app/components/ui/sonner";
import { Toaster } from "@/app/components/ui/toaster";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { AuthProvider } from "@/app/guards/AuthContext";
import { CartProvider } from "@/app/contexts/CartContext";
import { AppShell } from "@/app/components/layout/AppShell";

import Index from "@/app/components/common/Index";
import NotFound from "@/app/components/common/NotFound";
import Login from "@/app/components/auth/Login";
import Register from "@/app/components/auth/Register";
import ForgotPassword from "@/app/components/auth/ForgotPassword";
import ResetPassword from "@/app/components/auth/ResetPassword";
import VerifyEmailSent from "@/app/components/auth/VerifyEmailSent";
import VerifyEmail from "@/app/components/auth/VerifyEmail";
import ContactUs from "@/app/components/common/ContactUs";
import TermsAndConditions from "@/app/components/legal/TermsAndConditions";
import PrivacyPolicy from "@/app/components/legal/PrivacyPolicy";

import VendorDashboard from "@/app/components/vendor/Dashboard";
import Onboarding from "@/app/components/vendor/Onboarding";
import ServiceAreas from "@/app/components/vendor/ServiceAreas";
import WorkingHours from "@/app/components/vendor/WorkingHours";
import Availability from "@/app/components/vendor/Availability";
import Products from "@/app/components/vendor/Products";
import Inventory from "@/app/components/vendor/Inventory";
import Notifications from "@/app/components/vendor/Notifications";
import Settings from "@/app/components/vendor/Settings";

import AdminDashboard from "@/app/components/admin/AdminDashboard";
import Verification from "@/app/components/admin/Verification";
import Vendors from "@/app/components/admin/Vendors";
import VendorDetails from "@/app/components/admin/VendorDetails";
import ProductManagement from "@/app/components/admin/ProductManagement";
import Admins from "@/app/components/admin/Admins";
import AuditLogs from "@/app/components/admin/AuditLogs";
import AdminRegister from "@/app/components/admin/AdminRegister";
import AdminLogin from "@/app/components/admin/AdminLogin";
import SupportManagement from "@/app/components/admin/SupportManagement";

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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/register" element={<AdminRegister />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email-sent" element={<VerifyEmailSent />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/contact-us" element={<ContactUs />} />

            <Route path="/vendor" element={<AppShell variant="vendor" />}>
              <Route index element={<VendorDashboard />} />
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="service-areas" element={<ServiceAreas />} />
              {/* Temporarily disabled */}
              {/* <Route path="working-hours" element={<WorkingHours />} /> */}
              {/* <Route path="availability" element={<Availability />} /> */}
              <Route path="products" element={<Products />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="/admin" element={<AppShell variant="admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="verification" element={<Verification />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="vendors/:vendorId" element={<VendorDetails />} />
              <Route path="products" element={<ProductManagement />} />
              <Route path="admins" element={<Admins />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="support" element={<SupportManagement />} />
            </Route>

            <Route path="/customer/login" element={<CustomerLogin />} />
            <Route path="/customer/register" element={<CustomerRegister />} />

            <Route path="/customer" element={<AppShell variant="customer" />}>
              <Route index element={<CustomerHomeRedirect />} />
              <Route path="dashboard" element={<CustomerDashboard />} />
              <Route path="browse" element={<CustomerBrowse />} />
              <Route path="browse/:listingId" element={<CustomerListingDetail />} />
              <Route path="cart" element={<CustomerCart />} />
              <Route path="checkout" element={<CustomerCheckout />} />
              <Route path="orders" element={<CustomerOrders />} />
              <Route path="orders/:orderId" element={<CustomerOrderDetail />} />
              <Route path="addresses" element={<CustomerAddresses />} />
              <Route path="notifications" element={<CustomerNotifications />} />
              <Route path="support" element={<CustomerSupport />} />
              <Route path="settings" element={<CustomerSettings />} />
              <Route path="profile" element={<Navigate to="/customer/settings" replace />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;


