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
  Calendar
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, loading } = useAuth();

  // Protect Route
  if (!loading && !user) {
      setLocation("/auth/login");
      return null;
  }

  const handleSignOut = async () => {
      await signOut(auth);
      setLocation("/");
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/app" },
    { icon: Scale, label: "Civic Guard", href: "/app/civic" },
    { icon: Store, label: "Marketplace", href: "/app/marketplace" },
    { icon: Briefcase, label: "Jobs", href: "/app/jobs" },
    { icon: Users, label: "Forum", href: "/app/forum" },
    { icon: Calendar, label: "Events", href: "/app/events" },
  ];

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
          <div className="bg-primary text-white p-1.5 rounded-lg">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">Digital Citizen</span>
          <button 
            className="md:hidden ml-auto text-slate-400"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <a 
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
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
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
             <Button size="icon" variant="ghost" className="relative text-slate-500 hover:text-primary">
               <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
               <Settings className="h-5 w-5" />
             </Button>
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
