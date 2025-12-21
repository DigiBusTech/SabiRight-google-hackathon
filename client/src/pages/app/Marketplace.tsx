import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Star, Filter, Clock, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

interface ServiceProvider {
  id: string;
  name: string;
  type: string;
  specialization: string;
  location: string;
  coordinates: { lat: number; lng: number };
  rating: number;
  verified: boolean;
  distanceKm: number;
  estimatedTimeMin: number;
  alternativeTimeMin?: number;
  reason?: string;
  contactPhone: string;
  contactEmail: string;
}

const MOCK_PROVIDERS: ServiceProvider[] = [
  {
    id: "1",
    name: "Barrister Adebayo",
    type: "Lawyer",
    specialization: "Civil Rights & Family Law",
    location: "VI, Lagos",
    coordinates: { lat: 6.4281, lng: 3.4344 },
    rating: 4.9,
    verified: true,
    distanceKm: 2.4,
    estimatedTimeMin: 15,
    alternativeTimeMin: 30,
    reason: "15 mins faster than alternative route via bridge traffic",
    contactPhone: "+234 701 234 5678",
    contactEmail: "adebayo@legalaid.ng"
  },
  {
    id: "2",
    name: "Barrister Obi",
    type: "Lawyer",
    specialization: "Corporate & Tax Law",
    location: "Ikoyi, Lagos",
    coordinates: { lat: 6.4513, lng: 3.4647 },
    rating: 4.8,
    verified: true,
    distanceKm: 1.8,
    estimatedTimeMin: 30,
    contactPhone: "+234 801 987 6543",
    contactEmail: "obi@legalpractice.ng"
  },
  {
    id: "3",
    name: "FixIt Pro Plumbing",
    type: "Plumber",
    specialization: "Residential & Commercial Plumbing",
    location: "Lekki, Lagos",
    coordinates: { lat: 6.4469, lng: 3.5753 },
    rating: 4.7,
    verified: true,
    distanceKm: 1.2,
    estimatedTimeMin: 12,
    contactPhone: "+234 909 876 5432",
    contactEmail: "info@fixitpro.ng"
  },
  {
    id: "4",
    name: "Dr. Chioma Healthcare",
    type: "Health Professional",
    specialization: "General Practice & Diagnostics",
    location: "Ikeja, Lagos",
    coordinates: { lat: 6.5833, lng: 3.3333 },
    rating: 4.9,
    verified: true,
    distanceKm: 0.8,
    estimatedTimeMin: 8,
    contactPhone: "+234 808 123 4567",
    contactEmail: "chioma@healthcareng.ng"
  },
  {
    id: "5",
    name: "SafeMove Logistics",
    type: "Moving & Relocation",
    specialization: "Residential Relocation",
    location: "Ajah, Lagos",
    coordinates: { lat: 6.5074, lng: 3.5963 },
    rating: 4.8,
    verified: true,
    distanceKm: 3.5,
    estimatedTimeMin: 25,
    contactPhone: "+234 702 345 6789",
    contactEmail: "service@safemove.ng"
  },
  {
    id: "6",
    name: "Agent Taiwo Properties",
    type: "Real Estate Agent",
    specialization: "Residential & Commercial Properties",
    location: "Yaba, Lagos",
    coordinates: { lat: 6.5007, lng: 3.3575 },
    rating: 4.7,
    verified: true,
    distanceKm: 2.1,
    estimatedTimeMin: 18,
    contactPhone: "+234 805 567 8901",
    contactEmail: "taiwo@propertyagent.ng"
  }
];

const CATEGORIES = ["All Services", "Lawyers", "Plumbers", "Health", "Movers", "Real Estate"];

