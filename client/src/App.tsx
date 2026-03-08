import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SEO } from "@/components/SEO";
import { FaviconManager } from "@/components/FaviconManager";
import { Preloader } from "@/components/ui/Preloader";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Pricing from "@/pages/Pricing";
import Contact from "@/pages/Contact";
import AppLayout from "@/pages/app/Layout";
import Dashboard from "@/pages/app/Dashboard";
import CivicGuard from "@/pages/app/Civic";
import Marketplace from "@/pages/app/Marketplace";
import Jobs from "@/pages/app/Jobs";
import Forum from "@/pages/app/Forum";
import Events from "@/pages/app/Events";
import PlanManagement from "@/pages/app/PlanManagement";
import TrafficAlerts from "@/pages/app/TrafficAlerts";
import EmailVerification from "@/pages/app/EmailVerification";
import VendorDashboard from "@/pages/app/VendorDashboard";
import Wallet from "@/pages/app/Wallet";
import Bookings from "@/pages/app/Bookings";
import BookingDetail from "@/pages/app/BookingDetail";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Login from "@/pages/auth/Login";
import LegalPage from "@/pages/LegalPage";
import Settings from "@/pages/app/Settings";
import Notifications from "@/pages/app/Notifications";
import Credits from "@/pages/app/Credits";
import Payment from "@/pages/app/Payment";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/contact" component={Contact} />
      <Route path="/auth/login" component={Login} />
      
      {/* Legal Routes */}
      <Route path="/privacy">
        <LegalPage type="privacy_policy" title="Privacy Policy" />
      </Route>
      <Route path="/terms">
        <LegalPage type="terms_of_service" title="Terms of Service" />
      </Route>
      <Route path="/cookies">
        <LegalPage type="cookie_policy" title="Cookie Policy" />
      </Route>
      
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
      <Route path="/app/verify-email">
        <AppLayout><EmailVerification /></AppLayout>
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
      <Route path="/app/notifications">
        <AppLayout><Notifications /></AppLayout>
      </Route>
      <Route path="/app/credits">
        <AppLayout><Credits /></AppLayout>
      </Route>
      <Route path="/app/payment">
        <AppLayout><Payment /></AppLayout>
      </Route>
      <Route path="/admin">
        <AppLayout><AdminDashboard /></AppLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showPreloader, setShowPreloader] = useState(true);

  useEffect(() => {
    // Initialize Capacitor plugins
    if (Capacitor.isNativePlatform()) {
      const initNative = async () => {
        try {
          // Handle Status Bar
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
          
          // Hide Splash Screen after a delay if not handled by auto-hide
          await SplashScreen.hide();

          // Handle Back Button
          CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            if (!canGoBack) {
              CapacitorApp.exitApp();
            } else {
              window.history.back();
            }
          });
        } catch (e) {
          console.error("Error initializing native plugins:", e);
        }
      };
      
      initNative();
    }

    const timer = setTimeout(() => {
      setShowPreloader(false);
    }, 2000); // Show preloader for 2 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {showPreloader && <Preloader />}
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider>
              <TooltipProvider>
                <SEO />
                <Router />
                <Toaster />
              </TooltipProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </>
  );
}

export default App;
