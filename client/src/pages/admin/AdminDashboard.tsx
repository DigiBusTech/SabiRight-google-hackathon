import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, Users, CreditCard, MapPin, Calendar, Briefcase, Store, 
  Shield, Key, CheckCircle2, XCircle, Eye, EyeOff, Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";

const getAdminHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState(false);

  // Fetch admin data with auth headers
  const { data: settings = [] } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/settings', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/users', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: vendorApps = [] } = useQuery({
    queryKey: ['admin-vendor-apps'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/vendor-applications', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const res = await fetch('/api/payments');
      return res.ok ? res.json() : [];
    }
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
      return res.ok ? res.json() : [];
    }
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/plans', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const saveSetting = useMutation({
    mutationFn: async ({ key, value, category, isSecret }: { key: string; value: string; category: string; isSecret?: boolean }) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ key, value, category, isSecret })
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      toast({ title: "Saved", description: "Setting updated successfully" });
    }
  });

  const approveVendor = useMutation({
    mutationFn: async (userId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/vendor/${userId}/approve`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendor-apps'] });
      toast({ title: "Approved", description: "Vendor application approved" });
    }
  });

  const rejectVendor = useMutation({
    mutationFn: async (userId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/vendor/${userId}/reject`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendor-apps'] });
      toast({ title: "Rejected", description: "Vendor application rejected" });
    }
  });

  const approveKYC = useMutation({
    mutationFn: async (userId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/kyc/${userId}/approve`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: "Approved", description: "KYC verification approved" });
    }
  });

  const rejectKYC = useMutation({
    mutationFn: async (userId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/kyc/${userId}/reject`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: "Rejected", description: "KYC verification rejected" });
    }
  });

  const updateCredits = useMutation({
    mutationFn: async ({ userId, totalCredits }: { userId: string; totalCredits: number }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/users/${userId}/credits`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ totalCredits })
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: "Updated", description: "User credits updated" });
    }
  });

  const assignPlan = useMutation({
    mutationFn: async ({ userId, planId }: { userId: string; planId: string }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId })
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: "Assigned", description: "Plan assigned to user" });
    }
  });

  const toggleAdmin = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/users/${userId}/toggle-admin`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ isAdmin })
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: "Updated", description: "User admin status updated" });
    }
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: "Deleted", description: "User deleted successfully" });
    }
  });

  const createPlan = useMutation({
    mutationFn: async (plan: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers,
        body: JSON.stringify(plan)
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast({ title: "Created", description: "Plan created successfully" });
      setNewPlan({ name: '', type: 'basic', userType: 'user', price: 0, credits: 10, description: '' });
    }
  });

  const updatePlan = useMutation({
    mutationFn: async ({ planId, updates }: { planId: string; updates: any }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast({ title: "Updated", description: "Plan updated successfully" });
      setEditingPlan(null);
    }
  });

  const deletePlan = useMutation({
    mutationFn: async (planId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast({ title: "Deleted", description: "Plan deleted successfully" });
    }
  });

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [newPlan, setNewPlan] = useState({ name: '', type: 'basic', userType: 'user', price: 0, credits: 10, description: '' });
  const [editingPlan, setEditingPlan] = useState<any>(null);

  const getSetting = (key: string) => settings.find((s: any) => s.key === key)?.value || '';

  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});

  const handleSettingChange = (key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSetting = (key: string, category: string, isSecret: boolean = false) => {
    const value = localSettings[key] ?? getSetting(key);
    saveSetting.mutate({ key, value, category, isSecret });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-sm md:text-base text-slate-500">Manage your platform settings and users</p>
          </div>
          <Badge className="bg-red-600 text-white w-fit">Admin Access</Badge>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-blue-700">{users.length}</p>
                  <p className="text-[10px] md:text-xs text-blue-600/70">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Store className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-green-700">{vendorApps.filter((a: any) => a.status === 'approved').length}</p>
                  <p className="text-[10px] md:text-xs text-green-600/70">Active Vendors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-purple-700">{events.length}</p>
                  <p className="text-[10px] md:text-xs text-purple-600/70">Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-amber-700">{payments.length}</p>
                  <p className="text-[10px] md:text-xs text-amber-600/70">Transactions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="settings" className="space-y-4">
          <div className="overflow-x-auto -mx-3 px-3 pb-1">
            <TabsList className="bg-white border inline-flex w-auto min-w-full md:w-full">
              <TabsTrigger value="settings" className="text-xs md:text-sm whitespace-nowrap"><Settings className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Settings</span><span className="sm:hidden">Set</span></TabsTrigger>
              <TabsTrigger value="api-keys" className="text-xs md:text-sm whitespace-nowrap"><Key className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">API Keys</span><span className="sm:hidden">API</span></TabsTrigger>
              <TabsTrigger value="plans" className="text-xs md:text-sm whitespace-nowrap"><CreditCard className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /> Plans</TabsTrigger>
              <TabsTrigger value="payments" className="text-xs md:text-sm whitespace-nowrap"><CreditCard className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Payments</span><span className="sm:hidden">Pay</span></TabsTrigger>
              <TabsTrigger value="users" className="text-xs md:text-sm whitespace-nowrap"><Users className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /> Users</TabsTrigger>
              <TabsTrigger value="vendors" className="text-xs md:text-sm whitespace-nowrap"><Store className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Vendors</span><span className="sm:hidden">Vend</span></TabsTrigger>
            </TabsList>
          </div>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="font-bold mb-2">Payment Mode</p>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => saveSetting.mutate({ key: 'payment_mode', value: 'automatic', category: 'payments' })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          getSetting('payment_mode') === 'automatic' 
                            ? 'bg-primary text-white' 
                            : 'bg-white border'
                        }`}
                      >
                        Automatic
                      </button>
                      <button
                        onClick={() => saveSetting.mutate({ key: 'payment_mode', value: 'manual', category: 'payments' })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          getSetting('payment_mode') === 'manual' 
                            ? 'bg-primary text-white' 
                            : 'bg-white border'
                        }`}
                      >
                        Manual
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {getSetting('payment_mode') === 'automatic' 
                        ? 'Payments are processed automatically via payment gateways'
                        : 'Admin manually confirms payments after verification'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>API Keys & Integrations</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowSecrets(!showSecrets)}
                  >
                    {showSecrets ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {showSecrets ? 'Hide' : 'Show'} Secrets
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Google Maps */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-5 w-5 text-red-500" />
                    <p className="font-bold">Google Maps API</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={localSettings['google_maps_api_key'] ?? getSetting('google_maps_api_key')}
                      onChange={(e) => handleSettingChange('google_maps_api_key', e.target.value)}
                      placeholder="Enter Google Maps API Key"
                      className="flex-1"
                    />
                    <Button onClick={() => handleSaveSetting('google_maps_api_key', 'api_keys', true)}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Stripe */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-purple-500" />
                      <p className="font-bold">Stripe</p>
                    </div>
                    <Switch 
                      checked={getSetting('stripe_enabled') === 'true'}
                      onCheckedChange={(checked) => saveSetting.mutate({ 
                        key: 'stripe_enabled', value: checked ? 'true' : 'false', category: 'payments' 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={localSettings['stripe_public_key'] ?? getSetting('stripe_public_key')}
                      onChange={(e) => handleSettingChange('stripe_public_key', e.target.value)}
                      placeholder="Stripe Publishable Key"
                    />
                    <div className="flex gap-2">
                      <Input
                        type={showSecrets ? "text" : "password"}
                        value={localSettings['stripe_secret_key'] ?? getSetting('stripe_secret_key')}
                        onChange={(e) => handleSettingChange('stripe_secret_key', e.target.value)}
                        placeholder="Stripe Secret Key"
                        className="flex-1"
                      />
                      <Button onClick={() => {
                        handleSaveSetting('stripe_public_key', 'api_keys', true);
                        handleSaveSetting('stripe_secret_key', 'api_keys', true);
                      }}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Paystack */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-blue-500" />
                      <p className="font-bold">Paystack</p>
                    </div>
                    <Switch 
                      checked={getSetting('paystack_enabled') === 'true'}
                      onCheckedChange={(checked) => saveSetting.mutate({ 
                        key: 'paystack_enabled', value: checked ? 'true' : 'false', category: 'payments' 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={localSettings['paystack_public_key'] ?? getSetting('paystack_public_key')}
                      onChange={(e) => handleSettingChange('paystack_public_key', e.target.value)}
                      placeholder="Paystack Public Key"
                    />
                    <div className="flex gap-2">
                      <Input
                        type={showSecrets ? "text" : "password"}
                        value={localSettings['paystack_secret_key'] ?? getSetting('paystack_secret_key')}
                        onChange={(e) => handleSettingChange('paystack_secret_key', e.target.value)}
                        placeholder="Paystack Secret Key"
                        className="flex-1"
                      />
                      <Button onClick={() => {
                        handleSaveSetting('paystack_public_key', 'api_keys', true);
                        handleSaveSetting('paystack_secret_key', 'api_keys', true);
                      }}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Flutterwave */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-orange-500" />
                      <p className="font-bold">Flutterwave</p>
                    </div>
                    <Switch 
                      checked={getSetting('flutterwave_enabled') === 'true'}
                      onCheckedChange={(checked) => saveSetting.mutate({ 
                        key: 'flutterwave_enabled', value: checked ? 'true' : 'false', category: 'payments' 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={localSettings['flutterwave_public_key'] ?? getSetting('flutterwave_public_key')}
                      onChange={(e) => handleSettingChange('flutterwave_public_key', e.target.value)}
                      placeholder="Flutterwave Public Key"
                    />
                    <div className="flex gap-2">
                      <Input
                        type={showSecrets ? "text" : "password"}
                        value={localSettings['flutterwave_secret_key'] ?? getSetting('flutterwave_secret_key')}
                        onChange={(e) => handleSettingChange('flutterwave_secret_key', e.target.value)}
                        placeholder="Flutterwave Secret Key"
                        className="flex-1"
                      />
                      <Button onClick={() => {
                        handleSaveSetting('flutterwave_public_key', 'api_keys', true);
                        handleSaveSetting('flutterwave_secret_key', 'api_keys', true);
                      }}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* AI Configuration Section */}
                <div className="border-t pt-6 mt-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-indigo-500" />
                    AI Configuration
                  </h3>
                  
                  {/* Primary AI Selection */}
                  <div className="p-4 bg-indigo-50 rounded-lg mb-4">
                    <p className="font-bold mb-2">Primary AI Provider</p>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => saveSetting.mutate({ key: 'primary_ai', value: 'gemini', category: 'ai' })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          getSetting('primary_ai') === 'gemini' || !getSetting('primary_ai')
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-white border'
                        }`}
                      >
                        Google Gemini
                      </button>
                      <button
                        onClick={() => saveSetting.mutate({ key: 'primary_ai', value: 'chatgpt', category: 'ai' })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          getSetting('primary_ai') === 'chatgpt' 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-white border'
                        }`}
                      >
                        OpenAI ChatGPT
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Select which AI to use for Civic Guard, Jobs, and other AI features
                    </p>
                  </div>

                  {/* Gemini API Key */}
                  <div className="p-4 border rounded-lg mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-5 w-5 text-blue-500" />
                      <p className="font-bold">Google Gemini API (Civic Guard & Jobs)</p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type={showSecrets ? "text" : "password"}
                        value={localSettings['gemini_api_key'] ?? getSetting('gemini_api_key')}
                        onChange={(e) => handleSettingChange('gemini_api_key', e.target.value)}
                        placeholder="Enter Gemini API Key"
                        className="flex-1"
                      />
                      <Button onClick={() => handleSaveSetting('gemini_api_key', 'ai', true)}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* ChatGPT API Key */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase className="h-5 w-5 text-green-500" />
                      <p className="font-bold">OpenAI ChatGPT API</p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type={showSecrets ? "text" : "password"}
                        value={localSettings['chatgpt_api_key'] ?? getSetting('chatgpt_api_key')}
                        onChange={(e) => handleSettingChange('chatgpt_api_key', e.target.value)}
                        placeholder="Enter OpenAI API Key (sk-...)"
                        className="flex-1"
                      />
                      <Button onClick={() => handleSaveSetting('chatgpt_api_key', 'ai', true)}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans">
            <div className="space-y-6">
              {/* Create New Plan */}
              <Card>
                <CardHeader>
                  <CardTitle>Create New Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Input
                      placeholder="Plan Name"
                      value={newPlan.name}
                      onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                      className="col-span-2 md:col-span-1"
                    />
                    <select
                      className="h-10 px-3 border rounded-md text-sm"
                      value={newPlan.type}
                      onChange={(e) => setNewPlan({ ...newPlan, type: e.target.value })}
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                    <select
                      className="h-10 px-3 border rounded-md text-sm"
                      value={newPlan.userType}
                      onChange={(e) => setNewPlan({ ...newPlan, userType: e.target.value })}
                    >
                      <option value="user">User</option>
                      <option value="vendor">Vendor</option>
                    </select>
                    <Input
                      type="number"
                      placeholder="Price (NGN)"
                      value={newPlan.price}
                      onChange={(e) => setNewPlan({ ...newPlan, price: parseInt(e.target.value) || 0 })}
                    />
                    <Input
                      type="number"
                      placeholder="Credits"
                      value={newPlan.credits}
                      onChange={(e) => setNewPlan({ ...newPlan, credits: parseInt(e.target.value) || 10 })}
                    />
                    <Input
                      placeholder="Description"
                      value={newPlan.description}
                      onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                      className="col-span-2 md:col-span-1"
                    />
                  </div>
                  <Button 
                    className="mt-4" 
                    onClick={() => createPlan.mutate(newPlan)}
                    disabled={!newPlan.name}
                  >
                    Create Plan
                  </Button>
                </CardContent>
              </Card>

              {/* Existing Plans */}
              <Card>
                <CardHeader>
                  <CardTitle>Existing Plans ({plans.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {plans.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">No plans created yet</p>
                  ) : (
                    <div className="space-y-3">
                      {plans.map((plan: any) => (
                        <div key={plan.id} className="p-4 border rounded-lg">
                          {editingPlan?.id === plan.id ? (
                            <div className="space-y-3">
                              <div className="grid md:grid-cols-3 gap-3">
                                <Input
                                  value={editingPlan.name}
                                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                                />
                                <Input
                                  type="number"
                                  value={editingPlan.price}
                                  onChange={(e) => setEditingPlan({ ...editingPlan, price: parseInt(e.target.value) || 0 })}
                                />
                                <Input
                                  type="number"
                                  value={editingPlan.credits}
                                  onChange={(e) => setEditingPlan({ ...editingPlan, credits: parseInt(e.target.value) || 0 })}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => updatePlan.mutate({ 
                                  planId: plan.id, 
                                  updates: { 
                                    name: editingPlan.name,
                                    price: editingPlan.price,
                                    credits: editingPlan.credits,
                                    type: editingPlan.type,
                                    userType: editingPlan.userType,
                                    description: editingPlan.description
                                  }
                                })}>
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingPlan(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold">{plan.name}</p>
                                <p className="text-sm text-slate-500">
                                  {plan.type} - {plan.userType} | NGN {plan.price || 0} | {plan.credits || 0} credits
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setEditingPlan(plan)}>
                                  Edit
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => deletePlan.mutate(plan.id)}>
                                  Delete
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payment Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-center py-8 text-slate-400">No transactions yet</p>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment: any) => (
                      <div key={payment.id} className="p-3 md:p-4 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm">{payment.type}</p>
                          <p className="text-xs md:text-sm text-slate-500">{payment.description}</p>
                          <p className="text-[10px] md:text-xs text-slate-400">
                            {new Date(payment.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                          <p className="font-bold text-base md:text-lg">{payment.currency} {payment.amount}</p>
                          <Badge className={
                            payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                            payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }>
                            {payment.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <p className="text-center py-8 text-slate-400">No users registered yet</p>
                ) : (
                  <div className="space-y-3">
                    {users.map((user: any) => (
                      <div key={user.userId} className="p-3 md:p-4 border rounded-lg">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm md:text-base">{user.displayName || 'Unknown'}</p>
                            <p className="text-xs md:text-sm text-slate-500 truncate max-w-[200px] md:max-w-none">{user.email}</p>
                            <p className="text-[10px] md:text-xs text-slate-400 truncate max-w-[150px] md:max-w-none">ID: {user.userId}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-[10px] md:text-xs ${
                              user.kycStatus === 'verified' ? 'bg-green-100 text-green-800' : 
                              user.kycStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              KYC: {user.kycStatus || 'pending'}
                            </Badge>
                            {user.isVendor && (
                              <Badge className="bg-purple-100 text-purple-800 text-[10px] md:text-xs">Vendor</Badge>
                            )}
                            {user.isAdmin && (
                              <Badge className="bg-red-100 text-red-800 text-[10px] md:text-xs">Admin</Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* User Actions */}
                        <div className="mt-3 pt-3 border-t flex flex-wrap gap-2 items-center">
                          {/* KYC Actions */}
                          {user.kycStatus === 'pending' && (
                            <>
                              <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => approveKYC.mutate(user.userId)}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Verify KYC
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => rejectKYC.mutate(user.userId)}
                              >
                                <XCircle className="h-4 w-4 mr-1" /> Reject KYC
                              </Button>
                            </>
                          )}
                          
                          {/* Credits Management */}
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              placeholder="Credits"
                              className="w-24 h-8"
                              value={selectedUser === user.userId ? creditAmount : ''}
                              onChange={(e) => {
                                setSelectedUser(user.userId);
                                setCreditAmount(e.target.value);
                              }}
                            />
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                if (creditAmount) {
                                  updateCredits.mutate({ 
                                    userId: user.userId, 
                                    totalCredits: parseInt(creditAmount) 
                                  });
                                  setCreditAmount('');
                                  setSelectedUser(null);
                                }
                              }}
                            >
                              Set Credits
                            </Button>
                          </div>

                          {/* Plan Assignment */}
                          <select 
                            className="h-8 px-2 border rounded text-sm"
                            onChange={(e) => {
                              if (e.target.value) {
                                assignPlan.mutate({ userId: user.userId, planId: e.target.value });
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="">Assign Plan...</option>
                            <option value="free-user">Free</option>
                            <option value="basic-user">Basic</option>
                            <option value="pro-user">Pro</option>
                            <option value="free-vendor">Vendor Free</option>
                            <option value="pro-vendor">Vendor Pro</option>
                          </select>

                          {/* Toggle Admin */}
                          <Button
                            size="sm"
                            variant={user.isAdmin ? "destructive" : "outline"}
                            onClick={() => toggleAdmin.mutate({ userId: user.userId, isAdmin: !user.isAdmin })}
                          >
                            {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                          </Button>

                          {/* Delete User */}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this user?')) {
                                deleteUser.mutate(user.userId);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vendors Tab */}
          <TabsContent value="vendors">
            <Card>
              <CardHeader>
                <CardTitle>Vendor Applications</CardTitle>
              </CardHeader>
              <CardContent>
                {vendorApps.length === 0 ? (
                  <p className="text-center py-8 text-slate-400">No vendor applications yet</p>
                ) : (
                  <div className="space-y-3">
                    {vendorApps.map((app: any) => (
                      <div key={app.id} className="p-3 md:p-4 border rounded-lg">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm md:text-base">{app.businessName}</p>
                            <p className="text-xs md:text-sm text-slate-500">{app.serviceType}</p>
                            <p className="text-[10px] md:text-xs text-slate-400">
                              Applied: {new Date(app.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-[10px] md:text-xs ${
                              app.status === 'approved' ? 'bg-green-100 text-green-800' :
                              app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {app.status}
                            </Badge>
                            {app.status === 'pending' && (
                              <>
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700 h-7 md:h-8"
                                  onClick={() => approveVendor.mutate(app.userId)}
                                >
                                  <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  className="h-7 md:h-8"
                                  onClick={() => rejectVendor.mutate(app.userId)}
                                >
                                  <XCircle className="h-3 w-3 md:h-4 md:w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
