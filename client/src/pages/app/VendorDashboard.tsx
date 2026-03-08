import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, FileCheck, TrendingUp, AlertCircle, Plus, X, MapPin, Phone, Edit2, Trash2, Users, Calendar, DollarSign, Mail, MessageSquare } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { EmailVerificationPopup } from "@/components/EmailVerificationPopup";

interface VendorService {
  id: string;
  vendorId: string;
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
  priceList: { item: string; price: string }[];
  rating: string;
  reviewCount: number;
  verified: boolean;
}

interface VendorStats {
  totalLeads: number;
  totalBookings: number;
  totalEarnings: number;
  thisMonthLeads: number;
  thisMonthBookings: number;
  thisMonthEarnings: number;
}

interface VendorLead {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  message: string;
  status: 'new' | 'contacted' | 'converted' | 'lost';
  createdAt: string;
}

interface VendorBooking {
  id: string;
  customerName: string;
  service: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  amount: number;
}

const SERVICE_TYPES = ["Lawyer", "Plumber", "Electrician", "Health Professional", "Mover", "Real Estate Agent", "Cleaner", "Other"];

export default function VendorDashboard() {
  const { user, profile, loading } = useAuth();
  
  const profileLoaded = !loading && profile !== null;
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
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);
  const [verificationAction, setVerificationAction] = useState("");
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
    priceRange: "",
    priceList: [] as { item: string; price: string }[]
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

  // Check if user is approved vendor
  const isApprovedVendor = profile?.isVendor === true;

  const { data: services = [] } = useQuery({
    queryKey: ['my-services', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch('/api/services');
      if (!res.ok) return [];
      const allServices = await res.json();
      return allServices.filter((s: VendorService) => s.vendorId === user.uid);
    },
    enabled: !!user?.uid && isApprovedVendor,
  });

  const { data: vendorStats } = useQuery<VendorStats>({
    queryKey: ['vendor-stats', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return null;
      const res = await fetch(`/api/vendor/${user.uid}/stats`);
      if (!res.ok) return { totalLeads: 0, totalBookings: 0, totalEarnings: 0, thisMonthLeads: 0, thisMonthBookings: 0, thisMonthEarnings: 0 };
      return res.json();
    },
    enabled: !!user?.uid && isApprovedVendor,
  });

  const { data: leads = [] } = useQuery<VendorLead[]>({
    queryKey: ['vendor-leads', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/vendor/${user.uid}/leads`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.uid && isApprovedVendor,
  });

  const { data: bookings = [] } = useQuery<VendorBooking[]>({
    queryKey: ['vendor-bookings', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/vendor/${user.uid}/bookings`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.uid && isApprovedVendor,
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
        location: "", latitude: "", longitude: "", contactPhone: "", contactEmail: "", priceRange: "",
        priceList: []
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
        location: "", latitude: "", longitude: "", contactPhone: "", contactEmail: "", priceRange: "",
        priceList: []
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
      priceRange: service.priceRange || "",
      priceList: service.priceList || []
    });
    setShowAddService(true);
  };

  const handleApplyAsVendor = async () => {
    if (!user?.uid || !businessForm.businessName || !businessForm.serviceType) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    if (profile?.emailVerificationStatus !== 'verified') {
      setVerificationAction("apply for a vendor account");
      setShowVerificationPopup(true);
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
      location: "", latitude: "", longitude: "", contactPhone: "", contactEmail: "", priceRange: "",
      priceList: []
    });
  };

  if (!profileLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Email Verification Popup */}
      <EmailVerificationPopup 
        isOpen={showVerificationPopup} 
        onClose={() => setShowVerificationPopup(false)} 
        actionName={verificationAction}
      />
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Vendor Dashboard</h2>
        <p className="text-slate-500 mt-1">Manage your business and services</p>
      </div>

      {/* Application Status - Check if approved vendor first */}
      {isApprovedVendor ? (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-600" />
              Vendor Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold">{application?.businessName || profile?.displayName || 'Your Business'}</span>
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  APPROVED
                </Badge>
              </div>
              <p className="text-sm text-slate-600 mb-2">{application?.serviceType || 'Verified Vendor'}</p>
            </div>
            <div className="p-3 bg-green-100 border border-green-200 rounded-lg flex items-start gap-3">
              <FileCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-green-800">Approved!</p>
                <p className="text-xs text-green-700">You can now list services and access vendor tools</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : application ? (
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
                  application.status === 'pending'
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
                  <p className="text-xs text-yellow-700">Admin will review your email verification and business documents</p>
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
      {isApprovedVendor && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Store className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{services.length}</p>
                    <p className="text-xs text-slate-600">Active Listings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{vendorStats?.totalLeads || 0}</p>
                    <p className="text-xs text-slate-600">Total Leads</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{vendorStats?.totalBookings || 0}</p>
                    <p className="text-xs text-slate-600">Total Bookings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">N{(vendorStats?.totalEarnings || 0).toLocaleString()}</p>
                    <p className="text-xs text-slate-600">Total Earnings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for Leads, Bookings, Services */}
          <Tabs defaultValue="services" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="services">Services ({services.length})</TabsTrigger>
              <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
              <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="leads" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                    Customer Inquiries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {leads.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      No leads yet. They will appear here when customers contact you.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leads.map((lead) => (
                        <div key={lead.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-bold">{lead.customerName}</p>
                              <p className="text-sm text-slate-600 flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {lead.customerEmail}
                              </p>
                              {lead.customerPhone && (
                                <p className="text-sm text-slate-600 flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {lead.customerPhone}
                                </p>
                              )}
                            </div>
                            <Badge className={`${
                              lead.status === 'new' ? 'bg-blue-100 text-blue-800' :
                              lead.status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                              lead.status === 'converted' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-700 mt-2 bg-slate-50 p-2 rounded">
                            {lead.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bookings" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    Your Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {bookings.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      No bookings yet. They will appear here when customers book your services.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bookings.map((booking) => (
                        <Link key={booking.id} href={`/bookings/${booking.id}`}>
                          <div className="p-4 border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-bold">{booking.customerName}</p>
                                <p className="text-sm text-slate-600">{booking.service}</p>
                                <p className="text-sm text-slate-500">
                                  {booking.date} at {booking.time}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge className={`${
                                  booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                  booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                </Badge>
                                <p className="text-lg font-bold text-green-600 mt-2">
                                  N{booking.amount.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="services" className="mt-4">

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
            </TabsContent>
          </Tabs>

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
                        <option value="₦">Budget Friendly (₦)</option>
                        <option value="₦₦">Moderate (₦₦)</option>
                        <option value="₦₦₦">Premium (₦₦₦)</option>
                        <option value="₦₦₦₦">Luxury (₦₦₦₦)</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-bold">Service Price List</label>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px]"
                          onClick={() => setServiceForm({
                            ...serviceForm, 
                            priceList: [...serviceForm.priceList, { item: "", price: "" }]
                          })}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Item
                        </Button>
                      </div>
                      
                      {serviceForm.priceList.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input 
                            placeholder="Service name (e.g. Consultation)" 
                            className="flex-1 text-xs"
                            value={item.item}
                            onChange={(e) => {
                              const newList = [...serviceForm.priceList];
                              newList[index].item = e.target.value;
                              setServiceForm({ ...serviceForm, priceList: newList });
                            }}
                          />
                          <Input 
                            placeholder="Price (e.g. 5000)" 
                            className="w-24 text-xs"
                            value={item.price}
                            onChange={(e) => {
                              const newList = [...serviceForm.priceList];
                              newList[index].price = e.target.value;
                              setServiceForm({ ...serviceForm, priceList: newList });
                            }}
                          />
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                            onClick={() => {
                              const newList = serviceForm.priceList.filter((_, i) => i !== index);
                              setServiceForm({ ...serviceForm, priceList: newList });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {serviceForm.priceList.length === 0 && (
                        <p className="text-[10px] text-slate-400 italic">No price items added yet. Click 'Add Item' to list specific service prices.</p>
                      )}
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
