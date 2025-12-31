import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Store, FileCheck, TrendingUp, AlertCircle, Plus, X, MapPin, Phone, Edit2, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface VendorService {
  id: string;
  name: string;
  type: string;
  specialization: string;
  description: string;
  location: string;
  latitude: string;
  longitude: string;
  contactPhone: string;
  contactEmail: string;
  priceRange: string;
  rating: string;
  reviewCount: number;
  verified: boolean;
}

const SERVICE_TYPES = ["Lawyer", "Plumber", "Electrician", "Health Professional", "Mover", "Real Estate Agent", "Cleaner", "Other"];

export default function VendorDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isApplying, setIsApplying] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<VendorService | null>(null);
  const [businessForm, setBusinessForm] = useState({
    businessName: "",
    serviceType: "",
    businessDocument: "",
    taxId: ""
  });
  const [serviceForm, setServiceForm] = useState({
    name: "",
    type: "Lawyer",
    specialization: "",
    description: "",
    location: "",
    latitude: "",
    longitude: "",
    contactPhone: "",
    contactEmail: "",
    priceRange: ""
  });

  const { data: application, refetch } = useQuery({
    queryKey: [`vendor-app-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const res = await fetch(`/api/vendor/application/${user.uid}`);
      return res.ok ? res.json() : null;
    },
    enabled: !!user?.uid,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['my-services', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch('/api/services');
      if (!res.ok) return [];
      const allServices = await res.json();
      return allServices.filter((s: VendorService) => s.vendorId === user.uid);
    },
    enabled: !!user?.uid && application?.status === 'approved',
  });

  const createServiceMutation = useMutation({
    mutationFn: async (service: any) => {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...service, vendorId: user?.uid })
      });
      if (!res.ok) throw new Error('Failed to create service');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-services'] });
      setShowAddService(false);
      setServiceForm({
        name: "", type: "Lawyer", specialization: "", description: "",
        location: "", latitude: "", longitude: "", contactPhone: "", contactEmail: "", priceRange: ""
      });
      toast({ title: "Success", description: "Service listing created!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create service", variant: "destructive" });
    }
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, service }: { id: string; service: any }) => {
      const res = await fetch(`/api/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(service)
      });
      if (!res.ok) throw new Error('Failed to update service');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-services'] });
      setEditingService(null);
      setServiceForm({
        name: "", type: "Lawyer", specialization: "", description: "",
        location: "", latitude: "", longitude: "", contactPhone: "", contactEmail: "", priceRange: ""
      });
      toast({ title: "Success", description: "Service updated!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update service", variant: "destructive" });
    }
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete service');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-services'] });
      toast({ title: "Success", description: "Service deleted!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete service", variant: "destructive" });
    }
  });

  const handleEditService = (service: VendorService) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      type: service.type,
      specialization: service.specialization || "",
      description: service.description || "",
      location: service.location,
      latitude: service.latitude || "",
      longitude: service.longitude || "",
      contactPhone: service.contactPhone || "",
      contactEmail: service.contactEmail || "",
      priceRange: service.priceRange || ""
    });
    setShowAddService(true);
  };

  const handleApplyAsVendor = async () => {
    if (!user?.uid || !businessForm.businessName || !businessForm.serviceType) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    setIsApplying(true);
    try {
      const res = await fetch('/api/vendor/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          ...businessForm
        })
      });

      if (res.ok) {
        toast({ title: "Success", description: "Vendor application submitted for review" });
        setBusinessForm({ businessName: "", serviceType: "", businessDocument: "", taxId: "" });
        refetch();
      } else {
        throw new Error('Failed to apply');
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to submit application", variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  const handleCreateOrUpdateService = () => {
    if (!serviceForm.name || !serviceForm.type || !serviceForm.location) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const submitService = (formData: any) => {
      if (editingService) {
        updateServiceMutation.mutate({ id: editingService.id, service: formData });
      } else {
        createServiceMutation.mutate(formData);
      }
    };

    if (!serviceForm.latitude || !serviceForm.longitude) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            submitService({
              ...serviceForm,
              latitude: position.coords.latitude.toString(),
              longitude: position.coords.longitude.toString()
            });
          },
          () => {
            submitService({
              ...serviceForm,
              latitude: "6.5244",
              longitude: "3.3792"
            });
          }
        );
      } else {
        submitService(serviceForm);
      }
    } else {
      submitService(serviceForm);
    }
  };

  const handleCloseModal = () => {
    setShowAddService(false);
    setEditingService(null);
    setServiceForm({
      name: "", type: "Lawyer", specialization: "", description: "",
      location: "", latitude: "", longitude: "", contactPhone: "", contactEmail: "", priceRange: ""
    });
  };

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Vendor Dashboard</h2>
        <p className="text-slate-500 mt-1">Manage your business and services</p>
      </div>

      {/* Application Status */}
      {application ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Application Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold">{application.businessName}</span>
                <Badge className={`${
                  application.status === 'approved'
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : application.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                    : 'bg-red-100 text-red-800 border-red-300'
                }`}>
                  {(application.status || 'pending').toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-slate-600 mb-2">{application.serviceType}</p>
              <p className="text-xs text-slate-500">
                Submitted {new Date(application.createdAt).toLocaleDateString()}
              </p>
            </div>

            {application.status === 'pending' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-yellow-800">Pending Review</p>
                  <p className="text-xs text-yellow-700">Admin will review your KYC and business documents</p>
                </div>
              </div>
            )}

            {application.status === 'approved' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-green-800">Approved!</p>
                  <p className="text-xs text-green-700">You can now list services and access vendor tools</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-blue-100 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-5 w-5" />
              Apply as Vendor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">Business Name</label>
              <Input
                placeholder="Your business name"
                value={businessForm.businessName}
                onChange={(e) => setBusinessForm({...businessForm, businessName: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Service Type</label>
              <Input
                placeholder="e.g., Legal Services, Plumbing, Cleaning"
                value={businessForm.serviceType}
                onChange={(e) => setBusinessForm({...businessForm, serviceType: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Business Document</label>
              <Input
                placeholder="Business registration / License ID"
                value={businessForm.businessDocument}
                onChange={(e) => setBusinessForm({...businessForm, businessDocument: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Tax ID (Optional)</label>
              <Input
                placeholder="Tax identification number"
                value={businessForm.taxId}
                onChange={(e) => setBusinessForm({...businessForm, taxId: e.target.value})}
              />
            </div>

            <Button
              onClick={handleApplyAsVendor}
              disabled={isApplying}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isApplying ? 'Submitting...' : 'Submit Application'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Vendor Stats and Services */}
      {application?.status === 'approved' && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Your Vendor Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{services.length}</p>
                  <p className="text-xs text-slate-600">Active Listings</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-slate-600">Total Bookings</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">5.0</p>
                  <p className="text-xs text-slate-600">Rating</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Services */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">My Service Listings</CardTitle>
                <Button size="sm" onClick={() => setShowAddService(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Service
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No services yet. Add your first service listing!
                </div>
              ) : (
                <div className="space-y-3">
                  {services.map((service: VendorService) => (
                    <div key={service.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold">{service.name}</p>
                          <p className="text-sm text-slate-600">{service.type}</p>
                          <p className="text-xs text-slate-500">{service.specialization}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={service.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {service.verified ? 'Verified' : 'Pending'}
                          </Badge>
                          <button
                            onClick={() => handleEditService(service)}
                            className="p-1.5 hover:bg-slate-100 rounded"
                            data-testid={`btn-edit-service-${service.id}`}
                          >
                            <Edit2 className="h-4 w-4 text-slate-500" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this service?')) {
                                deleteServiceMutation.mutate(service.id);
                              }
                            }}
                            className="p-1.5 hover:bg-red-50 rounded"
                            data-testid={`btn-delete-service-${service.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {service.location}
                        </span>
                        {service.contactPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {service.contactPhone}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add/Edit Service Modal */}
          {showAddService && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-lg bg-white max-h-[90vh] overflow-y-auto">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">{editingService ? 'Edit Service' : 'Add Service Listing'}</h3>
                    <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold mb-1">Service Name *</label>
                      <Input
                        value={serviceForm.name}
                        onChange={(e) => setServiceForm({...serviceForm, name: e.target.value})}
                        placeholder="e.g., Barrister Adebayo Legal Services"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Service Type *</label>
                      <select
                        value={serviceForm.type}
                        onChange={(e) => setServiceForm({...serviceForm, type: e.target.value})}
                        className="w-full border rounded-lg p-2 text-sm"
                      >
                        {SERVICE_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Specialization</label>
                      <Input
                        value={serviceForm.specialization}
                        onChange={(e) => setServiceForm({...serviceForm, specialization: e.target.value})}
                        placeholder="e.g., Civil Rights & Family Law"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Description</label>
                      <Textarea
                        value={serviceForm.description}
                        onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                        placeholder="Describe your services..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Location *</label>
                      <Input
                        value={serviceForm.location}
                        onChange={(e) => setServiceForm({...serviceForm, location: e.target.value})}
                        placeholder="e.g., Victoria Island, Lagos"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold mb-1">Contact Phone</label>
                        <Input
                          value={serviceForm.contactPhone}
                          onChange={(e) => setServiceForm({...serviceForm, contactPhone: e.target.value})}
                          placeholder="+234 xxx xxx xxxx"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-1">Contact Email</label>
                        <Input
                          value={serviceForm.contactEmail}
                          onChange={(e) => setServiceForm({...serviceForm, contactEmail: e.target.value})}
                          placeholder="email@domain.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Price Range</label>
                      <select
                        value={serviceForm.priceRange}
                        onChange={(e) => setServiceForm({...serviceForm, priceRange: e.target.value})}
                        className="w-full border rounded-lg p-2 text-sm"
                      >
                        <option value="">Select price range</option>
                        <option value="$">Budget Friendly ($)</option>
                        <option value="$$">Moderate ($$)</option>
                        <option value="$$$">Premium ($$$)</option>
                        <option value="$$$$">Luxury ($$$$)</option>
                      </select>
                    </div>

                    <Button 
                      onClick={handleCreateOrUpdateService} 
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
                    >
                      {(createServiceMutation.isPending || updateServiceMutation.isPending) 
                        ? (editingService ? 'Updating...' : 'Creating...') 
                        : (editingService ? 'Update Service' : 'Create Service Listing')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
