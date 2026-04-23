import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/app/components/ui/sonner";
import { Toaster } from "@/app/components/ui/toaster";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { AuthProvider } from "@/app/guards/AuthContext";
import { AppShell } from "@/app/components/layout/AppShell";

import Index from "@/app/components/common/Index";
import NotFound from "@/app/components/common/NotFound";
import Login from "@/app/components/auth/Login";
import Register from "@/app/components/auth/Register";
import ForgotPassword from "@/app/components/auth/ForgotPassword";
import ResetPassword from "@/app/components/auth/ResetPassword";

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
import Admins from "@/app/components/admin/Admins";
import AuditLogs from "@/app/components/admin/AuditLogs";
import AdminRegister from "@/app/components/admin/AdminRegister";
import AdminLogin from "@/app/components/admin/AdminLogin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/register" element={<AdminRegister />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/vendor" element={<AppShell variant="vendor" />}>
              <Route index element={<VendorDashboard />} />
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="service-areas" element={<ServiceAreas />} />
              <Route path="working-hours" element={<WorkingHours />} />
              <Route path="availability" element={<Availability />} />
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
              <Route path="admins" element={<Admins />} />
              <Route path="audit-logs" element={<AuditLogs />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;


