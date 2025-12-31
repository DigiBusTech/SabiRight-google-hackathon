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

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState(false);

  // Fetch admin data
  const { data: settings = [] } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings');
      return res.ok ? res.json() : [];
    }
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      return res.ok ? res.json() : [];
    }
  });

  const { data: vendorApps = [] } = useQuery({
    queryKey: ['admin-vendor-apps'],
    queryFn: async () => {
      const res = await fetch('/api/admin/vendor-applications');
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

  const saveSetting = useMutation({
    mutationFn: async ({ key, value, category, isSecret }: { key: string; value: string; category: string; isSecret?: boolean }) => {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(`/api/admin/vendor/${userId}/approve`, { method: 'POST' });
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
      const res = await fetch(`/api/admin/vendor/${userId}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendor-apps'] });
      toast({ title: "Rejected", description: "Vendor application rejected" });
    }
  });

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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-slate-500">Manage your platform settings and users</p>
          </div>
          <Badge className="bg-red-600 text-white">Admin Access</Badge>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{users.length}</p>
                  <p className="text-xs text-slate-500">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Store className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{vendorApps.filter((a: any) => a.status === 'approved').length}</p>
                  <p className="text-xs text-slate-500">Active Vendors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{events.length}</p>
                  <p className="text-xs text-slate-500">Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">{payments.length}</p>
                  <p className="text-xs text-slate-500">Transactions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" /> Settings</TabsTrigger>
            <TabsTrigger value="api-keys"><Key className="h-4 w-4 mr-2" /> API Keys</TabsTrigger>
            <TabsTrigger value="payments"><CreditCard className="h-4 w-4 mr-2" /> Payments</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" /> Users</TabsTrigger>
            <TabsTrigger value="vendors"><Store className="h-4 w-4 mr-2" /> Vendors</TabsTrigger>
          </TabsList>

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
              </CardContent>
            </Card>
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
                      <div key={payment.id} className="p-4 border rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-bold">{payment.type}</p>
                          <p className="text-sm text-slate-500">{payment.description}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(payment.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{payment.currency} {payment.amount}</p>
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
                      <div key={user.userId} className="p-4 border rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-bold">{user.displayName || 'Unknown'}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={user.kycStatus === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            KYC: {user.kycStatus || 'pending'}
                          </Badge>
                          {user.isVendor && (
                            <Badge className="bg-purple-100 text-purple-800">Vendor</Badge>
                          )}
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
                      <div key={app.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold">{app.businessName}</p>
                            <p className="text-sm text-slate-500">{app.serviceType}</p>
                            <p className="text-xs text-slate-400">
                              Applied: {new Date(app.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={
                              app.status === 'approved' ? 'bg-green-100 text-green-800' :
                              app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {app.status}
                            </Badge>
                            {app.status === 'pending' && (
                              <>
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => approveVendor.mutate(app.userId)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => rejectVendor.mutate(app.userId)}
                                >
                                  <XCircle className="h-4 w-4" />
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
