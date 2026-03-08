import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  ChevronDown,
  ChevronRight,
  LayoutDashboard, 
  Scale, 
  Store, 
  Briefcase, 
  Users, 
  Settings, 
  LogOut, 
  Menu,
  X,
  ShieldCheck,
  Calendar,
  Zap,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Wallet,
  CalendarCheck,
  Bell,
  Moon,
  Sun
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import NotificationBell from "@/components/NotificationBell";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useTheme } from "@/context/ThemeContext";
import { useQuery } from "@tanstack/react-query";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSabiSquareOpen, setIsSabiSquareOpen] = useState(false);
  const { user, profile, loading, switchVendorMode } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const getSetting = (key: string) => settings.find((s: any) => s.key === key)?.value;
  
  const siteLogo = theme === 'dark' 
    ? (getSetting('site_logo_dark') || getSetting('site_logo') || "/assets/sabiright-icon.png")
    : (getSetting('site_logo') || "/assets/sabiright-icon.png");

  // Keep SabiSquare open if active
  useEffect(() => {
    if (location === '/app/forum' || location === '/app/events' || location === '/app/jobs') {
      setIsSabiSquareOpen(true);
    }
  }, [location]);

  // Protect Route
  const publicRoutes = ['/app/forum', '/app/jobs', '/app/events'];
  const isPublicRoute = publicRoutes.includes(location);

  if (!loading && !user && !isPublicRoute) {
      setTimeout(() => setLocation("/auth/login"), 0);
      return null;
  }

  const handleSignOut = async () => {
      await signOut(auth);
      setLocation("/");
  };

  // If not logged in and on a public route, show the public layout
  if (!user && isPublicRoute) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-white flex flex-col">
        <Navbar />
        <div className="flex-1 pt-24 pb-12">
          {children}
        </div>
        <Footer />
      </div>
    );
  }

  // Admin items
  
  const adminItems = profile?.isAdmin ? [
    { 
      icon: ShieldCheck, 
      label: "Admin Dashboard", 
      href: "/admin", 
    },
  ] : [];

  const baseNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/app" },
    { icon: Scale, label: "SabiRight AI", href: "/app/civic", description: "Law-based Guidance" },
    { icon: AlertTriangle, label: "SabiMove", href: "/app/traffic", description: "Smart Traffic" },
    { icon: Store, label: "SabiMarket", href: "/app/marketplace", description: "Find Pros" },
    { icon: Wallet, label: "Wallet", href: "/app/wallet" },
    { icon: CalendarCheck, label: "My Bookings", href: "/app/bookings" },
    { icon: Zap, label: "Plans & Billing", href: "/app/plans" },
    { icon: Settings, label: "Settings", href: "/app/settings" },
  ];

  const sabiSquareItems = [
    { icon: Users, label: "Community Forum", href: "/app/forum" },
    { icon: Briefcase, label: "SabiWork", href: "/app/jobs" },
    { icon: Calendar, label: "Events", href: "/app/events" },
  ];

  const vendorItems = profile?.isVendor ? [
    { 
      icon: BarChart3, 
      label: "Vendor Portal", 
      href: "/app/vendor" 
    },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed md:sticky top-0 h-screen w-64 bg-slate-900 dark:bg-slate-950 text-white z-50 transition-transform duration-300 ease-in-out flex flex-col border-r border-slate-800",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <img 
            src={siteLogo} 
            alt="SabiRight" 
            className="h-8 w-8 rounded-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/assets/sabiright-icon.png";
            }}
          />
          <span className="font-bold text-lg tracking-tight">{getSetting('site_title') || "SabiRight"}</span>
          <button 
            className="md:hidden ml-auto text-slate-400"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {profile?.isVendor && (
            <div className="flex items-center justify-between px-4 py-3 mb-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendor Mode</span>
                <span className="text-xs font-semibold text-white">{profile.vendorMode ? 'Active' : 'Off'}</span>
              </div>
              <Switch 
                checked={profile.vendorMode} 
                onCheckedChange={(checked) => switchVendorMode(checked)}
              />
            </div>
          )}

          {/* Admin Items */}
          {adminItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-white font-semibold shadow-md shadow-primary/20" 
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
                onClick={() => setIsSidebarOpen(false)}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-500 group-hover:text-white")} />
                {item.label}
              </Link>
            );
          })}

          {/* Main Items - Part 1 */}
          {baseNavItems.slice(0, 3).map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-white font-semibold shadow-md shadow-primary/20" 
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
                onClick={() => setIsSidebarOpen(false)}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-500 group-hover:text-white")} />
                {item.label}
              </Link>
            );
          })}

          {/* SabiSquare Collapsible */}
          <div className="space-y-1">
            <button
              onClick={() => setIsSabiSquareOpen(!isSabiSquareOpen)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
                (location === '/app/forum' || location === '/app/events' || location === '/app/jobs')
                  ? "text-white font-semibold"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <Users className={cn("h-5 w-5", (location === '/app/forum' || location === '/app/events' || location === '/app/jobs') ? "text-primary" : "text-slate-500 group-hover:text-white")} />
                <span>SabiSquare</span>
              </div>
              {isSabiSquareOpen ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
            </button>

            <AnimatePresence>
              {isSabiSquareOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="ml-4 pl-4 border-l border-slate-800 space-y-1 mt-1">
                    {sabiSquareItems.map((item) => {
                      const isActive = location === item.href;
                      return (
                        <Link 
                          key={item.href} 
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 text-sm",
                            isActive 
                              ? "bg-white/10 text-white font-medium" 
                              : "text-slate-400 hover:text-white"
                          )}
                          onClick={() => setIsSidebarOpen(false)}
                        >
                          <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-slate-500")} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main Items - Part 2 */}
          {baseNavItems.slice(3).map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-white font-semibold shadow-md shadow-primary/20" 
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
                onClick={() => setIsSidebarOpen(false)}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-500 group-hover:text-white")} />
                {item.label}
              </Link>
            );
          })}

          {/* Vendor Items */}
          {vendorItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-white font-semibold shadow-md shadow-primary/20" 
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
                onClick={() => setIsSidebarOpen(false)}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-500 group-hover:text-white")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Link href="/app/settings" data-testid="link-user-settings">
            <div className="bg-slate-800/50 rounded-xl p-4 mb-4 cursor-pointer hover:bg-slate-800 transition-colors">
               <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-10 w-10 border-2 border-primary">
                    <AvatarImage src={user?.photoURL || ""} />
                    <AvatarFallback>{user?.displayName?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="font-bold text-sm truncate">{user?.displayName || "Citizen"}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                  </div>
               </div>
               <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Verified</span>
                  <span className="text-primary font-bold"><ShieldCheck className="inline h-3 w-3"/> Active</span>
               </div>
            </div>
          </Link>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/5 gap-3"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 h-16 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-400"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="font-bold text-xl text-slate-800 dark:text-white capitalize">
              {location === '/app' ? 'Dashboard' : location.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
             <Button 
               variant="ghost" 
               size="icon" 
               onClick={toggleTheme} 
               className="rounded-full w-10 h-10 text-slate-500 hover:text-primary"
             >
               {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
             </Button>
             <NotificationBell />
             <Link href="/app/settings" data-testid="link-settings-header">
               <Button size="icon" variant="ghost" className="relative text-slate-500 hover:text-primary">
                 <Settings className="h-5 w-5" />
               </Button>
             </Link>
          </div>
        </header>

        <div className="p-4 md:p-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
