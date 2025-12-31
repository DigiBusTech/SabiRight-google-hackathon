import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Briefcase, Building2, MapPin, DollarSign, Clock, Search, Loader2, X, AlertCircle, Plus, Filter, Bookmark, BookmarkCheck, Send, CheckCircle, XCircle, Eye, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { CreditDisplay } from "@/components/CreditDisplay";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const NIGERIAN_CITIES = [
  "Lagos", "Abuja", "Port Harcourt", "Kano", "Ibadan", "Kaduna", 
  "Benin City", "Enugu", "Onitsha", "Jos", "Calabar", "Warri", 
  "Uyo", "Owerri", "Abeokuta"
];

const APPLICATION_STATUSES = {
  applied: { label: "Applied", color: "bg-blue-100 text-blue-800", icon: Send },
  reviewing: { label: "Under Review", color: "bg-yellow-100 text-yellow-800", icon: Eye },
  interviewing: { label: "Interviewing", color: "bg-purple-100 text-purple-800", icon: Users },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
};

interface Job {
  id: string;
  title: string;
  company?: string;
  location: string;
  type: string;
  workMode?: string;
  salary?: string;
  description?: string;
  contact?: string;
  source?: string;
  postedAt?: any;
  applicationStatus?: string;
  appliedAt?: string;
}

