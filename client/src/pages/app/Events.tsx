import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Users, Clock, Plus, X, Filter, Bookmark, BookmarkCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmailVerificationPopup } from "@/components/EmailVerificationPopup";

const NIGERIAN_CITIES = [
  "Lagos", "Abuja", "Port Harcourt", "Kano", "Ibadan", "Kaduna", 
  "Benin City", "Enugu", "Onitsha", "Jos", "Calabar", "Warri", 
  "Uyo", "Owerri", "Abeokuta"
];

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  city?: string;
  category: string;
  description: string;
  attendees: number;
  maxAttendees?: number;
  organizer: string;
  organizerId?: string;
  registeredBy?: string[];
  registrations?: string[];
}

export default function Events() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);
  const [verificationAction, setVerificationAction] = useState("");
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    city: profile?.city || "Lagos",
    category: "Workshop",
    maxAttendees: ""
  });

  const categories = ["Workshop", "Civic Training", "Legal Aid", "Community Meeting", "Seminar"];
  const userCity = profile?.city || "";

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', profile?.city],
    queryFn: async () => {
      const cityParam = profile?.city ? `?city=${encodeURIComponent(profile.city)}` : '';
      const res = await fetch(`/api/events${cityParam}`);
      return res.ok ? res.json() : [];
    }
  });

  const { data: savedEventIds = [] } = useQuery({
    queryKey: ['savedEvents', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/events/saved/${user.uid}`);
      return res.ok ? res.json() : [];
    },
    enabled: !!user?.uid
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      if (!user) throw new Error('Login required');
      if (profile?.emailVerificationStatus !== 'verified') throw new Error('Email verification required');

      const idToken = await user.getIdToken();
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(eventData)
      });
      if (!res.ok) throw new Error('Failed to create event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowCreateDialog(false);
      setNewEvent({ title: "", description: "", date: "", time: "", location: "", city: profile?.city || "Lagos", category: "Workshop", maxAttendees: "" });
      toast({ title: "Success", description: "Event created successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create event", variant: "destructive" });
    }
  });

  const registerMutation = useMutation({
    mutationFn: async ({ eventId, userId }: { eventId: string; userId: string }) => {
      if (!user) throw new Error('Login required');
      if (profile?.emailVerificationStatus !== 'verified') throw new Error('Email verification required');

      const idToken = await user.getIdToken();
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error('Failed to register for event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: "Registered!", description: "You're registered for this event" });
    }
  });

  const saveEventMutation = useMutation({
    mutationFn: async ({ eventId, userId }: { eventId: string; userId: string }) => {
      const res = await fetch(`/api/events/${eventId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error('Failed to save event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedEvents', user?.uid] });
      toast({ title: "Saved!", description: "Event saved to your list" });
    }
  });

  const unsaveEventMutation = useMutation({
    mutationFn: async ({ eventId, userId }: { eventId: string; userId: string }) => {
      const res = await fetch(`/api/events/${eventId}/save`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error('Failed to unsave event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedEvents', user?.uid] });
      toast({ title: "Removed", description: "Event removed from saved list" });
    }
  });

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Login Required", description: "You must be logged in to create an event." });
      return;
    }

    if (profile?.emailVerificationStatus !== 'verified') {
      setVerificationAction("host an event");
      setShowVerificationPopup(true);
      return;
    }

    if (!newEvent.title || !newEvent.date || !newEvent.time || !newEvent.location) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    createEventMutation.mutate({
      ...newEvent,
      city: newEvent.city,
      organizer: user.displayName || "Anonymous",
      organizerId: user.uid,
      maxAttendees: newEvent.maxAttendees ? parseInt(newEvent.maxAttendees) : undefined
    });
  };

  const handleRegister = (event: Event) => {
    if (!user) {
      toast({ title: "Login Required", description: "Please login to register for events." });
      return;
    }

    if (profile?.emailVerificationStatus !== 'verified') {
      setVerificationAction("register for an event");
      setShowVerificationPopup(true);
      return;
    }

    if (isUserRegistered(event)) {
      toast({ title: "Already Registered", description: "You are already registered for this event." });
      return;
    }

    registerMutation.mutate({ eventId: event.id, userId: user.uid });
  };

  const handleSaveEvent = (event: Event) => {
    if (!user) {
      toast({ title: "Login Required", description: "Please login to save events." });
      return;
    }

    saveEventMutation.mutate({ eventId: event.id, userId: user.uid });
  };

  const handleUnsaveEvent = (event: Event) => {
    if (!user) {
      toast({ title: "Login Required", description: "Please login to save events." });
      return;
    }
    unsaveEventMutation.mutate({ eventId: event.id, userId: user.uid });
  };

  const isUserRegistered = (event: Event) => {
    const userId = user?.uid || "";
    return event.registeredBy?.includes(userId) || event.registrations?.includes(userId);
  };

  const isEventSaved = (eventId: string) => savedEventIds.includes(eventId);

  const sortedAndFilteredEvents = useMemo(() => {
    let filtered = events;
    
    if (selectedCategory) {
      filtered = filtered.filter((e: Event) => e.category === selectedCategory);
    }
    
    if (selectedCity) {
      filtered = filtered.filter((e: Event) => 
        e.city?.toLowerCase() === selectedCity.toLowerCase() ||
        e.location?.toLowerCase().includes(selectedCity.toLowerCase())
      );
    }
    
    return filtered.sort((a: Event, b: Event) => {
      const aInUserCity = userCity && (
        a.city?.toLowerCase() === userCity.toLowerCase() ||
        a.location?.toLowerCase().includes(userCity.toLowerCase())
      );
      const bInUserCity = userCity && (
        b.city?.toLowerCase() === userCity.toLowerCase() ||
        b.location?.toLowerCase().includes(userCity.toLowerCase())
      );
      
      if (aInUserCity && !bInUserCity) return -1;
      if (!aInUserCity && bInUserCity) return 1;
      return 0;
    });
  }, [events, selectedCategory, selectedCity, userCity]);

  const registeredEvents = useMemo(() => {
    if (!user?.uid) return [];
    return events.filter((e: Event) => isUserRegistered(e));
  }, [events, user?.uid]);

  const savedEvents = useMemo(() => {
    return events.filter((e: Event) => savedEventIds.includes(e.id));
  }, [events, savedEventIds]);

  const renderEventCard = (event: Event) => (
    <Card key={event.id} data-testid={`card-event-${event.id}`} className="hover:border-primary/50 transition-all hover:shadow-md overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row gap-4 md:gap-6 items-start">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-gradient-to-br from-green-100 to-slate-100 flex flex-col items-center justify-center shrink-0 self-center sm:self-start">
            <p className="text-xl md:text-2xl font-bold text-green-700">{new Date(event.date).getDate()}</p>
            <p className="text-[10px] md:text-xs font-bold text-slate-600 uppercase">
              {new Date(event.date).toLocaleString('default', { month: 'short' })}
            </p>
          </div>

          <div className="flex-1 w-full">
            <div className="flex flex-col sm:flex-row items-start justify-between mb-2 gap-2">
              <div className="flex-1">
                <h3 className="text-base md:text-lg font-bold text-slate-900" data-testid={`text-event-title-${event.id}`}>{event.title}</h3>
                <p className="text-xs md:text-sm text-slate-600 mt-1">by <span className="font-semibold">{event.organizer}</span></p>
              </div>
              <Badge variant="outline" className="shrink-0 bg-green-50 text-green-700 border-green-200 text-[10px] md:text-xs">
                {event.category}
              </Badge>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 my-4 text-xs md:text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-400" />
                <span>{event.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-400" />
                <span className="truncate">{event.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-400" />
                <span>{event.attendees} attending</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-400" />
                <span>{new Date(event.date).toLocaleDateString()}</span>
              </div>
            </div>

            <p className="text-xs md:text-sm text-slate-700 mb-4 line-clamp-2">{event.description}</p>

            <div className="flex flex-wrap gap-2">
              <Button 
                data-testid={`button-register-${event.id}`}
                size="sm" 
                onClick={() => handleRegister(event)}
                variant={isUserRegistered(event) ? "secondary" : "default"}
                className={isUserRegistered(event) ? "bg-green-100 text-green-700 hover:bg-green-200 text-xs flex-1 sm:flex-none" : "bg-green-600 hover:bg-green-700 text-xs flex-1 sm:flex-none"}
              >
                <Users className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                {isUserRegistered(event) ? "Registered ✓" : "Register Now"}
              </Button>
              
              {isEventSaved(event.id) ? (
                <Button
                  data-testid={`button-unsave-${event.id}`}
                  size="sm"
                  variant="outline"
                  onClick={() => handleUnsaveEvent(event)}
                  className="border-amber-300 text-amber-600 hover:bg-amber-50 text-xs flex-1 sm:flex-none"
                  disabled={unsaveEventMutation.isPending}
                >
                  <BookmarkCheck className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                  Saved
                </Button>
              ) : (
                <Button
                  data-testid={`button-save-${event.id}`}
                  size="sm"
                  variant="outline"
                  onClick={() => handleSaveEvent(event)}
                  disabled={saveEventMutation.isPending}
                  className="text-xs flex-1 sm:flex-none"
                >
                  <Bookmark className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderEmptyState = (message: string) => (
    <div className="text-center py-10 text-slate-400">
      {message}
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Email Verification Popup */}
      <EmailVerificationPopup 
        isOpen={showVerificationPopup} 
        onClose={() => setShowVerificationPopup(false)} 
        actionName={verificationAction}
      />

      {!user && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 text-center">
            <h3 className="font-bold text-lg mb-2">Connect with Your Community</h3>
            <p className="text-slate-500 mb-4">You must be logged in to register for events, save them, or host your own.</p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => window.location.href = '/auth/login'}>Login / Sign Up</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Civic Events & Trainings</h2>
          <p className="text-slate-500">Learn your rights and build community connections.</p>
        </div>
        <Button data-testid="button-host-event" onClick={() => setShowCreateDialog(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Host Event
        </Button>
      </div>

      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg bg-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Create New Event</h3>
                <button data-testid="button-close-dialog" onClick={() => setShowCreateDialog(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Event Title *</label>
                  <Input
                    data-testid="input-event-title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                    placeholder="e.g., Know Your Rights Workshop"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1">Description</label>
                  <Textarea
                    data-testid="input-event-description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                    placeholder="Describe your event..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Date *</label>
                    <Input
                      data-testid="input-event-date"
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Time *</label>
                    <Input
                      data-testid="input-event-time"
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">City *</label>
                    <select
                      data-testid="select-event-city"
                      value={newEvent.city}
                      onChange={(e) => setNewEvent({...newEvent, city: e.target.value})}
                      className="w-full border rounded-lg p-2 text-sm"
                    >
                      {NIGERIAN_CITIES.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Venue *</label>
                    <Input
                      data-testid="input-event-location"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                      placeholder="e.g., Community Hall"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Category</label>
                    <select
                      data-testid="select-event-category"
                      value={newEvent.category}
                      onChange={(e) => setNewEvent({...newEvent, category: e.target.value})}
                      className="w-full border rounded-lg p-2 text-sm"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Max Attendees</label>
                    <Input
                      data-testid="input-event-max-attendees"
                      type="number"
                      value={newEvent.maxAttendees}
                      onChange={(e) => setNewEvent({...newEvent, maxAttendees: e.target.value})}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <Button 
                  data-testid="button-create-event"
                  onClick={handleCreateEvent} 
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={createEventMutation.isPending}
                >
                  {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger data-testid="tab-all-events" value="all">All Events</TabsTrigger>
          <TabsTrigger data-testid="tab-registered" value="registered">Registered</TabsTrigger>
          <TabsTrigger data-testid="tab-saved" value="saved">Saved</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-600 uppercase">Filter by City</span>
              </div>
              <select
                data-testid="filter-city-events"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium bg-white focus:ring-2 ring-primary/20 outline-none"
              >
                <option value="">All Cities</option>
                {NIGERIAN_CITIES.map(city => (
                  <option key={city} value={city}>
                    {city} {city === userCity && "(Your City)"}
                  </option>
                ))}
              </select>
              {userCity && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <MapPin className="h-3 w-3 mr-1" />
                  Your city: {userCity}
                </Badge>
              )}
            </div>
            
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-600 uppercase">Filter by Category</p>
              <div className="flex flex-wrap gap-2">
                <button
                  data-testid="filter-category-all"
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === null
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All Events
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    data-testid={`filter-category-${cat.toLowerCase().replace(/\s/g, '-')}`}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedCategory === cat
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {isLoading ? (
              <div className="text-center py-10 text-slate-400">Loading events...</div>
            ) : sortedAndFilteredEvents.length === 0 ? (
              renderEmptyState(`No events found${selectedCategory ? ` in "${selectedCategory}"` : ''}${selectedCity ? ` in ${selectedCity}` : ''}. Be the first to host one!`)
            ) : (
              sortedAndFilteredEvents.map((event: Event) => renderEventCard(event))
            )}
          </div>
        </TabsContent>

        <TabsContent value="registered" className="space-y-4">
          <div className="grid gap-4">
            {!user ? (
              renderEmptyState("Please login to see your registered events.")
            ) : registeredEvents.length === 0 ? (
              renderEmptyState("You haven't registered for any events yet. Browse all events to find something interesting!")
            ) : (
              registeredEvents.map((event: Event) => renderEventCard(event))
            )}
          </div>
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          <div className="grid gap-4">
            {!user ? (
              renderEmptyState("Please login to see your saved events.")
            ) : savedEvents.length === 0 ? (
              renderEmptyState("You haven't saved any events yet. Save events to easily find them later!")
            ) : (
              savedEvents.map((event: Event) => renderEventCard(event))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