export default function Marketplace() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Services");
  const [sortBy, setSortBy] = useState<"distance" | "time" | "rating">("time");
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);

  // Filter and sort providers
  const filteredProviders = MOCK_PROVIDERS.filter(provider => {
    const matchesSearch = 
      provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = 
      selectedCategory === "All Services" ||
      provider.type.toLowerCase().includes(selectedCategory.toLowerCase());
    
    return matchesSearch && matchesCategory;
  });

  const sortedProviders = [...filteredProviders].sort((a, b) => {
    if (sortBy === "distance") return a.distanceKm - b.distanceKm;
    if (sortBy === "time") return a.estimatedTimeMin - b.estimatedTimeMin;
    return b.rating - a.rating;
  });

  const handleContact = (provider: ServiceProvider) => {
    toast({
      title: "Contact Initiated",
      description: `Connecting you with ${provider.name}...`
    });
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Verified Service Marketplace</h2>
          <p className="text-slate-500">Find vetted professionals with smart proximity routing.</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by name, profession, or specialty..." 
              className="pl-10 bg-white" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
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

        {/* Sort Options */}
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy("time")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              sortBy === "time"
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
            }`}
          >
            <Clock className="h-4 w-4" /> Fastest Time
          </button>
          <button
            onClick={() => setSortBy("distance")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              sortBy === "distance"
                ? "bg-green-100 text-green-700 border border-green-300"
                : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
            }`}
          >
            <MapPin className="h-4 w-4" /> Closest Distance
          </button>
          <button
            onClick={() => setSortBy("rating")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              sortBy === "rating"
                ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
            }`}
          >
            <Star className="h-4 w-4" /> Top Rated
          </button>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {sortedProviders.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-400">
            No providers found matching your criteria.
          </div>
        ) : (
          sortedProviders.map((provider) => (
            <Card 
              key={provider.id} 
              className="group hover:shadow-lg transition-all duration-300 border-slate-200 cursor-pointer hover:border-primary/50"
              onClick={() => setSelectedProvider(provider)}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{provider.name}</h3>
                    <p className="text-sm text-slate-600 mb-2">{provider.type}</p>
                    <p className="text-xs text-slate-500">{provider.specialization}</p>
                  </div>
                  {provider.verified && (
                    <Badge className="bg-green-100 text-green-700 border-green-200">Verified</Badge>
                  )}
                </div>

                {/* Proximity Logic - This is the key feature */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-bold text-blue-900 uppercase">Estimated Arrival</p>
                      <p className="text-lg font-bold text-blue-700 mt-1">{provider.estimatedTimeMin} min</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-600">{provider.distanceKm} km</p>
                      <p className="text-xs text-slate-500 mt-1">from your location</p>
                    </div>
                  </div>
                  {provider.reason && (
                    <p className="text-xs text-blue-700 font-medium pt-2 border-t border-blue-200">
                      ✓ {provider.reason}
                    </p>
                  )}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${i < Math.floor(provider.rating) ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}`}
                    />
                  ))}
                  <span className="text-xs font-bold ml-1 text-slate-700">{provider.rating}</span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 text-xs text-slate-600 mb-4">
                  <MapPin className="h-3 w-3" /> {provider.location}
                </div>

                {/* Action */}
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContact(provider);
                  }}
                >
                  Request Service
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Provider Detail Modal */}
      {selectedProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{selectedProvider.name}</h2>
                      <p className="text-lg text-slate-600 mt-1">{selectedProvider.type}</p>
                    </div>
                    {selectedProvider.verified && (
                      <Badge className="bg-green-100 text-green-700">✓ Verified</Badge>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProvider(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                <p className="text-sm font-bold text-blue-900 uppercase mb-3">Smart Proximity Routing</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">Estimated Arrival:</span>
                    <span className="text-lg font-bold text-blue-700">{selectedProvider.estimatedTimeMin} minutes</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">Distance:</span>
                    <span className="text-lg font-bold text-slate-900">{selectedProvider.distanceKm} km</span>
                  </div>
                  {selectedProvider.reason && (
                    <div className="pt-3 border-t border-blue-200">
                      <p className="text-sm text-blue-700 font-medium">
                        <TrendingUp className="inline h-4 w-4 mr-2" />
                        {selectedProvider.reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-bold text-slate-600 uppercase mb-2">Rating</p>
                  <div className="flex items-center gap-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < Math.floor(selectedProvider.rating) ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}`}
                      />
                    ))}
                  </div>
                  <p className="text-lg font-bold mt-1">{selectedProvider.rating} / 5.0</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-bold text-slate-600 uppercase mb-2">Specialization</p>
                  <p className="text-sm font-semibold">{selectedProvider.specialization}</p>
                </div>
              </div>

              <div className="border-t pt-6 space-y-3">
                <p className="text-sm font-bold text-slate-600 uppercase">Contact Information</p>
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <a href={`tel:${selectedProvider.contactPhone}`} className="text-sm font-semibold text-primary hover:underline">
                    {selectedProvider.contactPhone}
                  </a>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <a href={`mailto:${selectedProvider.contactEmail}`} className="text-sm font-semibold text-primary hover:underline break-all">
                    {selectedProvider.contactEmail}
                  </a>
                </div>
              </div>

              <Button 
                size="lg" 
                className="w-full mt-6 bg-primary hover:bg-primary/90 text-white font-bold py-3"
                onClick={() => {
                  handleContact(selectedProvider);
                  setSelectedProvider(null);
                }}
              >
                Request Service from {selectedProvider.name}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
