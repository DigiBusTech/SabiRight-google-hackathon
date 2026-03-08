import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { runGemini } from "@/lib/gemini";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Briefcase, Calendar, Clock, Loader2, ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface Suggestion {
  id: string;
  type: "job" | "event" | "booking";
  title: string;
  description: string;
  actionText: string;
  actionLink: string;
}

const DISMISSED_KEY = "ai_suggestions_dismissed";
const SESSION_KEY = "ai_suggestions_shown_session";

function getDismissedSuggestions(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

function dismissSuggestion(id: string) {
  const dismissed = getDismissedSuggestions();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  }
}

function hasShownThisSession(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === "true";
}

function markShownThisSession() {
  sessionStorage.setItem(SESSION_KEY, "true");
}

interface AISuggestionsProps {
  onClose: () => void;
  isOpen: boolean;
}

export default function AISuggestions({ isOpen, onClose }: AISuggestionsProps) {
  const { user, profile } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const res = await fetch("/api/events");
      return res.ok ? res.json() : [];
    },
  });

  const { data: savedEventIds = [] } = useQuery({
    queryKey: ["savedEvents", user?.uid],
    queryFn: async () => {
      if (!user) return [];
      const token = await user.getIdToken();
      const res = await fetch(`/api/events/saved/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.ok ? res.json() : [];
    },
    enabled: !!user?.uid,
  });

  const { data: allJobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const res = await fetch("/api/jobs");
      return res.ok ? res.json() : [];
    },
  });

  const { data: savedJobs = [] } = useQuery({
    queryKey: ["savedJobs", user?.uid],
    queryFn: async () => {
      if (!user) return [];
      const token = await user.getIdToken();
      const res = await fetch(`/api/jobs/saved/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.ok ? res.json() : [];
    },
    enabled: !!user?.uid,
  });

  const { data: appliedJobs = [] } = useQuery({
    queryKey: ["appliedJobs", user?.uid],
    queryFn: async () => {
      if (!user) return [];
      const token = await user.getIdToken();
      const res = await fetch(`/api/jobs/applied/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.ok ? res.json() : [];
    },
    enabled: !!user?.uid,
  });

  const { data: customerBookings = [] } = useQuery({
    queryKey: [`bookings-user-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/bookings/user/${user.uid}`);
      return res.ok ? res.json() : [];
    },
    enabled: !!user?.uid,
  });

  useEffect(() => {
    if (!isOpen || !user || suggestions.length > 0 || isGenerating) return;

    const generateSuggestions = async () => {
      setIsGenerating(true);
      setError(null);

      try {
        const userCity = profile?.city || "";
        const dismissedIds = getDismissedSuggestions();
        
        const pendingBookings = customerBookings.filter(
          (b: any) => b.status === "pending" || b.status === "in_progress"
        );
        
        const registeredEvents = events.filter((e: any) => 
          savedEventIds.includes(e.id)
        );
        
        const upcomingEvents = events.filter((e: any) => {
          if (savedEventIds.includes(e.id)) return false;
          if (!userCity) return true;
          return e.location?.toLowerCase().includes(userCity.toLowerCase());
        }).slice(0, 3);
        
        const availableJobs = allJobs.filter((j: any) => {
          const savedJobIds = savedJobs.map((sj: any) => sj.jobId || sj.id);
          const appliedJobIds = appliedJobs.map((aj: any) => aj.jobId || aj.id);
          return !savedJobIds.includes(j.id) && !appliedJobIds.includes(j.id);
        }).slice(0, 3);

        const contextData = {
          userCity,
          savedJobsCount: savedJobs.length,
          appliedJobsCount: appliedJobs.length,
          pendingBookingsCount: pendingBookings.length,
          registeredEventsCount: registeredEvents.length,
          upcomingEventsNearby: upcomingEvents.map((e: any) => ({
            id: e.id,
            title: e.title,
            date: e.date,
            location: e.location,
          })),
          availableJobs: availableJobs.map((j: any) => ({
            id: j.id,
            title: j.title,
            company: j.company,
            location: j.location,
          })),
          pendingBookings: pendingBookings.map((b: any) => ({
            id: b.id,
            vendorName: b.vendorName || "Service Provider",
            serviceName: b.serviceName || "Service",
            status: b.status,
          })),
        };

        const prompt = `You are a helpful assistant for a Nigerian civic services app called SabiRight. Based on the user's activity data, generate 2-3 personalized, actionable suggestions.

User Data:
- City: ${contextData.userCity || "Not set"}
- Saved Jobs: ${contextData.savedJobsCount}
- Applied Jobs: ${contextData.appliedJobsCount}
- Pending Bookings: ${contextData.pendingBookingsCount}
- Registered Events: ${contextData.registeredEventsCount}

Available opportunities:
${JSON.stringify(contextData.upcomingEventsNearby, null, 2)}
${JSON.stringify(contextData.availableJobs, null, 2)}
${JSON.stringify(contextData.pendingBookings, null, 2)}

Generate suggestions in this exact JSON format (array of objects):
[
  {
    "id": "unique-id-string",
    "type": "job" | "event" | "booking",
    "title": "Short catchy title",
    "description": "Brief helpful description (max 100 chars)",
    "actionText": "Button text like 'View Job' or 'See Event'",
    "actionLink": "/app/jobs" or "/app/events" or "/app/bookings"
  }
]

Rules:
- Only suggest if there's relevant data
- Be specific and mention actual event/job names if available
- For pending bookings, suggest completing or checking on them
- Keep it concise and actionable
- Return ONLY valid JSON array, no markdown or extra text`;

        const result = await runGemini(prompt);
        
        if (result.error) {
          setError(result.error);
          const fallbackSuggestions: Suggestion[] = [];
          
          if (pendingBookings.length > 0) {
            fallbackSuggestions.push({
              id: `booking-${pendingBookings[0].id}`,
              type: "booking",
              title: "Complete Your Booking",
              description: `You have ${pendingBookings.length} pending booking(s) to follow up on`,
              actionText: "View Bookings",
              actionLink: "/app/bookings",
            });
          }
          
          if (upcomingEvents.length > 0) {
            fallbackSuggestions.push({
              id: `event-${upcomingEvents[0].id}`,
              type: "event",
              title: "Upcoming Event Near You",
              description: upcomingEvents[0].title || "Check out events in your area",
              actionText: "See Events",
              actionLink: "/app/events",
            });
          }
          
          if (availableJobs.length > 0) {
            fallbackSuggestions.push({
              id: `job-${availableJobs[0].id}`,
              type: "job",
              title: "New Job Opportunity",
              description: availableJobs[0].title || "New jobs matching your profile",
              actionText: "View Jobs",
              actionLink: "/app/jobs",
            });
          }
          
          const filtered = fallbackSuggestions.filter(s => !dismissedIds.includes(s.id));
          setSuggestions(filtered);
          return;
        }
        
        if (result.response) {
          try {
            let jsonStr = result.response.trim();
            const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              jsonStr = jsonMatch[0];
            }
            const parsed = JSON.parse(jsonStr) as Suggestion[];
            const filtered = parsed.filter(s => !dismissedIds.includes(s.id));
            setSuggestions(filtered.slice(0, 3));
          } catch (parseError) {
            console.error("Failed to parse AI suggestions:", parseError);
            setError("Could not process suggestions");
          }
        }
      } catch (err) {
        console.error("Error generating suggestions:", err);
        setError("Failed to generate suggestions");
      } finally {
        setIsGenerating(false);
      }
    };

    generateSuggestions();
  }, [isOpen, user, profile, events, savedEventIds, allJobs, savedJobs, appliedJobs, customerBookings]);

  const handleDismiss = (id: string) => {
    dismissSuggestion(id);
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const handleClose = () => {
    markShownThisSession();
    onClose();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "job":
        return <Briefcase className="h-5 w-5 text-blue-600" />;
      case "event":
        return <Calendar className="h-5 w-5 text-purple-600" />;
      case "booking":
        return <Clock className="h-5 w-5 text-orange-600" />;
      default:
        return <Sparkles className="h-5 w-5 text-primary" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "job":
        return "bg-blue-50 border-blue-200";
      case "event":
        return "bg-purple-50 border-purple-200";
      case "booking":
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-slate-50 border-slate-200";
    }
  };

  if (suggestions.length === 0 && !isGenerating && !error) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-ai-suggestions">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Suggestions for You
          </DialogTitle>
          <DialogDescription>
            Based on your activity, here are some personalized recommendations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-8" data-testid="loading-suggestions">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-slate-500">Generating personalized suggestions...</p>
            </div>
          ) : error && suggestions.length === 0 ? (
            <div className="text-center py-6" data-testid="error-suggestions">
              <p className="text-sm text-slate-500">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={handleClose}>
                Close
              </Button>
            </div>
          ) : (
            suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`relative p-4 rounded-lg border-2 ${getTypeColor(suggestion.type)}`}
                data-testid={`suggestion-${suggestion.id}`}
              >
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/50 transition-colors"
                  data-testid={`button-dismiss-${suggestion.id}`}
                  aria-label="Dismiss suggestion"
                >
                  <X className="h-4 w-4 text-slate-400" />
                </button>

                <div className="flex items-start gap-3 pr-6">
                  <div className="flex-shrink-0 mt-0.5">{getIcon(suggestion.type)}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm mb-1">{suggestion.title}</h4>
                    <p className="text-xs text-slate-600 mb-3">{suggestion.description}</p>
                    <Link href={suggestion.actionLink}>
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={handleClose}
                        data-testid={`button-action-${suggestion.id}`}
                      >
                        {suggestion.actionText}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={handleClose} data-testid="button-close-suggestions">
              Maybe Later
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { hasShownThisSession, markShownThisSession };
