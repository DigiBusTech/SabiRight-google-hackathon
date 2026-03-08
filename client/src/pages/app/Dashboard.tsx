import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, MapPin, Briefcase, Calendar, ChevronRight, ShieldCheck, TrendingUp, Scale, RefreshCw, Zap, Store, CreditCard, Users, FileCheck, Check, Loader2, Gift, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_JOBS } from "@/lib/constants";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import AISuggestions, { hasShownThisSession } from "@/components/AISuggestions";
import WelcomeTour from "@/components/WelcomeTour";
import { motion } from "framer-motion";
import CivicGuard from "@/pages/app/Civic";

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

const CITY_STATE_MAP: Record<string, string> = {
  "Lagos": "Lagos",
  "Abuja": "FCT",
  "Port Harcourt": "Rivers",
  "Kano": "Kano",
  "Ibadan": "Oyo",
  "Kaduna": "Kaduna",
  "Benin City": "Edo",
  "Enugu": "Enugu",
  "Onitsha": "Anambra",
  "Jos": "Plateau",
  "Calabar": "Cross River",
  "Warri": "Delta",
  "Uyo": "Akwa Ibom",
  "Owerri": "Imo",
  "Abeokuta": "Ogun"
};

const NIGERIAN_CITIES = Object.keys(CITY_STATE_MAP);

