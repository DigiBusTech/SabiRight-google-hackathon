import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, MapPin, Briefcase, Calendar, ChevronRight, ShieldCheck, TrendingUp, Scale, RefreshCw, Zap, Store, CreditCard, Users, FileCheck, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_JOBS } from "@/lib/constants";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import AISuggestions, { hasShownThisSession } from "@/components/AISuggestions";

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

  useEffect(() => {
    if (!user || hasShownThisSession()) return;
    
    const timer = setTimeout(() => {
      setShowAISuggestions(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [user]);

  const handleCityChange = async (city: string) => {
    setSelectedCity(city);
    if (!user?.uid || !city) return;
    
    setIsSavingCity(true);
    try {
      const state = CITY_STATE_MAP[city] || "";
      const res = await fetch(`/api/profile/${user.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, state })
      });
      
      if (res.ok) {
        toast({ title: "City Updated", description: `Your city has been set to ${city}` });
        await refreshProfile();
        queryClient.invalidateQueries({ queryKey: [`profile-${user.uid}`] });
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
      if (!user?.uid) return null;
      const res = await fetch(`/api/dashboard/traffic/${user.uid}`);
      return res.ok ? res.json() : {
        location: "3rd Mainland Bridge",
        status: "active",
        description: "Multiple vehicle collision reported. Route calculation suggests +45min delay."
      };
    },
    enabled: !!user?.uid,
  });

  const { data: credits } = useQuery({
    queryKey: [`credits-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const res = await fetch(`/api/credits/${user.uid}`);
      return res.ok ? res.json() : null;
    },
    enabled: !!user?.uid,
  });

  const handleRefreshTraffic = async () => {
    if (!user?.uid || !trafficCard) return;

    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/dashboard/traffic/${user.uid}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: trafficCard.location || "3rd Mainland Bridge",
          status: ['active', 'cleared', 'normal'][Math.floor(Math.random() * 3)],
          description: trafficCard.description
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

  const availableCredits = Math.max(0, (credits?.totalCredits || 0) - (credits?.usedCredits || 0));

  return (
    <div className="space-y-6 pb-20">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back, {userName}</h2>
          <p className="text-slate-500 text-sm md:text-base mt-1">Here's your civic overview for today.</p>
        </div>
        
        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-3 md:p-4 border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-slate-600">Credits</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-primary">{availableCredits}</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-3 md:p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <FileCheck className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-slate-600">KYC</span>
            </div>
            <p className="text-sm md:text-base font-bold text-green-600">
              {profile?.kycStatus === 'verified' ? 'Verified' : profile?.kycStatus === 'pending' ? 'Pending' : 'Not Done'}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3 md:p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-slate-600">Jobs</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-blue-600">{MOCK_JOBS.length}</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-3 md:p-4 border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-slate-600">Events</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-purple-600">3</p>
          </div>
        </div>
      </div>

      {/* City Selection Card */}
      <Card className="border-2 border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-slate-700">
            <MapPin className="h-4 w-4" /> Your Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">Select your city to see local events, jobs, and services near you.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              data-testid="select-city"
              value={selectedCity || profile?.city || ""}
              onChange={(e) => handleCityChange(e.target.value)}
              disabled={isSavingCity}
              className="flex-1 p-3 rounded-lg border-2 border-slate-200 focus:border-primary focus:ring-2 ring-primary/20 outline-none text-sm font-medium bg-white disabled:opacity-50"
            >
              <option value="">Select your city</option>
              {NIGERIAN_CITIES.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
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

      {/* Become a Vendor CTA - Only show if not already a vendor */}
      {!profile?.vendorMode && (
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
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Alerts & Marketplace */}
        <div className="lg:col-span-2 space-y-6">
          {/* Traffic Alert Card */}
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
                  <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-full border">LAGOS</span>
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
              <div>
                <div className="text-xl md:text-2xl font-bold mb-1">{trafficCard?.location || "3rd Mainland Bridge"}</div>
                <p className="text-xs md:text-sm text-slate-600">
                  {trafficCard?.description || "Multiple vehicle collision reported. Route calculation suggests +45min delay."}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleRefreshTraffic}
                  disabled={isRefreshing}
                  size="sm"
                  variant="outline"
                  className="gap-2 flex-1"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Updating...' : 'Refresh (1 credit)'}
                </Button>
                <Link href="/app/traffic" className="flex-1">
                  <Button size="sm" variant="outline" className="w-full gap-2">
                    <MapPin className="h-3 w-3" /> View Routes
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/app/jobs">
              <Card className="bg-blue-50 border-blue-100 hover:border-blue-300 transition-colors cursor-pointer h-full">
                <CardContent className="p-4">
                  <Briefcase className="h-6 w-6 text-blue-600 mb-2" />
                  <h4 className="font-bold text-sm mb-1">Job Matches</h4>
                  <p className="text-xs text-slate-600">{MOCK_JOBS.length} new matches based on your profile</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/app/events">
              <Card className="bg-purple-50 border-purple-100 hover:border-purple-300 transition-colors cursor-pointer h-full">
                <CardContent className="p-4">
                  <Calendar className="h-6 w-6 text-purple-600 mb-2" />
                  <h4 className="font-bold text-sm mb-1">Events</h4>
                  <p className="text-xs text-slate-600">Upcoming civic events near you</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/app/marketplace">
              <Card className="bg-green-50 border-green-100 hover:border-green-300 transition-colors cursor-pointer h-full">
                <CardContent className="p-4">
                  <Users className="h-6 w-6 text-green-600 mb-2" />
                  <h4 className="font-bold text-sm mb-1">Marketplace</h4>
                  <p className="text-xs text-slate-600">Find verified professionals nearby</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/app/forum">
              <Card className="bg-pink-50 border-pink-100 hover:border-pink-300 transition-colors cursor-pointer h-full">
                <CardContent className="p-4">
                  <TrendingUp className="h-6 w-6 text-pink-600 mb-2" />
                  <h4 className="font-bold text-sm mb-1">Community</h4>
                  <p className="text-xs text-slate-600">Join discussions & forums</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Verified Services Preview */}
          <div>
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
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl border bg-white hover:border-primary/50 transition-colors cursor-pointer group">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors flex-shrink-0">
                    <service.icon className="h-5 w-5 text-slate-500 group-hover:text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm truncate">{service.name}</h4>
                    <p className="text-xs text-slate-500">{service.role}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-400">
                      <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{service.dist}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline">{service.time} away</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - AI Access */}
        <div className="space-y-6">
          {/* AI Quick Access */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm border border-white/10">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              
              <h3 className="text-lg font-bold mb-2">SabiGuard AI</h3>
              <p className="text-slate-400 text-sm mb-4">
                Get instant legal citations from the 1999 Constitution.
              </p>
              
              <div className="space-y-2">
                <Button className="w-full justify-start bg-white/10 hover:bg-white/20 border-0 text-left h-auto py-2.5 px-3 text-xs">
                  "What are my rights at a checkpoint?"
                </Button>
                <Button className="w-full justify-start bg-white/10 hover:bg-white/20 border-0 text-left h-auto py-2.5 px-3 text-xs">
                  "Can my landlord increase rent?"
                </Button>
                
                <Link href="/app/civic">
                  <Button className="w-full mt-3 bg-primary hover:bg-primary/90 text-white font-bold">
                    Ask AI <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Credits Card */}
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

          {/* Quick Links */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/app/kyc">
                <Button variant="ghost" className="w-full justify-between h-auto py-2 px-3" size="sm">
                  <span className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4" /> Verify Identity
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
        </div>
      </div>

      <AISuggestions
        isOpen={showAISuggestions}
        onClose={() => setShowAISuggestions(false)}
      />
    </div>
  );
}
