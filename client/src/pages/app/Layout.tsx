import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
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
  CalendarCheck
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, profile, loading, switchVendorMode } = useAuth();

  // Protect Route
  if (!loading && !user) {
      setLocation("/auth/login");
      return null;
  }

  const handleSignOut = async () => {
      await signOut(auth);
      setLocation("/");
  };

  // Admin items come first if user is admin
  const adminItems = profile?.isAdmin ? [
    { icon: Settings, label: "Admin Dashboard", href: "/admin", isAdmin: true },
  ] : [];

  const baseNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/app" },
    { icon: Scale, label: "SabiGuard", href: "/app/civic", description: "Legal First Aid" },
    { icon: AlertTriangle, label: "SabiMove", href: "/app/traffic", description: "Smart Traffic" },
    { icon: Briefcase, label: "SabiWork", href: "/app/jobs", description: "Jobs & Careers" },
    { icon: Store, label: "SabiMarket", href: "/app/marketplace", description: "Find Pros" },
    { icon: Users, label: "SabiSquare", href: "/app/forum", description: "Community" },
    { icon: Calendar, label: "Events", href: "/app/events" },
    { icon: CalendarCheck, label: "My Bookings", href: "/app/bookings" },
    { icon: Wallet, label: "Wallet", href: "/app/wallet" },
    { icon: BadgeCheck, label: "KYC Verification", href: "/app/kyc" },
    { icon: Zap, label: "Plans & Billing", href: "/app/plans" },
    { icon: Settings, label: "Settings", href: "/app/settings" },
  ];

  const vendorItems = profile?.isVendor ? [
    { icon: BarChart3, label: "Vendor Dashboard", href: "/app/vendor" },
  ] : [];

  // Admin dashboard appears first in navigation for admin users
  const navItems = [...adminItems, ...baseNavItems, ...vendorItems];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
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
          "fixed md:sticky top-0 h-screen w-64 bg-slate-900 text-white z-50 transition-transform duration-300 ease-in-out flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <img 
            src="/assets/sabiright-icon.png" 
            alt="SabiRight" 
            className="h-8 w-8 rounded-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="font-bold text-lg tracking-tight">SabiRight</span>
          <button 
            className="md:hidden ml-auto text-slate-400"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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
          {navItems.map((item) => {
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
        <header className="bg-white border-b h-16 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-600"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="font-bold text-xl text-slate-800 capitalize">
              {location.split('/').pop() || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <Link href="/app/settings" data-testid="link-settings-header">
               <Button size="icon" variant="ghost" className="relative text-slate-500 hover:text-primary">
                 <Settings className="h-5 w-5" />
               </Button>
             </Link>
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