export default function Dashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userName = user?.displayName?.split(' ')[0] || "Citizen";
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCity, setSelectedCity] = useState(profile?.city || "");
  const [isSavingCity, setIsSavingCity] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [referralCode, setReferralCode] = useState(profile?.referralCode || "");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const fetchReferralCode = async () => {
    if (!user || referralCode) return;
    setIsGeneratingCode(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/profile/${user.uid}/referral-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReferralCode(data.referralCode);
        await refreshProfile();
      }
    } catch (err) {
      console.error("Failed to fetch referral code:", err);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Referral code copied to clipboard" });
  };

  useEffect(() => {
    if (!user || hasShownThisSession()) return;
    
    const timer = setTimeout(() => {
      setShowAISuggestions(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [user]);

  const handleCityChange = async (city: string) => {
    setSelectedCity(city);
    if (!user || !city) return;
    
    setIsSavingCity(true);
    try {
      const state = CITY_STATE_MAP[city] || "";
      const token = await user.getIdToken();
      const res = await fetch(`/api/profile/${user.uid}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ city, state })
      });
      
      if (res.ok) {
        toast({ title: "City Updated", description: `Your city has been set to ${city}` });
        try {
          await refreshProfile();
          queryClient.invalidateQueries({ queryKey: [`profile-${user.uid}`] });
        } catch {
          // Non-blocking: ignore profile refresh errors
        }
      } else {
        toast({ title: "Error", description: "Failed to update city", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update city", variant: "destructive" });
    } finally {
      setIsSavingCity(false);
    }
  };

  const { data: trafficCard, refetch: refetchTraffic } = useQuery({
    queryKey: [`traffic-card-${user?.uid}`],
    queryFn: async () => {
      if (!user) return null;
      const token = await user.getIdToken();
      const res = await fetch(`/api/dashboard/traffic/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.ok ? res.json() : null;
    },
    enabled: !!user?.uid,
  });

  const { data: credits } = useQuery({
    queryKey: [`credits-${user?.uid}`],
    queryFn: async () => {
      if (!user) return null;
      const token = await user.getIdToken();
      const res = await fetch(`/api/credits/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.ok ? res.json() : null;
    },
    enabled: !!user?.uid,
  });

  const handleRefreshTraffic = async () => {
    if (!user || !trafficCard) return;

    setIsRefreshing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/dashboard/traffic/${user.uid}/refresh`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          city: profile?.city || selectedCity || "Lagos",
          location: trafficCard.location || (selectedCity ? `${selectedCity} Route` : "Major Route"),
          status: trafficCard.status || "normal",
          description: trafficCard.description || "Updating traffic info..."
        })
      });

      if (res.ok) {
        toast({ title: "Success", description: "Traffic status updated (1 credit used)" });
        refetchTraffic();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to refresh", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to refresh traffic", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const availableCredits = credits?.totalCredits || 0;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-20"
    >
      <WelcomeTour />
      
      {/* Email Verification Warning Banner */}
      {profile?.emailVerificationStatus !== 'verified' && (
        <motion.div variants={itemVariants} whileHover={{ scale: 1.005 }}>
          <Card className="bg-amber-50 border-amber-200 shadow-sm overflow-hidden">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">Email Verification Required</h3>
                    <p className="text-xs text-amber-700">Verify your email to unlock all features, including becoming a vendor and full marketplace access.</p>
                  </div>
                </div>
                <Link href="/app/verify-email">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold w-full sm:w-auto gap-2">
                    Verify Now <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Welcome Header */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back, {userName}</h2>
          <p className="text-slate-500 text-sm md:text-base mt-1">Here's your civic overview for today.</p>
        </div>
        
        {/* Stats removed */}
      </motion.div>

      {/* City Selection Card */}
      <motion.div variants={itemVariants} id="location-card">
        <Card className="border-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-slate-700">
              <MapPin className="h-4 w-4" /> Your Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Select your city to see local events, jobs, and services near you.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  data-testid="select-city"
                  value={selectedCity || profile?.city || ""}
                  onChange={(e) => handleCityChange(e.target.value)}
                  disabled={isSavingCity}
                  className="w-full pl-10 pr-3 py-3 rounded-xl border-2 border-slate-200 focus:border-primary focus:ring-2 ring-primary/20 outline-none text-sm font-bold bg-white disabled:opacity-50 appearance-none transition-all"
                >
                  <option value="">Select your city</option>
                  {NIGERIAN_CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronRight className="h-4 w-4 text-slate-400 rotate-90" />
                </div>
              </div>
              {isSavingCity && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </div>
              )}
              {(selectedCity || profile?.city) && !isSavingCity && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">{selectedCity || profile?.city}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sabi Civic Guard (after Your Location) */}
      <motion.div variants={itemVariants} id="civic-inline">
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="max-h-[600px] overflow-auto">
            <CivicGuard />
          </div>
        </div>
      </motion.div>

      {/* Referral moved to bottom */}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Alerts & Marketplace */}
        <div className="md:col-span-2 space-y-6">
          {/* Traffic Alert Card */}
          <motion.div variants={itemVariants} id="traffic-card">
            <Card className={`shadow-sm border-2 ${
              trafficCard?.status === 'cleared'
                ? 'bg-green-50/50 border-green-200'
                : trafficCard?.status === 'active'
                ? 'bg-red-50/50 border-red-200'
                : 'bg-yellow-50/50 border-yellow-200'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
                    trafficCard?.status === 'cleared'
                      ? 'text-green-600'
                      : trafficCard?.status === 'active'
                      ? 'text-red-600'
                      : 'text-yellow-600'
                  }`}>
                    <AlertTriangle className="h-4 w-4" /> Traffic Alert
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-full border">{(profile?.city || selectedCity || "LAGOS").toUpperCase()}</span>
                    <Badge className={`text-xs ${
                      trafficCard?.status === 'cleared'
                        ? 'bg-green-600 text-white'
                        : trafficCard?.status === 'active'
                        ? 'bg-red-600 text-white'
                        : 'bg-yellow-600 text-white'
                    }`}>
                      {trafficCard?.status?.toUpperCase() || 'UNKNOWN'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {trafficCard ? (
                  <div>
                    <div className="text-xl md:text-2xl font-bold mb-1">{trafficCard.location}</div>
                    <p className="text-xs md:text-sm text-slate-600">
                      {trafficCard.description}
                    </p>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-sm text-slate-500 italic">No recent traffic alerts for your area.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Select your city above to get localized updates.</p>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleRefreshTraffic}
                    disabled={isRefreshing}
                    size="sm"
                    variant="outline"
                    className="gap-2 w-full sm:flex-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Updating...' : 'Refresh (1 credit)'}
                  </Button>
                  <Link href="/app/traffic" className="w-full sm:flex-1">
                    <Button size="sm" variant="outline" className="w-full gap-2">
                      <MapPin className="h-3 w-3" /> View Routes
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Verified Services Near You */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Verified Services Near You</h3>
              <Link href="/app/marketplace">
                <Button variant="ghost" size="sm" className="text-primary text-xs">View All</Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { name: "Barr. Nnamdi", role: "Legal Practitioner", dist: "0.4km", time: "5min", icon: Scale },
                { name: "FixIt Pro", role: "Plumber", dist: "1.2km", time: "12min", icon: MapPin },
                { name: "SafeMove Logistics", role: "Movers", dist: "3.5km", time: "25min", icon: TrendingUp },
                { name: "MediCare Clinic", role: "Health", dist: "0.8km", time: "8min", icon: ShieldCheck },
              ].map((service, i) => (
                <motion.div 
                  key={i} 
                  whileHover={{ scale: 1.02, x: 5 }}
                  className="flex items-start gap-3 p-3 rounded-xl border bg-white hover:border-primary/50 transition-colors cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors flex-shrink-0">
                    <service.icon className="h-5 w-5 text-slate-500 group-hover:text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm truncate">{service.name}</h4>
                    <p className="text-xs text-slate-500">{service.role}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-400">
                      <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex-shrink-0">{service.dist}</span>
                      <span>•</span>
                      <span className="truncate">{service.time} away</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3" id="quick-actions">
            {profile?.isAdmin && (
              <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }}>
                <Link href="/admin">
                  <Card className="bg-red-50 border-red-100 hover:border-red-300 transition-colors cursor-pointer h-full">
                    <CardContent className="p-4 flex items-start gap-3 md:flex-col md:items-start md:gap-0">
                      <ShieldCheck className="h-6 w-6 text-red-600 mb-0 md:mb-2 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-sm mb-1">Admin Dashboard</h4>
                        <p className="text-xs text-slate-600">Manage platform and users</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )}

            {profile?.isVendor && (
              <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }}>
                <Link href="/app/vendor">
                  <Card className="bg-orange-50 border-orange-100 hover:border-orange-300 transition-colors cursor-pointer h-full">
                    <CardContent className="p-4 flex items-start gap-3 md:flex-col md:items-start md:gap-0">
                      <Store className="h-6 w-6 text-orange-600 mb-0 md:mb-2 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-sm mb-1">Vendor Portal</h4>
                        <p className="text-xs text-slate-600">Manage your business & leads</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )}

            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }}>
              <Link href="/app/jobs">
                <Card className="bg-blue-50 border-blue-100 hover:border-blue-300 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4 flex items-start gap-3 md:flex-col md:items-start md:gap-0">
                    <Briefcase className="h-6 w-6 text-blue-600 mb-0 md:mb-2 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm mb-1">Job Matches</h4>
                      <p className="text-xs text-slate-600">{MOCK_JOBS.length} new matches based on your profile</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
            
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }}>
              <Link href="/app/events">
                <Card className="bg-purple-50 border-purple-100 hover:border-purple-300 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4 flex items-start gap-3 md:flex-col md:items-start md:gap-0">
                    <Calendar className="h-6 w-6 text-purple-600 mb-0 md:mb-2 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm mb-1">Events</h4>
                      <p className="text-xs text-slate-600">Upcoming civic events near you</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
            
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }}>
              <Link href="/app/marketplace">
                <Card className="bg-green-50 border-green-100 hover:border-green-300 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4 flex items-start gap-3 md:flex-col md:items-start md:gap-0">
                    <Users className="h-6 w-6 text-green-600 mb-0 md:mb-2 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm mb-1">Marketplace</h4>
                      <p className="text-xs text-slate-600">Find verified professionals nearby</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
            
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }}>
              <Link href="/app/forum">
                <Card className="bg-pink-50 border-pink-100 hover:border-pink-300 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4 flex items-start gap-3 md:flex-col md:items-start md:gap-0">
                    <TrendingUp className="h-6 w-6 text-pink-600 mb-0 md:mb-2 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm mb-1">Community</h4>
                      <p className="text-xs text-slate-600">Join discussions & forums</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          </div>

          {/* Verified Services moved above */}
        </div>

        {/* Right Column - AI Access */}
        <div className="space-y-6">

          {/* Credits Card */}
          <motion.div variants={itemVariants} id="credits-card">
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Available Credits</p>
                    <p className="text-2xl font-bold text-amber-600">{availableCredits}</p>
                  </div>
                </div>
                <Link href="/app/credits">
                  <Button variant="outline" size="sm" className="w-full border-amber-300 text-amber-700 hover:bg-amber-100">
                    Get More Credits
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/app/verify-email">
                  <Button variant="ghost" className="w-full justify-between h-auto py-2 px-3" size="sm">
                    <span className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4" /> Verify Email
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/app/settings">
                  <Button variant="ghost" className="w-full justify-between h-auto py-2 px-3" size="sm">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Account Settings
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Become a Vendor CTA - after Traffic Alert */}
      {!profile?.isVendor && (
        <motion.div variants={itemVariants} whileHover={{ scale: 1.01 }}>
          <Card className="bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0 shadow-lg overflow-hidden">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Store className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-1">Become a Verified Vendor</h3>
                    <p className="text-white/80 text-sm">List your services on SabiMarket and connect with customers near you. Get leads, bookings, and grow your business.</p>
                  </div>
                </div>
                <Link href="/app/vendor">
                  <Button className="bg-white text-orange-600 hover:bg-white/90 font-bold w-full md:w-auto">
                    Apply Now <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Refer & Earn Card (moved to bottom) */}
      <motion.div variants={itemVariants} whileHover={{ scale: 1.01 }}>
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-0 shadow-lg overflow-hidden">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Gift className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">Refer & Earn Credits</h3>
                  <p className="text-white/80 text-sm">Share your code with friends. They get a signup bonus, and you get 50 credits when they join!</p>
                </div>
              </div>
              
              <div className="bg-white/10 p-3 rounded-xl border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-4 w-full md:min-w-[240px]">
                {referralCode ? (
                  <>
                    <div className="flex flex-col items-center sm:items-start w-full sm:w-auto">
                      <span className="text-[10px] uppercase font-bold text-white/60">Your Code</span>
                      <span className="text-lg font-black tracking-widest">{referralCode}</span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-end">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-9 w-9 text-white hover:bg-white/20"
                        onClick={() => copyToClipboard(referralCode)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-9 w-9 text-white hover:bg-white/20"
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: 'Join SabiRight',
                              text: `Join me on SabiRight using my referral code: ${referralCode}`,
                              url: window.location.origin
                            });
                          } else {
                            copyToClipboard(`${window.location.origin}?ref=${referralCode}`);
                          }
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button 
                    className="w-full bg-white text-blue-600 hover:bg-white/90 font-bold"
                    onClick={fetchReferralCode}
                    disabled={isGeneratingCode}
                  >
                    {isGeneratingCode ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    Generate My Code
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <AISuggestions
        isOpen={showAISuggestions}
        onClose={() => setShowAISuggestions(false)}
      />
    </motion.div>
  );
}
