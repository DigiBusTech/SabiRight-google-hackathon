import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, MapPin, Briefcase, Calendar, ChevronRight, ShieldCheck, TrendingUp, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOCK_JOBS } from "@/lib/constants";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const userName = user?.displayName || "Citizen";

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Good Morning, {userName}</h2>
          <p className="text-slate-500 mt-1">Here's your civic overview for today.</p>
        </div>
        <div className="flex gap-3">
           <Button className="bg-slate-900 text-white hover:bg-slate-800">
             <ShieldCheck className="mr-2 h-4 w-4" /> Verify Status
           </Button>
        </div>
      </div>

      {/* Critical Alerts Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-red-50 border-red-100 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-red-600 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Traffic Alert
            </CardTitle>
            <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-full text-red-600 border border-red-100">LAGOS</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1">3rd Mainland Bridge</div>
            <p className="text-xs text-slate-600">
              Multiple vehicle collision reported. Route calculation suggests +45min delay.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-100 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Job Matches
            </CardTitle>
            <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-full text-blue-600 border border-blue-100">NEW</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1">{MOCK_JOBS.length} New Matches</div>
            <p className="text-xs text-slate-600">
              Based on your verified skill profile in "Software Development".
            </p>
            <Link href="/app/jobs">
              <Button variant="link" className="p-0 h-auto text-blue-600 text-xs mt-3 font-bold">
                View Matches <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-purple-600 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1">Tech Summit 2025</div>
            <p className="text-xs text-slate-600">
              Lagos Zone 1 • Tomorrow at 9:00 AM
            </p>
            <Button variant="link" className="p-0 h-auto text-purple-600 text-xs mt-3 font-bold">
              View Ticket <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Marketplace Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Verified Services Near You</h3>
            <Button variant="ghost" size="sm" className="text-primary">View All</Button>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4">
             {[
               { name: "Barr. Nnamdi", role: "Legal Practitioner", dist: "0.4km", time: "5min", rating: 4.9, icon: Scale },
               { name: "FixIt Pro", role: "Plumber", dist: "1.2km", time: "12min", rating: 4.7, icon: MapPin },
               { name: "SafeMove Logistics", role: "Movers", dist: "3.5km", time: "25min", rating: 4.8, icon: TrendingUp },
               { name: "MediCare Clinic", role: "Health", dist: "0.8km", time: "8min", rating: 4.5, icon: ShieldCheck },
             ].map((service, i) => (
               <div key={i} className="flex items-start gap-4 p-4 rounded-xl border bg-white hover:border-primary/50 transition-colors cursor-pointer group">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <service.icon className="h-5 w-5 text-slate-500 group-hover:text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{service.name}</h4>
                    <p className="text-xs text-slate-500">{service.role}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400">
                       <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{service.dist}</span>
                       <span>•</span>
                       <span>{service.time} away</span>
                    </div>
                  </div>
               </div>
             ))}
          </div>
        </div>

        {/* AI Quick Access */}
        <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            
            <h3 className="text-xl font-bold mb-2">Right-to-Know AI</h3>
            <p className="text-slate-400 text-sm mb-6">
              Need instant legal citations? I can verify your rights under the 1999 Constitution.
            </p>
            
            <div className="space-y-3">
              <Button className="w-full justify-start bg-white/10 hover:bg-white/20 border-0 text-left h-auto py-3 px-4">
                <span className="text-xs">"What are my rights at a checkpoint?"</span>
              </Button>
              <Button className="w-full justify-start bg-white/10 hover:bg-white/20 border-0 text-left h-auto py-3 px-4">
                <span className="text-xs">"Can my landlord increase rent arbitrarily?"</span>
              </Button>
              
              <Link href="/app/civic">
                <Button className="w-full mt-4 bg-primary hover:bg-primary/90 text-white font-bold">
                  Start New Chat <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
