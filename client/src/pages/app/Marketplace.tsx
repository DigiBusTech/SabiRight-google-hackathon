import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Star, Filter, ArrowUpRight } from "lucide-react";
import { MOCK_DIRECTORY } from "@/lib/constants"; // Keep fallback for now
// In a real implementation, we would fetch from Firestore 'directory' collection
// However, the original code had MOCK_DIRECTORY in shared.js, so we keep that logic as base
// but we can augment it if needed. For now, matching the original logic means using the mock directory
// since there was no 'directory' collection fetch in the provided original code (only civic, jobs, forum).

export default function Marketplace() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Flatten directory for easier filtering
  const allServices = Object.entries(MOCK_DIRECTORY).flatMap(([city, items]) => 
    items.map((item: any) => ({ ...item, city }))
  );

  const filteredServices = allServices.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Service Marketplace</h2>
          <p className="text-slate-500">Find verified professionals near you.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search services..." 
              className="pl-9 bg-white" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((item, i) => (
            <Card key={i} className="group hover:shadow-lg transition-all duration-300 border-slate-200">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-xl text-slate-600 group-hover:bg-primary group-hover:text-white transition-colors">
                    {item.name[0]}
                  </div>
                  <Badge variant="secondary" className="font-bold">{item.type}</Badge>
                </div>
                
                <h3 className="font-bold text-lg mb-1">{item.name}</h3>
                <div className="flex items-center text-xs text-slate-500 mb-4 gap-1">
                  <MapPin className="h-3 w-3" /> {item.city}
                </div>
                
                <div className="flex items-center gap-1 mb-6">
                  {[1,2,3,4,5].map((star) => (
                    <Star key={star} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="text-xs font-bold ml-1 text-slate-700">5.0</span>
                  <span className="text-xs text-slate-400">(Verified)</span>
                </div>

                <div className="flex gap-3">
                   <Button className="flex-1 bg-slate-900 text-white hover:bg-slate-800">
                     {item.contact}
                   </Button>
                </div>
              </CardContent>
            </Card>
          ))
        }
      </div>
    </div>
  );
}
