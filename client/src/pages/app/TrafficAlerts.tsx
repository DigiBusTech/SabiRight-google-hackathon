import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, MapPin, RefreshCw, Plus, Trash2, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface CloakedRoute {
  id: string;
  routeName: string;
  startLocation: string;
  endLocation: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  lastStatus: 'active' | 'cleared' | 'unknown';
  lastChecked: string;
  isActive: boolean;
}

interface TrafficAlert {
  id: string;
  routeId: string;
  alertType: 'active_checkpoint' | 'cleared' | 'unknown';
  message: string;
  severity: 'high' | 'medium' | 'low';
  createdAt: string;
  acknowledgedAt?: string;
}

declare global {
  interface Window {
    google: any;
  }
}

export default function TrafficAlerts() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  
  const [routes, setRoutes] = useState<CloakedRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<CloakedRoute | null>(null);
  const [alerts, setAlerts] = useState<TrafficAlert[]>([]);
  const [recommendation, setRecommendation] = useState<string>("");
  const [cloakedStreets, setCloakedStreets] = useState<string[]>([]);
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({
    routeName: "",
    startLocation: "",
    endLocation: ""
  });

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  // Fetch routes
  const { data: fetchedRoutes, refetch: refetchRoutes } = useQuery({
    queryKey: [`routes-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/routes/${user.uid}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.uid,
  });

  // Fetch alerts for selected route
  const { data: fetchedAlerts, refetch: refetchAlerts } = useQuery({
    queryKey: [`alerts-${selectedRoute?.id}`],
    queryFn: async () => {
      if (!selectedRoute?.id) return [];
      const res = await fetch(`/api/alerts/${selectedRoute.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedRoute?.id,
  });

  useEffect(() => {
    if (fetchedRoutes) {
      setRoutes(fetchedRoutes);
      if (!selectedRoute && fetchedRoutes.length > 0) {
        setSelectedRoute(fetchedRoutes[0]);
      }
    }
  }, [fetchedRoutes]);

  useEffect(() => {
    if (fetchedAlerts) {
      setAlerts(fetchedAlerts);
    }
  }, [fetchedAlerts]);

  // Map and Markers refs to persist across renders
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Load Google Maps with API key from server
  useEffect(() => {
    const loadMapsAPI = async () => {
      // Don't load if already loading or loaded
      if (window.google) {
        initMap();
        return;
      }
      
      if (document.querySelector('script[src*="maps.googleapis"]')) {
        return;
      }

      try {
        const res = await fetch('/api/settings/google_maps_api_key');
        const data = res.ok ? await res.json() : { value: '' };
        const apiKey = data.value;
        
        if (apiKey) {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
          script.onload = () => {
            initMap();
            initAutocomplete();
          };
          script.onerror = () => {
            console.error("Failed to load Google Maps API script");
            toast({
              title: "Maps Error",
              description: "Failed to load Google Maps. Please check your internet connection and API key.",
              variant: "destructive"
            });
          };
        } else {
          console.warn("No Google Maps API key found in settings");
        }
      } catch (e) {
        console.error('Error fetching Google Maps API key:', e);
      }
    };
    loadMapsAPI();
  }, []); // Only load once on mount

  // Update map when selectedRoute changes
  useEffect(() => {
    if (window.google && mapInstanceRef.current) {
      updateMap();
    } else if (window.google && !mapInstanceRef.current) {
      initMap();
    }
  }, [selectedRoute]);

  // Initialize Autocomplete
  useEffect(() => {
    if (isAddingRoute && window.google) {
      initAutocomplete();
    }
  }, [isAddingRoute]);

  const initAutocomplete = () => {
    if (!window.google || !startInputRef.current || !endInputRef.current) return;

    const options = {
      componentRestrictions: { country: "ng" }, // Restrict to Nigeria
      fields: ["formatted_address", "geometry", "name"],
      strictBounds: false,
    };

    const startAutocomplete = new window.google.maps.places.Autocomplete(startInputRef.current, options);
    const endAutocomplete = new window.google.maps.places.Autocomplete(endInputRef.current, options);

    startAutocomplete.addListener("place_changed", () => {
      const place = startAutocomplete.getPlace();
      if (place.formatted_address) {
        setNewRoute(prev => ({ ...prev, startLocation: place.formatted_address }));
      }
    });

    endAutocomplete.addListener("place_changed", () => {
      const place = endAutocomplete.getPlace();
      if (place.formatted_address) {
        setNewRoute(prev => ({ ...prev, endLocation: place.formatted_address }));
      }
    });
  };

  const initMap = () => {
    if (!selectedRoute || !mapRef.current || !window.google || mapInstanceRef.current) return;

    try {
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 13,
        center: {
          lat: parseFloat(selectedRoute.startLat.toString()),
          lng: parseFloat(selectedRoute.startLng.toString())
        },
        styles: [
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#e9e9e9" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f5f5" }] }
        ]
      });

      const trafficLayer = new window.google.maps.TrafficLayer();
      trafficLayer.setMap(map);
      mapInstanceRef.current = map;
      
      updateMap();
    } catch (err) {
      console.error("Error initializing map:", err);
    }
  };

  const updateMap = () => {
    if (!selectedRoute || !mapInstanceRef.current || !window.google) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const startPos = {
      lat: parseFloat(selectedRoute.startLat.toString()),
      lng: parseFloat(selectedRoute.startLng.toString())
    };

    const endPos = {
      lat: parseFloat(selectedRoute.endLat.toString()),
      lng: parseFloat(selectedRoute.endLng.toString())
    };

    // Add start marker
    const startMarker = new window.google.maps.Marker({
      position: startPos,
      map,
      title: selectedRoute.startLocation,
      icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
    });
    markersRef.current.push(startMarker);

    // Add end marker
    const endMarker = new window.google.maps.Marker({
      position: endPos,
      map,
      title: selectedRoute.endLocation,
      icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
    });
    markersRef.current.push(endMarker);

    // Center map to show both points
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(startPos);
    bounds.extend(endPos);
    map.fitBounds(bounds);

    // Draw route line
    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      map,
      polylineOptions: {
        strokeColor: "#1e40af",
        strokeWeight: 5,
        strokeOpacity: 0.7
      },
      suppressMarkers: true
    });

    directionsService.route({
      origin: startPos,
      destination: endPos,
      travelMode: window.google.maps.TravelMode.DRIVING
    }, (result: any, status: any) => {
      if (status === window.google.maps.DirectionsStatus.OK) {
        directionsRenderer.setDirections(result);
      }
    });
  };

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !newRoute.routeName || !newRoute.startLocation || !newRoute.endLocation) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    if (!window.google) {
      toast({ 
        title: "Maps Not Ready", 
        description: "Google Maps is still loading. Please try again in a moment.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      // Geocode locations
      const geocoder = new window.google.maps.Geocoder();
      
      const startResult = await new Promise((resolve) => {
        geocoder.geocode({ address: newRoute.startLocation }, (results: any) => {
          resolve(results?.[0]?.geometry?.location);
        });
      }) as any;

      const endResult = await new Promise((resolve) => {
        geocoder.geocode({ address: newRoute.endLocation }, (results: any) => {
          resolve(results?.[0]?.geometry?.location);
        });
      }) as any;

      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          routeName: newRoute.routeName,
          startLocation: newRoute.startLocation,
          endLocation: newRoute.endLocation,
          startLat: startResult?.lat() || 6.5244,
          startLng: startResult?.lng() || 3.3792,
          endLat: endResult?.lat() || 6.5244,
          endLng: endResult?.lng() || 3.3792
        })
      });

      if (!res.ok) throw new Error('Failed to create route');

      toast({ title: "Success", description: "Route added successfully" });
      setNewRoute({ routeName: "", startLocation: "", endLocation: "" });
      setIsAddingRoute(false);
      refetchRoutes();
    } catch (err) {
      toast({ title: "Error", description: "Failed to add route", variant: "destructive" });
    }
  };

  const handleRefresh = async () => {
    if (!selectedRoute) return;

    try {
      const res = await fetch(`/api/routes/${selectedRoute.id}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.uid })
      });

      if (res.ok) {
        const data = await res.json();
        const newStatus = data.status;
        const alertMsg = data.message;
        const routeRec = data.recommendation;
        const cloaked = data.cloakedStreets || [];

        const updatedRoute = { ...selectedRoute, lastStatus: newStatus, lastChecked: new Date().toISOString() };
        setSelectedRoute(updatedRoute);
        setRecommendation(routeRec || "");
        setCloakedStreets(cloaked);
        setRoutes(routes.map(r => r.id === selectedRoute.id ? updatedRoute : r));

        refetchAlerts();
        toast({ 
          title: "Route Updated", 
          description: alertMsg
        });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to check route status", variant: "destructive" });
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    try {
      const res = await fetch(`/api/routes/${routeId}`, { method: 'DELETE' });
      if (res.ok) {
        setRoutes(routes.filter(r => r.id !== routeId));
        if (selectedRoute?.id === routeId) setSelectedRoute(null);
        toast({ title: "Success", description: "Route deleted" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete route", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Traffic Alerts</h2>
          <p className="text-slate-500 mt-1">Monitor cloaked routes and checkpoint status in real-time</p>
        </div>
        {user?.uid && (
          <div className="bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Monitoring City</p>
            <p className="text-sm font-bold text-slate-700">{(profile?.city || "Lagos").toUpperCase()}</p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Routes List */}
        <div className="md:col-span-1 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">Your Routes</h3>
            <Button 
              size="sm" 
              onClick={() => setIsAddingRoute(!isAddingRoute)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Route
            </Button>
          </div>

          {isAddingRoute && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <form onSubmit={handleAddRoute} className="space-y-3">
                  <Input 
                    placeholder="Route name (e.g., Home to Work)"
                    value={newRoute.routeName}
                    onChange={(e) => setNewRoute({...newRoute, routeName: e.target.value})}
                    className="h-9 text-sm"
                  />
                  <Input 
                    ref={startInputRef}
                    placeholder="Start location (street or business)"
                    value={newRoute.startLocation}
                    onChange={(e) => setNewRoute({...newRoute, startLocation: e.target.value})}
                    className="h-9 text-sm"
                  />
                  <Input 
                    ref={endInputRef}
                    placeholder="End location (street or business)"
                    value={newRoute.endLocation}
                    onChange={(e) => setNewRoute({...newRoute, endLocation: e.target.value})}
                    className="h-9 text-sm"
                  />
                  <Button type="submit" size="sm" className="w-full">Create Route</Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {routes.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">No routes added yet</p>
                <p className="text-xs text-slate-400 mt-1">Add your frequent routes to start monitoring traffic and checkpoints.</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => setIsAddingRoute(true)}
                >
                  Add Your First Route
                </Button>
              </div>
            ) : (
              routes.map(route => (
                <Card 
                  key={route.id}
                  className={`cursor-pointer transition-all ${
                    selectedRoute?.id === route.id 
                      ? 'ring-2 ring-primary shadow-md' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => {
                    setSelectedRoute(route);
                    setRecommendation(""); // Clear recommendation when switching routes
                    setCloakedStreets([]); // Clear cloaked streets when switching routes
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{route.routeName}</p>
                        <p className="text-xs text-slate-600 truncate">{route.startLocation}</p>
                        <p className="text-xs text-slate-600 truncate">→ {route.endLocation}</p>
                      </div>
                      <Badge className={`text-xs whitespace-nowrap ${
                        route.lastStatus === 'cleared' 
                          ? 'bg-green-100 text-green-800 border-green-300'
                          : route.lastStatus === 'active'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                      }`}>
                        {(route.lastStatus || 'UNKNOWN').toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(route.lastChecked).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Map and Details */}
        <div className="md:col-span-2 space-y-4">
          {routes.length === 0 ? (
            <Card className="h-full flex flex-col items-center justify-center p-12 bg-slate-50 border-2 border-dashed border-slate-200">
              <div className="bg-white p-6 rounded-full shadow-sm mb-6">
                <AlertCircle className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Monitor Your Commute</h3>
              <p className="text-slate-500 text-center max-w-md">
                Add routes like "Home to Office" or "School Run" to receive real-time updates on traffic, checkpoints, and cloaked streets.
              </p>
            </Card>
          ) : selectedRoute ? (
            <>
              {/* Map */}
              <Card className="overflow-hidden">
                <div 
                  ref={mapRef}
                  className="w-full h-80 bg-slate-100"
                />
              </Card>

              {/* Route Info and Controls */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedRoute.routeName}</CardTitle>
                      <p className="text-sm text-slate-600 mt-1">
                        {selectedRoute.startLocation} → {selectedRoute.endLocation}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRoute(selectedRoute.id);
                      }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs font-bold text-slate-600 uppercase mb-1">Status</p>
                      <p className="text-2xl font-bold">
                        <span className={
                          selectedRoute.lastStatus === 'cleared' ? 'text-green-600'
                          : selectedRoute.lastStatus === 'active' ? 'text-red-600'
                          : 'text-yellow-600'
                        }>
                          {(selectedRoute.lastStatus || 'UNKNOWN').toUpperCase()}
                        </span>
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs font-bold text-slate-600 uppercase mb-1">Last Checked</p>
                      <p className="text-sm font-semibold">
                        {new Date(selectedRoute.lastChecked).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  {(recommendation || (typeof cloakedStreets !== 'undefined' && cloakedStreets.length > 0)) && (
                    <div className="space-y-3">
                      {recommendation && (
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                          <p className="text-xs font-bold text-blue-800 uppercase mb-2 flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            Route Recommendation
                          </p>
                          <p className="text-sm text-blue-900 leading-relaxed font-medium">
                            {recommendation}
                          </p>
                        </div>
                      )}

                      {typeof cloakedStreets !== 'undefined' && cloakedStreets.length > 0 && (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                          <p className="text-xs font-bold text-amber-800 uppercase mb-2 flex items-center gap-2">
                            <AlertCircle className="h-3 w-3" />
                            Avoid Cloaked Streets
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {cloakedStreets.map((street, idx) => (
                              <Badge key={idx} variant="outline" className="bg-white border-amber-200 text-amber-700">
                                {street}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Button 
                    onClick={handleRefresh}
                    className="w-full bg-primary hover:bg-primary/90 gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Check Route Status
                  </Button>
                </CardContent>
              </Card>

              {/* Alerts */}
              {alerts.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Recent Alerts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {alerts.map(alert => (
                        <div 
                          key={alert.id}
                          className={`p-3 rounded-lg border ${
                            alert.severity === 'high'
                              ? 'bg-red-50 border-red-200'
                              : alert.severity === 'medium'
                              ? 'bg-yellow-50 border-yellow-200'
                              : 'bg-green-50 border-green-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <AlertCircle className={`h-5 w-5 flex-shrink-0 ${
                              alert.severity === 'high' ? 'text-red-600'
                              : alert.severity === 'medium' ? 'text-yellow-600'
                              : 'text-green-600'
                            }`} />
                            <div className="flex-1">
                              <p className="text-sm font-bold">
                                {alert.alertType === 'active_checkpoint' ? '🚨 Active Checkpoint'
                                : alert.alertType === 'cleared' ? '✅ Route Cleared'
                                : '⚠️ Status Unknown'}
                              </p>
                              <p className="text-xs text-slate-700 mt-1">{alert.message}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {new Date(alert.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="h-80 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-semibold">No route selected</p>
                <p className="text-sm text-slate-500">Create or select a route to view status</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
