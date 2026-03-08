import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Menu, X, Bell, Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useQuery } from "@tanstack/react-query";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={cn(
        "fixed w-full z-50 h-20 transition-all duration-300",
        isScrolled ? "glass-nav" : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-full flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <img 
            src={siteLogo} 
            alt="SabiRight" 
            className="w-9 h-9 rounded-lg group-hover:scale-110 transition-transform"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/assets/sabiright-icon.png";
            }}
          />
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {getSetting('site_title') || "SabiRight"}
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-8 font-semibold text-slate-600 dark:text-slate-300">
          <Link href="/about">
            <button className="hover:text-primary transition">About</button>
          </Link>
          <Link href="/pricing">
            <button className="hover:text-primary transition">Pricing</button>
          </Link>
          <Link href="/app/forum">
            <button className="hover:text-primary transition">Forum</button>
          </Link>
          <Link href="/contact">
            <button className="hover:text-primary transition">Contact</button>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleTheme} 
              className="rounded-full w-10 h-10 text-slate-500 hover:text-primary"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Link href="/app" className="inline-flex">
              <Button className="rounded-xl font-bold shadow-lg hover:shadow-primary/20 transition-all">
                Launch App
              </Button>
            </Link>
        </div>

        {/* Mobile Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme} 
            className="rounded-full w-9 h-9 text-slate-500"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <button
            className="text-slate-900 dark:text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="absolute top-20 left-0 w-full bg-white dark:bg-slate-900 border-b shadow-lg p-6 flex flex-col gap-4 md:hidden">
          <Link href="/about" className="text-left font-semibold py-2 dark:text-white">
            About
          </Link>
          <Link href="/pricing" className="text-left font-semibold py-2 dark:text-white">
            Pricing
          </Link>
          <Link href="/app/forum" className="text-left font-semibold py-2 dark:text-white">
            Forum
          </Link>
          <Link href="/contact" className="text-left font-semibold py-2 dark:text-white">
            Contact
          </Link>
          <Link href="/app" className="inline-flex w-full">
            <Button className="w-full rounded-xl font-bold mt-2">Launch App</Button>
          </Link>
        </div>
      )}
    </nav>
  );
}
