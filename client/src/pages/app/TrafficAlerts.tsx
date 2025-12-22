import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, MapPin, RefreshCw, Plus, Trash2, Clock, MapPinCheckInside } from "lucide-react";
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
  const { user } = useAuth();
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<any>(null);
  
  const [routes, setRoutes] = useState<CloakedRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<CloakedRoute | null>(null);
  const [alerts, setAlerts] = useState<TrafficAlert[]>([]);
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({
    routeName: "",
    startLocation: "",
    endLocation: ""
  });

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

  // Load Google Maps
  useEffect(() => {
    if (!window.google && !document.querySelector('script[src*="maps.googleapis"]')) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBrtOCOwXp8UloT0nDqzQDpZpHgtrJUQBs`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      
      script.onload = () => {
        initMap();
      };
    } else if (window.google) {
      initMap();
    }
  }, [selectedRoute]);

  const initMap = () => {
    if (!selectedRoute || !mapRef.current) return;

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

    mapsRef.current = map;

    // Add start marker
    new window.google.maps.Marker({
      position: {
        lat: parseFloat(selectedRoute.startLat.toString()),
        lng: parseFloat(selectedRoute.startLng.toString())
      },
      map,
      title: selectedRoute.startLocation,
      icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
    });

    // Add end marker
    new window.google.maps.Marker({
      position: {
        lat: parseFloat(selectedRoute.endLat.toString()),
        lng: parseFloat(selectedRoute.endLng.toString())
      },
      map,
      title: selectedRoute.endLocation,
      icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
    });

    // Draw route line
    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      map,
      polylineOptions: {
        strokeColor: selectedRoute.lastStatus === 'cleared' ? '#22c55e' : '#ef4444',
        strokeWeight: 4
      }
    });

    directionsService.route({
      origin: {
        lat: parseFloat(selectedRoute.startLat.toString()),
        lng: parseFloat(selectedRoute.startLng.toString())
      },
      destination: {
        lat: parseFloat(selectedRoute.endLat.toString()),
        lng: parseFloat(selectedRoute.endLng.toString())
      },
      travelMode: window.google.maps.TravelMode.DRIVING
    }, (result: any, status: string) => {
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
      // Simulate checking route status via Google Maps API
      const geocoder = new window.google.maps.Geocoder();
      
      // Random status update for demo
      const statuses = ['cleared', 'active', 'unknown'] as const;
      const newStatus = statuses[Math.floor(Math.random() * statuses.length)];

      const res = await fetch(`/api/routes/${selectedRoute.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        const updatedRoute = { ...selectedRoute, lastStatus: newStatus, lastChecked: new Date().toISOString() };
        setSelectedRoute(updatedRoute);
        setRoutes(routes.map(r => r.id === selectedRoute.id ? updatedRoute : r));

        // Create alert
        const alertMsg = newStatus === 'cleared' 
          ? 'Route cleared - Safe to travel'
          : newStatus === 'active'
          ? 'Active checkpoint detected on route'
          : 'Route status unknown';

        await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeId: selectedRoute.id,
            userId: user?.uid,
            alertType: newStatus,
            message: alertMsg,
            severity: newStatus === 'cleared' ? 'low' : newStatus === 'active' ? 'high' : 'medium'
          })
        });

        refetchAlerts();
        toast({ 
          title: "Route Updated", 
          description: `Status: ${newStatus.toUpperCase()}`
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Traffic Alerts</h2>
        <p className="text-slate-500 mt-1">Monitor cloaked routes and checkpoint status in real-time</p>
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
                    placeholder="Start location"
                    value={newRoute.startLocation}
                    onChange={(e) => setNewRoute({...newRoute, startLocation: e.target.value})}
                    className="h-9 text-sm"
                  />
                  <Input 
                    placeholder="End location"
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
            {routes.map(route => (
              <Card 
                key={route.id}
                className={`cursor-pointer transition-all ${
                  selectedRoute?.id === route.id 
                    ? 'ring-2 ring-primary shadow-md' 
                    : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedRoute(route)}
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
                      {route.lastStatus.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(route.lastChecked).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Map and Details */}
        <div className="md:col-span-2 space-y-4">
          {selectedRoute ? (
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
                          {selectedRoute.lastStatus.toUpperCase()}
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
