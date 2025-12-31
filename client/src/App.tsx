import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import AppLayout from "@/pages/app/Layout";
import Dashboard from "@/pages/app/Dashboard";
import CivicGuard from "@/pages/app/Civic";
import Marketplace from "@/pages/app/Marketplace";
import Jobs from "@/pages/app/Jobs";
import Forum from "@/pages/app/Forum";
import Events from "@/pages/app/Events";
import PlanManagement from "@/pages/app/PlanManagement";
import TrafficAlerts from "@/pages/app/TrafficAlerts";
import KYCVerification from "@/pages/app/KYC";
import VendorDashboard from "@/pages/app/VendorDashboard";
import Wallet from "@/pages/app/Wallet";
import Bookings from "@/pages/app/Bookings";
import BookingDetail from "@/pages/app/BookingDetail";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Login from "@/pages/auth/Login";
import Settings from "@/pages/app/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/auth/login" component={Login} />
      
      {/* App Routes */}
      <Route path="/app">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/app/civic">
        <AppLayout><CivicGuard /></AppLayout>
      </Route>
      <Route path="/app/marketplace">
        <AppLayout><Marketplace /></AppLayout>
      </Route>
      <Route path="/app/jobs">
        <AppLayout><Jobs /></AppLayout>
      </Route>
      <Route path="/app/forum">
        <AppLayout><Forum /></AppLayout>
      </Route>
      <Route path="/app/events">
        <AppLayout><Events /></AppLayout>
      </Route>
      <Route path="/app/plans">
        <AppLayout><PlanManagement /></AppLayout>
      </Route>
      <Route path="/app/traffic">
        <AppLayout><TrafficAlerts /></AppLayout>
      </Route>
      <Route path="/app/kyc">
        <AppLayout><KYCVerification /></AppLayout>
      </Route>
      <Route path="/app/vendor">
        <AppLayout><VendorDashboard /></AppLayout>
      </Route>
      <Route path="/app/wallet">
        <AppLayout><Wallet /></AppLayout>
      </Route>
      <Route path="/app/bookings">
        <AppLayout><Bookings /></AppLayout>
      </Route>
      <Route path="/app/bookings/:id">
        <AppLayout><BookingDetail /></AppLayout>
      </Route>
      <Route path="/app/settings">
        <AppLayout><Settings /></AppLayout>
      </Route>
      <Route path="/admin" component={AdminDashboard} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
