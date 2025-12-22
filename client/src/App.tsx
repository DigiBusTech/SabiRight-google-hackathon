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
import Login from "@/pages/auth/Login";

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