export default function Jobs() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  
  const [role, setRole] = useState("");
  const [location, setLocation] = useState(profile?.city || "Lagos");
  const [employmentType, setEmploymentType] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [showPostJob, setShowPostJob] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: "",
    company: "",
    location: profile?.city || "Lagos",
    type: "Full-time",
    workMode: "Onsite",
    salary: "",
    description: "",
    contact: ""
  });

  const userCity = profile?.city || "";

  const { data: credits, refetch: refetchCredits } = useQuery({
    queryKey: [`credits-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const res = await fetch(`/api/credits/${user.uid}/available`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.uid,
    refetchInterval: 30000,
  });

  const { data: allJobs = [], isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const res = await fetch('/api/jobs');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: savedJobs = [], refetch: refetchSavedJobs } = useQuery({
    queryKey: ['savedJobs', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/jobs/saved/${user.uid}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.uid,
  });

  const { data: savedJobIds = [], refetch: refetchSavedJobIds } = useQuery({
    queryKey: ['savedJobIds', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/jobs/saved-ids/${user.uid}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.uid,
  });

  const { data: appliedJobs = [], refetch: refetchAppliedJobs } = useQuery({
    queryKey: ['appliedJobs', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/jobs/applied/${user.uid}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.uid,
  });

  const { data: appliedJobIds = [], refetch: refetchAppliedJobIds } = useQuery({
    queryKey: ['appliedJobIds', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/jobs/applied-ids/${user.uid}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.uid,
  });

  const { data: generatedJobs = [], refetch: refetchGeneratedJobs } = useQuery({
    queryKey: ['generatedJobs', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/jobs/generated/${user.uid}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.uid,
  });

  const saveJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.uid })
      });
      if (!res.ok) throw new Error('Failed to save job');
      return res.json();
    },
    onSuccess: () => {
      refetchSavedJobs();
      refetchSavedJobIds();
      toast({ title: "Job Saved", description: "This job has been added to your saved jobs." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save job", variant: "destructive" });
    }
  });

  const unsaveJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/save`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.uid })
      });
      if (!res.ok) throw new Error('Failed to unsave job');
      return res.json();
    },
    onSuccess: () => {
      refetchSavedJobs();
      refetchSavedJobIds();
      toast({ title: "Job Removed", description: "This job has been removed from your saved jobs." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove job", variant: "destructive" });
    }
  });

  const applyJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.uid })
      });
      if (!res.ok) throw new Error('Failed to apply to job');
      return res.json();
    },
    onSuccess: () => {
      refetchAppliedJobs();
      refetchAppliedJobIds();
      toast({ title: "Application Submitted", description: "Your application has been recorded. Good luck!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit application", variant: "destructive" });
    }
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!role.trim()) {
      toast({ 
        title: "Enter a Role", 
        description: "Please enter a job role or keywords to search.",
        variant: "destructive"
      });
      return;
    }

    if (!credits || credits.availableCredits < 1) {
      toast({ 
        title: "No Credits", 
        description: "Each job search uses 1 credit. Upgrade your plan for unlimited searches.",
        variant: "destructive"
      });
      return;
    }

    setSearching(true);

    try {
      const response = await fetch('/api/ai/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          role,
          location,
          employmentType,
          workMode
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Job search failed');
      }

      const data = await response.json();
      
      toast({ 
        title: "Jobs Found", 
        description: `${data.jobs?.length || 0} new job listings added to your feed (1 credit used)`
      });
      
      refetchJobs();
      refetchCredits();
      refetchGeneratedJobs();
    } catch (err: any) {
      console.error(err);
      toast({ 
        title: "Search Failed", 
        description: err.message || "Failed to search for jobs",
        variant: "destructive"
      });
    } finally {
      setSearching(false);
    }
  };

  const handlePostJob = async () => {
    if (!jobForm.title || !jobForm.company || !jobForm.description) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }

    setIsPosting(true);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...jobForm,
          postedBy: user?.uid,
          source: 'User Posted'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to post job');
      }

      toast({ title: "Success", description: "Job posted successfully!" });
      setShowPostJob(false);
      setJobForm({
        title: "", company: "", location: "Lagos", type: "Full-time",
        workMode: "Onsite", salary: "", description: "", contact: ""
      });
      refetchJobs();
    } catch (err) {
      toast({ title: "Error", description: "Failed to post job", variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  };

  const handleSaveJob = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (savedJobIds.includes(jobId)) {
      unsaveJobMutation.mutate(jobId);
    } else {
      saveJobMutation.mutate(jobId);
    }
  };

  const handleApplyJob = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    if (appliedJobIds.includes(job.id)) {
      if (job.contact) {
        window.open(job.contact.startsWith('http') ? job.contact : `mailto:${job.contact}`, '_blank');
      }
    } else {
      applyJobMutation.mutate(job.id);
    }
  };

  const filterJobs = (jobs: Job[]) => {
    return jobs.filter(job => {
      if (employmentType && job.type !== employmentType) return false;
      if (workMode && job.workMode !== workMode) return false;
      if (cityFilter && !job.location?.toLowerCase().includes(cityFilter.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      const aInUserCity = userCity && a.location?.toLowerCase().includes(userCity.toLowerCase());
      const bInUserCity = userCity && b.location?.toLowerCase().includes(userCity.toLowerCase());
      
      if (aInUserCity && !bInUserCity) return -1;
      if (!aInUserCity && bInUserCity) return 1;
      return 0;
    });
  };

  const getJobsForTab = () => {
    switch (activeTab) {
      case 'saved':
        return filterJobs(savedJobs);
      case 'applied':
        return filterJobs(appliedJobs);
      case 'generated':
        return filterJobs(generatedJobs);
      default:
        return filterJobs(allJobs);
    }
  };

  const displayedJobs = getJobsForTab();

  const renderJobCard = (job: Job) => {
    const isSaved = savedJobIds.includes(job.id);
    const isApplied = appliedJobIds.includes(job.id);
    const applicationStatus = job.applicationStatus || (isApplied ? 'applied' : null);
    const StatusConfig = applicationStatus ? APPLICATION_STATUSES[applicationStatus as keyof typeof APPLICATION_STATUSES] : null;

    return (
      <Card 
        key={job.id} 
        data-testid={`job-card-${job.id}`}
        className="hover:border-primary/50 transition-all cursor-pointer hover:shadow-md group relative overflow-hidden"
        onClick={() => setSelectedJob(job)}
      >
        {job.source && job.source !== 'User Posted' && (
          <div className="absolute top-0 right-0 bg-purple-100 text-purple-800 text-[10px] px-2 py-1 font-bold rounded-bl-lg">
            AI Matched
          </div>
        )}
        <CardContent className="p-6">
          <div className="flex gap-4 items-start">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-100 to-slate-100 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-slate-400" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-slate-900">{job.title}</h3>
                  <p className="text-sm text-slate-600">{job.company || "Confidential"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {StatusConfig && (
                    <Badge className={cn("text-xs", StatusConfig.color)}>
                      <StatusConfig.icon className="h-3 w-3 mr-1" />
                      {StatusConfig.label}
                    </Badge>
                  )}
                  <Badge variant={job.type === "Full-time" ? "default" : "secondary"} className="shrink-0">
                    {job.type}
                  </Badge>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3 text-sm text-slate-500 mb-3">
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400" /> {job.location}</span>
                {job.workMode && <span className="flex items-center gap-1"><Briefcase className="h-4 w-4 text-slate-400" /> {job.workMode}</span>}
                {job.salary && <span className="flex items-center gap-1"><DollarSign className="h-4 w-4 text-slate-400" /> {job.salary}</span>}
              </div>
              
              <p className="text-sm text-slate-600 line-clamp-2 mb-3">{job.description?.replace(/\*\*/g, '').replace(/\#/g, '') || "No description"}</p>
              
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  data-testid={`save-job-${job.id}`}
                  onClick={(e) => handleSaveJob(e, job.id)}
                  className={cn(isSaved && "bg-yellow-50 border-yellow-300 text-yellow-700")}
                >
                  {isSaved ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
                  {isSaved ? "Saved" : "Save"}
                </Button>
                <Button 
                  size="sm"
                  data-testid={`apply-job-${job.id}`}
                  onClick={(e) => handleApplyJob(e, job)}
                  className={cn(isApplied && "bg-green-600 hover:bg-green-700")}
                >
                  {isApplied ? <CheckCircle className="h-4 w-4 mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  {isApplied ? "Applied" : "Apply"}
                </Button>
                <Button size="sm" variant="ghost">
                  View Details
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Job Matches</h2>
          <p className="text-slate-500">Opportunities curated for your verified profile.</p>
        </div>
        <div className="flex gap-2">
          <CreditDisplay compact={true} />
          <Button onClick={() => setShowPostJob(true)} data-testid="post-job-btn">
            <Plus className="h-4 w-4 mr-1" /> Post a Job
          </Button>
        </div>
      </div>

      {(!credits || credits.availableCredits < 1) && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-900">No credits for job generation</p>
            <p className="text-xs text-yellow-700">You can still browse and apply to jobs already generated. <a href="/app/plans" className="underline font-bold">Upgrade your plan</a> for unlimited searches.</p>
          </div>
        </div>
      )}

      {/* Search Form */}
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="p-6">
          <form id="search-form" onSubmit={handleSearch} className="grid md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-blue-800 uppercase">Role / Keywords</label>
              <input 
                className="w-full p-2 rounded border border-blue-200 focus:ring-2 ring-blue-500 outline-none" 
                placeholder="e.g. Software Engineer"
                value={role}
                onChange={e => setRole(e.target.value)}
                data-testid="input-job-role"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-blue-800 uppercase">Location</label>
              <select
                className="w-full p-2 rounded border border-blue-200 focus:ring-2 ring-blue-500 outline-none bg-white"
                value={location}
                onChange={e => setLocation(e.target.value)}
                data-testid="select-location"
              >
                {NIGERIAN_CITIES.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-blue-800 uppercase">Employment</label>
              <select 
                className="w-full p-2 rounded border border-blue-200 focus:ring-2 ring-blue-500 outline-none bg-white"
                value={employmentType}
                onChange={e => setEmploymentType(e.target.value)}
                data-testid="select-employment"
              >
                <option value="">All Types</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-blue-800 uppercase">Work Mode</label>
              <select 
                className="w-full p-2 rounded border border-blue-200 focus:ring-2 ring-blue-500 outline-none bg-white"
                value={workMode}
                onChange={e => setWorkMode(e.target.value)}
                data-testid="select-work-mode"
              >
                <option value="">All Modes</option>
                <option value="Remote">Remote</option>
                <option value="Onsite">Onsite</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-bold" disabled={searching} data-testid="search-jobs-btn">
                {searching ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2 h-4 w-4" />}
                Find
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <TabsList className="grid grid-cols-4 w-full sm:w-auto">
            <TabsTrigger value="all" data-testid="tab-all-jobs">
              All Jobs
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">{allJobs.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="applied" data-testid="tab-applied-jobs">
              Applied
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">{appliedJobs.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="saved" data-testid="tab-saved-jobs">
              Saved
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">{savedJobs.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="generated" data-testid="tab-generated-jobs">
              AI Generated
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">{generatedJobs.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* City Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              data-testid="filter-city-jobs"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium bg-white focus:ring-2 ring-primary/20 outline-none"
            >
              <option value="">All Cities</option>
              {NIGERIAN_CITIES.map(city => (
                <option key={city} value={city}>
                  {city} {city === userCity && "(Your City)"}
                </option>
              ))}
            </select>
            {userCity && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hidden sm:flex">
                <MapPin className="h-3 w-3 mr-1" />
                Your city: {userCity}
              </Badge>
            )}
          </div>
        </div>

        <TabsContent value="all" className="mt-0">
          <div className="grid gap-4">
            {jobsLoading ? (
              <div className="text-center py-10 text-slate-400">Loading jobs...</div>
            ) : displayedJobs.length === 0 ? (
              <div className="text-center py-10 text-slate-400">No jobs match your filters. Try adjusting them!</div>
            ) : (
              displayedJobs.map(renderJobCard)
            )}
          </div>
        </TabsContent>

        <TabsContent value="applied" className="mt-0">
          <div className="grid gap-4">
            {displayedJobs.length === 0 ? (
              <div className="text-center py-10">
                <Send className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No applications yet</p>
                <p className="text-sm text-slate-400">Apply to jobs to track your applications here</p>
              </div>
            ) : (
              displayedJobs.map(renderJobCard)
            )}
          </div>
        </TabsContent>

        <TabsContent value="saved" className="mt-0">
          <div className="grid gap-4">
            {displayedJobs.length === 0 ? (
              <div className="text-center py-10">
                <Bookmark className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No saved jobs</p>
                <p className="text-sm text-slate-400">Save jobs to review them later</p>
              </div>
            ) : (
              displayedJobs.map(renderJobCard)
            )}
          </div>
        </TabsContent>

        <TabsContent value="generated" className="mt-0">
          <div className="grid gap-4">
            {displayedJobs.length === 0 ? (
              <div className="text-center py-10">
                <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No AI-generated jobs yet</p>
                <p className="text-sm text-slate-400">Use the search form above to generate personalized job matches</p>
              </div>
            ) : (
              displayedJobs.map(renderJobCard)
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-blue-100 to-slate-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-7 w-7 text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-slate-900">{selectedJob.title}</h2>
                      <p className="text-lg text-slate-600">{selectedJob.company || "Confidential"}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant={selectedJob.type === "Full-time" ? "default" : "secondary"}>
                      {selectedJob.type}
                    </Badge>
                    {selectedJob.workMode && <Badge variant="outline">{selectedJob.workMode}</Badge>}
                    {selectedJob.source && <Badge variant="outline" className="bg-purple-50">{selectedJob.source}</Badge>}
                    {selectedJob.applicationStatus && (
                      <Badge className={cn(APPLICATION_STATUSES[selectedJob.applicationStatus as keyof typeof APPLICATION_STATUSES]?.color)}>
                        {APPLICATION_STATUSES[selectedJob.applicationStatus as keyof typeof APPLICATION_STATUSES]?.label}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  data-testid="close-job-modal"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              <div className="grid md:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Location</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{selectedJob.location}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Employment</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{selectedJob.type}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Work Mode</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{selectedJob.workMode || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Salary</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{selectedJob.salary || "Negotiable"}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-3">Job Description</h3>
                <div className="prose prose-sm max-w-none text-slate-700">
                  <ReactMarkdown>{selectedJob.description || "No description available"}</ReactMarkdown>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  className={cn("flex-1", savedJobIds.includes(selectedJob.id) && "bg-yellow-50 border-yellow-300")}
                  onClick={(e) => handleSaveJob(e, selectedJob.id)}
                  data-testid="modal-save-job"
                >
                  {savedJobIds.includes(selectedJob.id) ? <BookmarkCheck className="h-4 w-4 mr-2" /> : <Bookmark className="h-4 w-4 mr-2" />}
                  {savedJobIds.includes(selectedJob.id) ? "Saved" : "Save Job"}
                </Button>
                <Button 
                  className={cn("flex-1", appliedJobIds.includes(selectedJob.id) ? "bg-green-600 hover:bg-green-700" : "bg-primary hover:bg-primary/90")}
                  onClick={(e) => handleApplyJob(e, selectedJob)}
                  data-testid="modal-apply-job"
                >
                  {appliedJobIds.includes(selectedJob.id) ? <CheckCircle className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {appliedJobIds.includes(selectedJob.id) ? "Applied" : "Apply Now"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Post Job Modal */}
      {showPostJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg bg-white max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Post a Job</h3>
                <button onClick={() => setShowPostJob(false)} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="close-post-job-modal">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Job Title *</label>
                  <Input
                    value={jobForm.title}
                    onChange={(e) => setJobForm({...jobForm, title: e.target.value})}
                    placeholder="e.g., Senior Software Engineer"
                    data-testid="input-job-title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1">Company Name *</label>
                  <Input
                    value={jobForm.company}
                    onChange={(e) => setJobForm({...jobForm, company: e.target.value})}
                    placeholder="Your company name"
                    data-testid="input-company-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Location</label>
                    <Input
                      value={jobForm.location}
                      onChange={(e) => setJobForm({...jobForm, location: e.target.value})}
                      placeholder="e.g., Lagos"
                      data-testid="input-job-location"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Salary Range</label>
                    <Input
                      value={jobForm.salary}
                      onChange={(e) => setJobForm({...jobForm, salary: e.target.value})}
                      placeholder="e.g., N500k - N800k"
                      data-testid="input-salary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Employment Type</label>
                    <select
                      value={jobForm.type}
                      onChange={(e) => setJobForm({...jobForm, type: e.target.value})}
                      className="w-full border rounded-lg p-2 text-sm"
                      data-testid="select-job-type"
                    >
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Work Mode</label>
                    <select
                      value={jobForm.workMode}
                      onChange={(e) => setJobForm({...jobForm, workMode: e.target.value})}
                      className="w-full border rounded-lg p-2 text-sm"
                      data-testid="select-job-work-mode"
                    >
                      <option value="Onsite">Onsite</option>
                      <option value="Remote">Remote</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1">Job Description *</label>
                  <Textarea
                    value={jobForm.description}
                    onChange={(e) => setJobForm({...jobForm, description: e.target.value})}
                    placeholder="Describe the role, requirements, and responsibilities..."
                    rows={5}
                    data-testid="textarea-job-description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1">Contact (Email or URL)</label>
                  <Input
                    value={jobForm.contact}
                    onChange={(e) => setJobForm({...jobForm, contact: e.target.value})}
                    placeholder="hr@company.com or application URL"
                    data-testid="input-contact"
                  />
                </div>

                <Button 
                  onClick={handlePostJob} 
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isPosting}
                  data-testid="submit-post-job"
                >
                  {isPosting ? 'Posting...' : 'Post Job'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
