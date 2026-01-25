import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, Users, CreditCard, MapPin, Calendar, Briefcase, Store, 
  Shield, Key, CheckCircle2, XCircle, Eye, EyeOff, Save, Bell, Mail, Trash2, Plus, Edit, Building2, Coins,
  BarChart3, Download, FileSpreadsheet, FileText, Flag
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const { data: creditPackages = [] } = useQuery({
    queryKey: ['admin-credit-packages'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/credit-packages', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['admin-payment-methods'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/payment-methods', { headers });
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

  const toggleVendor = useMutation({
    mutationFn: async ({ userId, vendorMode }: { userId: string; vendorMode: boolean }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/vendor/mode/${userId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ vendorMode })
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: "Updated", description: "User vendor status updated" });
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

  // Credit Package Mutations
  const createCreditPackage = useMutation({
    mutationFn: async (packageData: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/credit-packages', {
        method: 'POST',
        headers,
        body: JSON.stringify(packageData)
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-credit-packages'] });
      toast({ title: "Success", description: "Credit package created" });
      setShowNewPackageForm(false);
      setNewCreditPackage({ name: '', credits: 0, price: 0, bonus: 0, description: '', popular: false });
    }
  });

  const deleteCreditPackage = useMutation({
    mutationFn: async (packageId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/credit-packages/${packageId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-credit-packages'] });
      toast({ title: "Deleted", description: "Package deleted successfully" });
    }
  });

  // Payment Method Mutations
  const createPaymentMethod = useMutation({
    mutationFn: async (methodData: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/payment-methods', {
        method: 'POST',
        headers,
        body: JSON.stringify(methodData)
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      toast({ title: "Success", description: "Payment method created" });
      setShowNewPaymentMethodForm(false);
      setNewPaymentMethod({ name: '', type: 'manual', description: '', instructions: '', active: true, fields: [] });
    }
  });

  const deletePaymentMethod = useMutation({
    mutationFn: async (methodId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/payment-methods/${methodId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      toast({ title: "Deleted", description: "Payment method deleted successfully" });
    }
  });

  const togglePaymentMethod = useMutation({
    mutationFn: async ({ methodId, active }: { methodId: string; active: boolean }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/payment-methods/${methodId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ active })
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      toast({ title: "Updated", description: "Payment method status updated" });
    }
  });

  const approvePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/payments/${paymentId}/approve`, {
        method: 'POST',
        headers
      });
      if (!res.ok) throw new Error('Failed to approve payment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      toast({ title: "Approved", description: "Payment approved and credited" });
    }
  });

  const rejectPayment = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason?: string }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/payments/${paymentId}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Failed to reject payment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      toast({ title: "Rejected", description: "Payment rejected" });
    }
  });

  // Flagged Posts Query
  const { data: flaggedPosts = [] } = useQuery({
    queryKey: ['admin-flagged-posts'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/flagged-posts', { headers });
      return res.ok ? res.json() : [];
    }
  });

  // Flagged Posts Mutations
  const reinstatePost = useMutation({
    mutationFn: async (postId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/flagged-posts/${postId}/reinstate`, {
        method: 'POST',
        headers
      });
      if (!res.ok) throw new Error('Failed to reinstate');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-flagged-posts'] });
      toast({ title: "Reinstated", description: "Post has been reinstated and is now visible to users" });
    }
  });

  const deleteFlaggedPost = useMutation({
    mutationFn: async (postId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/flagged-posts/${postId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-flagged-posts'] });
      toast({ title: "Deleted", description: "Post has been permanently deleted" });
    }
  });

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [newPlan, setNewPlan] = useState({ name: '', type: 'basic', userType: 'user', price: 0, credits: 10, description: '' });
  const [editingPlan, setEditingPlan] = useState<any>(null);
  
  // Credit package states
  const [showNewPackageForm, setShowNewPackageForm] = useState(false);
  const [newCreditPackage, setNewCreditPackage] = useState({ 
    name: '', 
    credits: 0, 
    price: 0, 
    bonus: 0, 
    description: '', 
    popular: false 
  });
  const [editingPackage, setEditingPackage] = useState<any>(null);
  
  // Payment method states
  const [showNewPaymentMethodForm, setShowNewPaymentMethodForm] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState({
    name: '',
    type: 'manual',
    description: '',
    instructions: '',
    active: true,
    fields: [] as Array<{ name: string; type: 'text' | 'file'; required: boolean; placeholder: string }>
  });
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<any>(null);

  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'system',
    subject: '',
    bodyTemplate: '',
    channels: { email: true, push: false, in_app: true }
  });
  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: '587',
    username: '',
    password: '',
    fromEmail: '',
    fromName: '',
    encryption: 'tls'
  });

  const { data: notificationTemplates = [] } = useQuery({
    queryKey: ['admin-notification-templates'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/notifications/templates', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: smtpData } = useQuery({
    queryKey: ['admin-smtp-settings'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/notifications/smtp', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setSmtpSettings({
            host: data.host || '',
            port: data.port?.toString() || '587',
            username: data.username || '',
            password: data.password || '',
            fromEmail: data.fromEmail || '',
            fromName: data.fromName || '',
            encryption: data.encryption || 'tls'
          });
        }
        return data;
      }
      return null;
    }
  });

  const createTemplate = useMutation({
    mutationFn: async (template: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/notifications/templates', {
        method: 'POST',
        headers,
        body: JSON.stringify(template)
      });
      if (!res.ok) throw new Error('Failed to create template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notification-templates'] });
      toast({ title: "Created", description: "Notification template created successfully" });
      setNewTemplate({ name: '', type: 'system', subject: '', bodyTemplate: '', channels: { email: true, push: false, in_app: true } });
    }
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ templateId, updates }: { templateId: string; updates: any }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/notifications/templates/${templateId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notification-templates'] });
      toast({ title: "Updated", description: "Notification template updated successfully" });
      setEditingTemplate(null);
    }
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/notifications/templates/${templateId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed to delete template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notification-templates'] });
      toast({ title: "Deleted", description: "Notification template deleted successfully" });
    }
  });

  const saveSmtpSettings = useMutation({
    mutationFn: async (settings: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/notifications/smtp', {
        method: 'POST',
        headers,
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Failed to save SMTP settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-smtp-settings'] });
      toast({ title: "Saved", description: "SMTP settings saved successfully" });
    }
  });

  const testSmtpConnection = useMutation({
    mutationFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/notifications/smtp/test', {
        method: 'POST',
        headers,
        body: JSON.stringify(smtpSettings)
      });
      if (!res.ok) throw new Error('SMTP connection test failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "SMTP connection test successful" });
    },
    onError: () => {
      toast({ title: "Failed", description: "SMTP connection test failed", variant: "destructive" });
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
              <TabsTrigger value="credits" className="text-xs md:text-sm whitespace-nowrap"><Coins className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Credits</span><span className="sm:hidden">Cred</span></TabsTrigger>
              <TabsTrigger value="payment-methods" className="text-xs md:text-sm whitespace-nowrap"><Building2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Payment Methods</span><span className="sm:hidden">Pay</span></TabsTrigger>
              <TabsTrigger value="payments" className="text-xs md:text-sm whitespace-nowrap"><CreditCard className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Transactions</span><span className="sm:hidden">Trans</span></TabsTrigger>
              <TabsTrigger value="users" className="text-xs md:text-sm whitespace-nowrap"><Users className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /> Users</TabsTrigger>
              <TabsTrigger value="vendors" className="text-xs md:text-sm whitespace-nowrap"><Store className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Vendors</span><span className="sm:hidden">Vend</span></TabsTrigger>
              <TabsTrigger value="notifications" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-notifications"><Bell className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Notifications</span><span className="sm:hidden">Notif</span></TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs md:text-sm whitespace-nowrap"><BarChart3 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Analytics</span><span className="sm:hidden">Stats</span></TabsTrigger>
              <TabsTrigger value="flagged-posts" className="text-xs md:text-sm whitespace-nowrap"><Flag className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Flagged Posts</span><span className="sm:hidden">Flags</span></TabsTrigger>
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

                  {/* Bank Transfer Details */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-5 w-5 text-green-600" />
                      <p className="font-bold">Bank Transfer Details</p>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">Configure bank account details for manual payments</p>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="bank_name" className="text-xs">Bank Name</Label>
                        <Input
                          id="bank_name"
                          value={localSettings['bank_name'] ?? getSetting('bank_name')}
                          onChange={(e) => handleSettingChange('bank_name', e.target.value)}
                          placeholder="e.g., GTBank"
                        />
                      </div>
                      <div>
                        <Label htmlFor="account_number" className="text-xs">Account Number</Label>
                        <Input
                          id="account_number"
                          value={localSettings['account_number'] ?? getSetting('account_number')}
                          onChange={(e) => handleSettingChange('account_number', e.target.value)}
                          placeholder="e.g., 0123456789"
                        />
                      </div>
                      <div>
                        <Label htmlFor="account_name" className="text-xs">Account Name</Label>
                        <Input
                          id="account_name"
                          value={localSettings['account_name'] ?? getSetting('account_name')}
                          onChange={(e) => handleSettingChange('account_name', e.target.value)}
                          placeholder="e.g., SabiRight Technologies"
                        />
                      </div>
                      <Button 
                        onClick={() => {
                          handleSaveSetting('bank_name', 'bank_details', false);
                          handleSaveSetting('account_number', 'bank_details', false);
                          handleSaveSetting('account_name', 'bank_details', false);
                        }}
                        className="w-full"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Bank Details
                      </Button>
                    </div>
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

                {/* Note: Payment gateway configuration moved to Payment Methods tab */}
                <div className="p-4 border rounded-lg bg-blue-50">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                    <p className="font-bold">Payment Gateway Configuration</p>
                  </div>
                  <p className="text-sm text-slate-600">
                    Payment gateway configuration (Flutterwave, Paystack, Stripe) has been moved to the <strong>Payment Methods</strong> tab for better organization.
                  </p>
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

          {/* Credits Management Tab */}
          <TabsContent value="credits">
            <div className="space-y-6">
              {/* Credit Packages */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Credit Packages</CardTitle>
                    <Button onClick={() => setShowNewPackageForm(!showNewPackageForm)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Package
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showNewPackageForm && (
                    <div className="p-4 border rounded-lg mb-4 bg-slate-50">
                      <p className="font-bold mb-3">Create Credit Package</p>
                      <div className="grid md:grid-cols-2 gap-3">
                        <Input
                          placeholder="Package Name (e.g., Starter Pack)"
                          value={newCreditPackage.name}
                          onChange={(e) => setNewCreditPackage({ ...newCreditPackage, name: e.target.value })}
                        />
                        <Input
                          type="number"
                          placeholder="Credits"
                          value={newCreditPackage.credits}
                          onChange={(e) => setNewCreditPackage({ ...newCreditPackage, credits: parseInt(e.target.value) || 0 })}
                        />
                        <Input
                          type="number"
                          placeholder="Price (NGN)"
                          value={newCreditPackage.price}
                          onChange={(e) => setNewCreditPackage({ ...newCreditPackage, price: parseInt(e.target.value) || 0 })}
                        />
                        <Input
                          type="number"
                          placeholder="Bonus Credits (optional)"
                          value={newCreditPackage.bonus}
                          onChange={(e) => setNewCreditPackage({ ...newCreditPackage, bonus: parseInt(e.target.value) || 0 })}
                        />
                        <Input
                          placeholder="Description"
                          value={newCreditPackage.description}
                          onChange={(e) => setNewCreditPackage({ ...newCreditPackage, description: e.target.value })}
                          className="md:col-span-2"
                        />
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={newCreditPackage.popular}
                            onCheckedChange={(checked) => setNewCreditPackage({ ...newCreditPackage, popular: checked as boolean })}
                          />
                          <Label>Mark as Popular</Label>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button onClick={() => createCreditPackage.mutate(newCreditPackage)}>
                          Create Package
                        </Button>
                        <Button variant="outline" onClick={() => setShowNewPackageForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {creditPackages.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">No credit packages yet</p>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {creditPackages.map((pkg: any) => (
                        <div key={pkg.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-bold">{pkg.name}</p>
                              {pkg.popular && <Badge className="bg-amber-500 text-white text-xs">Popular</Badge>}
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => setEditingPackage(pkg)}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteCreditPackage.mutate(pkg.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600">{pkg.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{pkg.credits} Credits</Badge>
                            {pkg.bonus > 0 && <Badge className="bg-green-100 text-green-700">+{pkg.bonus} Bonus</Badge>}
                            <Badge className="bg-blue-100 text-blue-700">NGN {pkg.price}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Credit Costs per Feature */}
              <Card>
                <CardHeader>
                  <CardTitle>Credit Costs per Feature</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <Label>AI Legal Query (SabiDoctor)</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_cost_ai_query'] ?? getSetting('credit_cost_ai_query') ?? '1'}
                          onChange={(e) => handleSettingChange('credit_cost_ai_query', e.target.value)}
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <Label>Job Application</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_cost_job_application'] ?? getSetting('credit_cost_job_application') ?? '2'}
                          onChange={(e) => handleSettingChange('credit_cost_job_application', e.target.value)}
                          placeholder="2"
                        />
                      </div>
                      <div>
                        <Label>Marketplace Featured Listing</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_cost_marketplace_feature'] ?? getSetting('credit_cost_marketplace_feature') ?? '5'}
                          onChange={(e) => handleSettingChange('credit_cost_marketplace_feature', e.target.value)}
                          placeholder="5"
                        />
                      </div>
                      <div>
                        <Label>Traffic Alert Post</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_cost_traffic_alert'] ?? getSetting('credit_cost_traffic_alert') ?? '1'}
                          onChange={(e) => handleSettingChange('credit_cost_traffic_alert', e.target.value)}
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <Label>Premium Forum Post</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_cost_premium_post'] ?? getSetting('credit_cost_premium_post') ?? '2'}
                          onChange={(e) => handleSettingChange('credit_cost_premium_post', e.target.value)}
                          placeholder="2"
                        />
                      </div>
                      <div>
                        <Label>Event Creation</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_cost_event_creation'] ?? getSetting('credit_cost_event_creation') ?? '3'}
                          onChange={(e) => handleSettingChange('credit_cost_event_creation', e.target.value)}
                          placeholder="3"
                        />
                      </div>
                    </div>
                    <Button onClick={() => {
                      handleSaveSetting('credit_cost_ai_query', 'credit_costs', false);
                      handleSaveSetting('credit_cost_job_application', 'credit_costs', false);
                      handleSaveSetting('credit_cost_marketplace_feature', 'credit_costs', false);
                      handleSaveSetting('credit_cost_traffic_alert', 'credit_costs', false);
                      handleSaveSetting('credit_cost_premium_post', 'credit_costs', false);
                      handleSaveSetting('credit_cost_event_creation', 'credit_costs', false);
                    }}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Credit Costs
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Credit Rewards */}
              <Card>
                <CardHeader>
                  <CardTitle>Credit Rewards</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <Label>Post Like (to author)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={localSettings['credit_reward_post_like'] ?? getSetting('credit_reward_post_like') ?? '0.1'}
                          onChange={(e) => handleSettingChange('credit_reward_post_like', e.target.value)}
                          placeholder="0.1"
                        />
                      </div>
                      <div>
                        <Label>Post Comment (to author)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={localSettings['credit_reward_post_comment'] ?? getSetting('credit_reward_post_comment') ?? '0.5'}
                          onChange={(e) => handleSettingChange('credit_reward_post_comment', e.target.value)}
                          placeholder="0.5"
                        />
                      </div>
                      <div>
                        <Label>Referral Signup</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_reward_referral'] ?? getSetting('credit_reward_referral') ?? '10'}
                          onChange={(e) => handleSettingChange('credit_reward_referral', e.target.value)}
                          placeholder="10"
                        />
                      </div>
                      <div>
                        <Label>Daily Login Bonus</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_reward_daily_login'] ?? getSetting('credit_reward_daily_login') ?? '1'}
                          onChange={(e) => handleSettingChange('credit_reward_daily_login', e.target.value)}
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <Label>Complete Profile</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_reward_complete_profile'] ?? getSetting('credit_reward_complete_profile') ?? '5'}
                          onChange={(e) => handleSettingChange('credit_reward_complete_profile', e.target.value)}
                          placeholder="5"
                        />
                      </div>
                      <div>
                        <Label>Verify KYC</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_reward_kyc_verification'] ?? getSetting('credit_reward_kyc_verification') ?? '20'}
                          onChange={(e) => handleSettingChange('credit_reward_kyc_verification', e.target.value)}
                          placeholder="20"
                        />
                      </div>
                    </div>
                    <Button onClick={() => {
                      handleSaveSetting('credit_reward_post_like', 'credit_rewards', false);
                      handleSaveSetting('credit_reward_post_comment', 'credit_rewards', false);
                      handleSaveSetting('credit_reward_referral', 'credit_rewards', false);
                      handleSaveSetting('credit_reward_daily_login', 'credit_rewards', false);
                      handleSaveSetting('credit_reward_complete_profile', 'credit_rewards', false);
                      handleSaveSetting('credit_reward_kyc_verification', 'credit_rewards', false);
                    }}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Credit Rewards
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payment Methods Management Tab */}
          <TabsContent value="payment-methods">
            <div className="space-y-6">
              {/* Manual Payment Methods */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Manual Payment Methods</CardTitle>
                    <Button onClick={() => setShowNewPaymentMethodForm(!showNewPaymentMethodForm)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Payment Method
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showNewPaymentMethodForm && (
                    <div className="p-4 border rounded-lg mb-4 bg-slate-50">
                      <p className="font-bold mb-3">Create Manual Payment Method</p>
                      <div className="space-y-3">
                        <div className="grid md:grid-cols-2 gap-3">
                          <Input
                            placeholder="Method Name (e.g., Bank Transfer - GTBank)"
                            value={newPaymentMethod.name}
                            onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, name: e.target.value })}
                          />
                          <Input
                            placeholder="Short Description"
                            value={newPaymentMethod.description}
                            onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, description: e.target.value })}
                          />
                        </div>
                        <Textarea
                          placeholder="Payment Instructions (e.g., Transfer to Account: 0123456789, Bank: GTBank, Name: SabiRight)"
                          value={newPaymentMethod.instructions}
                          onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, instructions: e.target.value })}
                          rows={3}
                        />
                        
                        {/* Custom Fields Builder */}
                        <div className="border-t pt-3 mt-3">
                          <p className="font-bold mb-2">Custom Fields (for user to fill)</p>
                          {newPaymentMethod.fields.map((field, index) => (
                            <div key={index} className="flex gap-2 mb-2 items-center">
                              <Input
                                placeholder="Field Name"
                                value={field.name}
                                onChange={(e) => {
                                  const updated = [...newPaymentMethod.fields];
                                  updated[index].name = e.target.value;
                                  setNewPaymentMethod({ ...newPaymentMethod, fields: updated });
                                }}
                                className="flex-1"
                              />
                              <select
                                className="h-10 px-3 border rounded-md text-sm"
                                value={field.type}
                                onChange={(e) => {
                                  const updated = [...newPaymentMethod.fields];
                                  updated[index].type = e.target.value as 'text' | 'file';
                                  setNewPaymentMethod({ ...newPaymentMethod, fields: updated });
                                }}
                              >
                                <option value="text">Text</option>
                                <option value="file">File Upload</option>
                              </select>
                              <Input
                                placeholder="Placeholder"
                                value={field.placeholder}
                                onChange={(e) => {
                                  const updated = [...newPaymentMethod.fields];
                                  updated[index].placeholder = e.target.value;
                                  setNewPaymentMethod({ ...newPaymentMethod, fields: updated });
                                }}
                                className="flex-1"
                              />
                              <div className="flex items-center gap-1">
                                <Checkbox
                                  checked={field.required}
                                  onCheckedChange={(checked) => {
                                    const updated = [...newPaymentMethod.fields];
                                    updated[index].required = checked as boolean;
                                    setNewPaymentMethod({ ...newPaymentMethod, fields: updated });
                                  }}
                                />
                                <Label className="text-xs">Required</Label>
                              </div>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  const updated = newPaymentMethod.fields.filter((_, i) => i !== index);
                                  setNewPaymentMethod({ ...newPaymentMethod, fields: updated });
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setNewPaymentMethod({
                                ...newPaymentMethod,
                                fields: [...newPaymentMethod.fields, { name: '', type: 'text', required: false, placeholder: '' }]
                              });
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Field
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={newPaymentMethod.active}
                            onCheckedChange={(checked) => setNewPaymentMethod({ ...newPaymentMethod, active: checked as boolean })}
                          />
                          <Label>Active (visible to users)</Label>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button onClick={() => createPaymentMethod.mutate(newPaymentMethod)}>
                          Create Payment Method
                        </Button>
                        <Button variant="outline" onClick={() => setShowNewPaymentMethodForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {paymentMethods.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">No payment methods yet</p>
                  ) : (
                    <div className="space-y-3">
                      {paymentMethods.map((method: any) => (
                        <div key={method.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-bold">{method.name}</p>
                                <Badge variant={method.active ? "default" : "secondary"}>
                                  {method.active ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600">{method.description}</p>
                              {method.instructions && (
                                <div className="mt-2 p-2 bg-slate-50 rounded text-xs">
                                  <p className="font-bold mb-1">Instructions:</p>
                                  <p className="whitespace-pre-wrap">{method.instructions}</p>
                                </div>
                              )}
                              {method.fields && method.fields.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs font-bold mb-1">Custom Fields:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {method.fields.map((field: any, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {field.name} ({field.type}){field.required && ' *'}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 ml-2">
                              <Switch
                                checked={method.active}
                                onCheckedChange={(checked) => togglePaymentMethod.mutate({ methodId: method.id, active: checked })}
                              />
                              <Button size="sm" variant="destructive" onClick={() => deletePaymentMethod.mutate(method.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Automatic Payment Gateways Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Automatic Payment Gateways</CardTitle>
                  <p className="text-sm text-slate-600 mt-2">
                    Configure automatic payment gateways with their API keys. When enabled and configured, they will automatically appear as payment options for users.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Flutterwave */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-orange-500" />
                        <div>
                          <p className="font-bold">Flutterwave</p>
                          <p className="text-xs text-slate-500">Card, Bank, Mobile Money</p>
                        </div>
                      </div>
                      <Switch 
                        checked={paymentMethods.find((m: any) => m.type === 'flutterwave')?.active || false}
                        onCheckedChange={async (checked) => {
                          const method = paymentMethods.find((m: any) => m.type === 'flutterwave');
                          if (method) {
                            const headers = await getAdminHeaders();
                            await fetch(`/api/admin/payment-methods/${method.id}`, {
                              method: 'PUT',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ active: checked })
                            });
                            queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Public Key"
                        defaultValue={paymentMethods.find((m: any) => m.type === 'flutterwave')?.publicKey || ''}
                        onBlur={async (e) => {
                          const method = paymentMethods.find((m: any) => m.type === 'flutterwave');
                          const headers = await getAdminHeaders();
                          if (method) {
                            await fetch(`/api/admin/payment-methods/${method.id}`, {
                              method: 'PUT',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ publicKey: e.target.value })
                            });
                          } else {
                            await fetch('/api/admin/payment-methods', {
                              method: 'POST',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                name: 'Flutterwave',
                                type: 'flutterwave',
                                publicKey: e.target.value,
                                active: false
                              })
                            });
                          }
                          queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
                        }}
                      />
                      <Input
                        type="password"
                        placeholder="Secret Key"
                        defaultValue={paymentMethods.find((m: any) => m.type === 'flutterwave')?.secretKey || ''}
                        onBlur={async (e) => {
                          const method = paymentMethods.find((m: any) => m.type === 'flutterwave');
                          const headers = await getAdminHeaders();
                          if (method) {
                            await fetch(`/api/admin/payment-methods/${method.id}`, {
                              method: 'PUT',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ secretKey: e.target.value })
                            });
                          }
                          queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
                        }}
                      />
                      <Input
                        type="password"
                        placeholder="Encryption Key"
                        defaultValue={paymentMethods.find((m: any) => m.type === 'flutterwave')?.encryptionKey || ''}
                        onBlur={async (e) => {
                          const method = paymentMethods.find((m: any) => m.type === 'flutterwave');
                          const headers = await getAdminHeaders();
                          if (method) {
                            await fetch(`/api/admin/payment-methods/${method.id}`, {
                              method: 'PUT',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ encryptionKey: e.target.value })
                            });
                          }
                          queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
                        }}
                      />
                      <Input
                        type="password"
                        placeholder="Webhook Hash (for webhook verification)"
                        defaultValue={paymentMethods.find((m: any) => m.type === 'flutterwave')?.webhookHash || ''}
                        onBlur={async (e) => {
                          const method = paymentMethods.find((m: any) => m.type === 'flutterwave');
                          const headers = await getAdminHeaders();
                          if (method) {
                            await fetch(`/api/admin/payment-methods/${method.id}`, {
                              method: 'PUT',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ webhookHash: e.target.value })
                            });
                          }
                          queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
                        }}
                      />
                      <p className="text-xs text-slate-500 mt-2">
                        💡 <strong>Webhook URL:</strong> Configure this in your Flutterwave dashboard:<br/>
                        <code className="bg-slate-100 px-2 py-1 rounded text-xs">
                          https://your-domain.com/api/payments/flutterwave/webhook
                        </code>
                      </p>
                    </div>
                  </div>

                  {/* Paystack */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-bold">Paystack</p>
                          <p className="text-xs text-slate-500">Card, Bank Transfer, USSD</p>
                        </div>
                      </div>
                      <Switch 
                        checked={paymentMethods.find((m: any) => m.type === 'paystack')?.active || false}
                        onCheckedChange={async (checked) => {
                          const method = paymentMethods.find((m: any) => m.type === 'paystack');
                          if (method) {
                            const headers = await getAdminHeaders();
                            await fetch(`/api/admin/payment-methods/${method.id}`, {
                              method: 'PUT',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ active: checked })
                            });
                            queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Public Key"
                        defaultValue={paymentMethods.find((m: any) => m.type === 'paystack')?.publicKey || ''}
                        onBlur={async (e) => {
                          const method = paymentMethods.find((m: any) => m.type === 'paystack');
                          const headers = await getAdminHeaders();
                          if (method) {
                            await fetch(`/api/admin/payment-methods/${method.id}`, {
                              method: 'PUT',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ publicKey: e.target.value })
                            });
                          } else {
                            await fetch('/api/admin/payment-methods', {
                              method: 'POST',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                name: 'Paystack',
                                type: 'paystack',
                                publicKey: e.target.value,
                                active: false
                              })
                            });
                          }
                          queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
                        }}
                      />
                      <Input
                        type="password"
                        placeholder="Secret Key"
                        defaultValue={paymentMethods.find((m: any) => m.type === 'paystack')?.secretKey || ''}
                        onBlur={async (e) => {
                          const method = paymentMethods.find((m: any) => m.type === 'paystack');
                          const headers = await getAdminHeaders();
                          if (method) {
                            await fetch(`/api/admin/payment-methods/${method.id}`, {
                              method: 'PUT',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ secretKey: e.target.value })
                            });
                          }
                          queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
                        }}
                      />
                    </div>
                  </div>

                  {/* Stripe */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-purple-500" />
                        <div>
                          <p className="font-bold">Stripe</p>
                          <p className="text-xs text-slate-500">International Cards</p>
                        </div>
                      </div>
                      <Switch 
                        checked={paymentMethods.find((m: any) => m.type === 'stripe')?.active || false}
                        onCheckedChange={async (checked) => {
                          const method = paymentMethods.find((m: any) => m.type === 'stripe');
                          if (method) {
                            const headers = await getAdminHeaders();
                            await fetch(`/api/admin/payment-methods/${method.id}`, {
                              method: 'PUT',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ active: checked })
                            });
                            queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Publishable Key"
                        defaultValue={paymentMethods.find((m: any) => m.type === 'stripe')?.publicKey || ''}
                        onBlur={async (e) => {
                          const method = paymentMethods.find((m: any) => m.type === 'stripe');
                          const headers = await getAdminHeaders();
                          if (method) {
                            await fetch(`/api/admin/payment-methods/${method.id}`, {
                              method: 'PUT',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ publicKey: e.target.value })
                            });
                          } else {
                            await fetch('/api/admin/payment-methods', {
                              method: 'POST',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                name: 'Stripe',
                                type: 'stripe',
                                publicKey: e.target.value,
                                active: false
                              })
                            });
                          }
                          queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
                        }}
                      />
                      <Input
                        type="password"
                        placeholder="Secret Key"
                        defaultValue={paymentMethods.find((m: any) => m.type === 'stripe')?.secretKey || ''}
                        onBlur={async (e) => {
                          const method = paymentMethods.find((m: any) => m.type === 'stripe');
                          const headers = await getAdminHeaders();
                          if (method) {
                            await fetch(`/api/admin/payment-methods/${method.id}`, {
                              method: 'PUT',
                              headers: { ...headers, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ secretKey: e.target.value })
                            });
                          }
                          queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
                        }}
                      />
                    </div>
                  </div>
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
                      <div key={payment.id} className="p-3 md:p-4 border rounded-lg">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-sm">{payment.type}</p>
                              <Badge className={
                                payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {payment.status}
                              </Badge>
                            </div>
                            <p className="text-xs md:text-sm text-slate-500">{payment.description}</p>
                            <p className="text-[10px] md:text-xs text-slate-400 mt-1">
                              {new Date(payment.createdAt).toLocaleString()}
                            </p>
                            {payment.metadata && (
                              <div className="mt-2 text-xs text-slate-600">
                                {payment.metadata.credits && <p>Credits: {payment.metadata.credits}</p>}
                                {payment.metadata.reference && <p>Ref: {payment.metadata.reference}</p>}
                              </div>
                            )}
                            {payment.rejectionReason && (
                              <p className="mt-2 text-xs text-red-600">Reason: {payment.rejectionReason}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <p className="font-bold text-base md:text-lg">{payment.currency} {payment.amount}</p>
                            {payment.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => {
                                    if (confirm(`Approve payment of ${payment.currency} ${payment.amount} for ${payment.type}?`)) {
                                      approvePayment.mutate(payment.id);
                                    }
                                  }}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    const reason = prompt('Rejection reason (optional):');
                                    if (reason !== null) {
                                      rejectPayment.mutate({ paymentId: payment.id, reason });
                                    }
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
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

                          {/* Toggle Vendor */}
                          <Button
                            size="sm"
                            variant={user.vendorMode ? "default" : "outline"}
                            className={user.vendorMode ? "bg-purple-600 hover:bg-purple-700" : ""}
                            onClick={() => toggleVendor.mutate({ userId: user.userId, vendorMode: !user.vendorMode })}
                          >
                            {user.vendorMode ? 'Remove Vendor' : 'Make Vendor'}
                          </Button>

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

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <div className="space-y-6">
              {/* Notification Templates Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-blue-500" />
                    Notification Templates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Create New Template Form */}
                  <div className="p-4 border rounded-lg bg-slate-50">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create New Template
                    </h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="template-name">Template Name</Label>
                        <Input
                          id="template-name"
                          data-testid="input-template-name"
                          placeholder="e.g., Welcome Email"
                          value={newTemplate.name}
                          onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-type">Type</Label>
                        <Select
                          value={newTemplate.type}
                          onValueChange={(value) => setNewTemplate({ ...newTemplate, type: value })}
                        >
                          <SelectTrigger data-testid="select-template-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">System</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="transactional">Transactional</SelectItem>
                            <SelectItem value="alert">Alert</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="template-subject">Subject</Label>
                        <Input
                          id="template-subject"
                          data-testid="input-template-subject"
                          placeholder="e.g., Welcome to {{appName}}!"
                          value={newTemplate.subject}
                          onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="template-body">Body Template</Label>
                        <Textarea
                          id="template-body"
                          data-testid="textarea-template-body"
                          placeholder="Hello {{userName}}, welcome to our platform..."
                          rows={4}
                          value={newTemplate.bodyTemplate}
                          onChange={(e) => setNewTemplate({ ...newTemplate, bodyTemplate: e.target.value })}
                        />
                        <p className="text-xs text-slate-500">
                          Use {"{{variable}}"} placeholders for dynamic content. Common variables: {"{{userName}}"}, {"{{email}}"}, {"{{appName}}"}, {"{{link}}"}
                        </p>
                      </div>
                      <div className="space-y-3 md:col-span-2">
                        <Label>Channels</Label>
                        <div className="flex flex-wrap gap-6">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="channel-email"
                              data-testid="checkbox-channel-email"
                              checked={newTemplate.channels.email}
                              onCheckedChange={(checked) => setNewTemplate({
                                ...newTemplate,
                                channels: { ...newTemplate.channels, email: checked as boolean }
                              })}
                            />
                            <Label htmlFor="channel-email" className="flex items-center gap-1 cursor-pointer">
                              <Mail className="h-4 w-4" /> Email
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="channel-push"
                              data-testid="checkbox-channel-push"
                              checked={newTemplate.channels.push}
                              onCheckedChange={(checked) => setNewTemplate({
                                ...newTemplate,
                                channels: { ...newTemplate.channels, push: checked as boolean }
                              })}
                            />
                            <Label htmlFor="channel-push" className="flex items-center gap-1 cursor-pointer">
                              <Bell className="h-4 w-4" /> Push
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="channel-inapp"
                              data-testid="checkbox-channel-inapp"
                              checked={newTemplate.channels.in_app}
                              onCheckedChange={(checked) => setNewTemplate({
                                ...newTemplate,
                                channels: { ...newTemplate.channels, in_app: checked as boolean }
                              })}
                            />
                            <Label htmlFor="channel-inapp" className="flex items-center gap-1 cursor-pointer">
                              <Bell className="h-4 w-4" /> In-App
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      className="mt-4"
                      data-testid="button-create-template"
                      onClick={() => createTemplate.mutate(newTemplate)}
                      disabled={!newTemplate.name || !newTemplate.subject || !newTemplate.bodyTemplate}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </div>

                  {/* Existing Templates List */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">Existing Templates ({notificationTemplates.length})</h4>
                    {notificationTemplates.length === 0 ? (
                      <p className="text-center py-8 text-slate-400">No notification templates created yet</p>
                    ) : (
                      <div className="space-y-3">
                        {notificationTemplates.map((template: any) => (
                          <div key={template.id} className="p-4 border rounded-lg" data-testid={`template-row-${template.id}`}>
                            {editingTemplate?.id === template.id ? (
                              <div className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                  <Input
                                    value={editingTemplate.name}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                    placeholder="Template Name"
                                  />
                                  <Select
                                    value={editingTemplate.type}
                                    onValueChange={(value) => setEditingTemplate({ ...editingTemplate, type: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="system">System</SelectItem>
                                      <SelectItem value="marketing">Marketing</SelectItem>
                                      <SelectItem value="transactional">Transactional</SelectItem>
                                      <SelectItem value="alert">Alert</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    className="md:col-span-2"
                                    value={editingTemplate.subject}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                                    placeholder="Subject"
                                  />
                                  <Textarea
                                    className="md:col-span-2"
                                    value={editingTemplate.bodyTemplate}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyTemplate: e.target.value })}
                                    placeholder="Body Template"
                                    rows={3}
                                  />
                                </div>
                                <div className="flex flex-wrap gap-6">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={editingTemplate.channels?.email ?? false}
                                      onCheckedChange={(checked) => setEditingTemplate({
                                        ...editingTemplate,
                                        channels: { ...editingTemplate.channels, email: checked as boolean }
                                      })}
                                    />
                                    <Label className="flex items-center gap-1"><Mail className="h-4 w-4" /> Email</Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={editingTemplate.channels?.push ?? false}
                                      onCheckedChange={(checked) => setEditingTemplate({
                                        ...editingTemplate,
                                        channels: { ...editingTemplate.channels, push: checked as boolean }
                                      })}
                                    />
                                    <Label className="flex items-center gap-1"><Bell className="h-4 w-4" /> Push</Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={editingTemplate.channels?.in_app ?? false}
                                      onCheckedChange={(checked) => setEditingTemplate({
                                        ...editingTemplate,
                                        channels: { ...editingTemplate.channels, in_app: checked as boolean }
                                      })}
                                    />
                                    <Label className="flex items-center gap-1"><Bell className="h-4 w-4" /> In-App</Label>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => updateTemplate.mutate({
                                      templateId: template.id,
                                      updates: editingTemplate
                                    })}
                                  >
                                    Save
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingTemplate(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-bold text-sm md:text-base">{template.name}</p>
                                    <Badge variant="outline" className="text-[10px]">{template.type}</Badge>
                                  </div>
                                  <p className="text-sm text-slate-600 mb-1">{template.subject}</p>
                                  <p className="text-xs text-slate-400 line-clamp-2">{template.bodyTemplate}</p>
                                  <div className="flex gap-2 mt-2">
                                    {template.channels?.email && <Badge variant="secondary" className="text-[10px]"><Mail className="h-3 w-3 mr-1" />Email</Badge>}
                                    {template.channels?.push && <Badge variant="secondary" className="text-[10px]"><Bell className="h-3 w-3 mr-1" />Push</Badge>}
                                    {template.channels?.in_app && <Badge variant="secondary" className="text-[10px]"><Bell className="h-3 w-3 mr-1" />In-App</Badge>}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`button-edit-template-${template.id}`}
                                    onClick={() => setEditingTemplate(template)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    data-testid={`button-delete-template-${template.id}`}
                                    onClick={() => deleteTemplate.mutate(template.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* SMTP Settings Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-green-500" />
                    SMTP Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-host">SMTP Host</Label>
                      <Input
                        id="smtp-host"
                        data-testid="input-smtp-host"
                        placeholder="smtp.example.com"
                        value={smtpSettings.host}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">Port</Label>
                      <Input
                        id="smtp-port"
                        data-testid="input-smtp-port"
                        placeholder="587"
                        value={smtpSettings.port}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-username">Username</Label>
                      <Input
                        id="smtp-username"
                        data-testid="input-smtp-username"
                        placeholder="your-email@example.com"
                        value={smtpSettings.username}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-password">Password</Label>
                      <Input
                        id="smtp-password"
                        data-testid="input-smtp-password"
                        type="password"
                        placeholder="••••••••"
                        value={smtpSettings.password}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, password: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-from-email">From Email</Label>
                      <Input
                        id="smtp-from-email"
                        data-testid="input-smtp-from-email"
                        placeholder="noreply@example.com"
                        value={smtpSettings.fromEmail}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-from-name">From Name</Label>
                      <Input
                        id="smtp-from-name"
                        data-testid="input-smtp-from-name"
                        placeholder="My App"
                        value={smtpSettings.fromName}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="smtp-encryption">Encryption</Label>
                      <Select
                        value={smtpSettings.encryption}
                        onValueChange={(value) => setSmtpSettings({ ...smtpSettings, encryption: value })}
                      >
                        <SelectTrigger data-testid="select-smtp-encryption">
                          <SelectValue placeholder="Select encryption" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tls">TLS</SelectItem>
                          <SelectItem value="ssl">SSL</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <Button
                      data-testid="button-save-smtp"
                      onClick={() => saveSmtpSettings.mutate({
                        ...smtpSettings,
                        port: parseInt(smtpSettings.port) || 587
                      })}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </Button>
                    <Button
                      variant="outline"
                      data-testid="button-test-smtp"
                      onClick={() => testSmtpConnection.mutate()}
                      disabled={!smtpSettings.host || !smtpSettings.username}
                    >
                      Test Connection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        <TabsContent value="analytics" className="space-y-6">
          <div>
            <h3 className="text-lg font-bold">Analytics & Insights</h3>
            <p className="text-sm text-slate-500">Comprehensive business analytics and data export</p>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => {
                // Export to CSV
                const analyticsData = {
                  revenue: {
                    total: payments?.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.amount, 0) || 0,
                    byMethod: {}
                  },
                  users: {
                    total: users?.length || 0,
                    subscribed: users?.filter((u: any) => u.subscriptionId).length || 0
                  },
                  transactions: payments?.length || 0
                };

                const csvContent = [
                  ['Metric', 'Value'],
                  ['Total Revenue', analyticsData.revenue.total],
                  ['Total Users', analyticsData.users.total],
                  ['Subscribed Users', analyticsData.users.subscribed],
                  ['Total Transactions', analyticsData.transactions],
                  [''],
                  ['Payment Details'],
                  ['Date', 'User', 'Amount', 'Type', 'Status', 'Method'],
                  ...payments?.map((p: any) => [
                    new Date(p.createdAt).toLocaleDateString(),
                    p.userId,
                    p.amount,
                    p.type,
                    p.status,
                    p.paymentMethod || 'N/A'
                  ]) || []
                ].map(row => row.join(',')).join('\\n');

                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                toast({ title: "Success", description: "CSV exported successfully" });
              }}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            <Button
              onClick={async () => {
                // Export to Excel
                try {
                  const XLSX = await import('xlsx');
                  
                  // Summary sheet
                  const summaryData = [
                    ['DigiZen-AI Analytics Report'],
                    ['Generated:', new Date().toLocaleString()],
                    [''],
                    ['Key Metrics'],
                    ['Total Revenue', payments?.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.amount, 0) || 0],
                    ['Total Users', users?.length || 0],
                    ['Subscribed Users', users?.filter((u: any) => u.subscriptionId).length || 0],
                    ['Total Transactions', payments?.length || 0],
                    ['Completed Payments', payments?.filter((p: any) => p.status === 'completed').length || 0],
                    ['Pending Payments', payments?.filter((p: any) => p.status === 'pending').length || 0],
                  ];

                  // Payments sheet
                  const paymentsData = [
                    ['Date', 'User ID', 'Amount', 'Currency', 'Type', 'Status', 'Method', 'Reference'],
                    ...payments?.map((p: any) => [
                      new Date(p.createdAt).toLocaleString(),
                      p.userId,
                      p.amount,
                      p.currency || 'NGN',
                      p.type,
                      p.status,
                      p.paymentMethod || 'N/A',
                      p.reference || 'N/A'
                    ]) || []
                  ];

                  // Users sheet
                  const usersData = [
                    ['Email', 'Display Name', 'Subscription', 'Credits', 'Created At'],
                    ...users?.map((u: any) => [
                      u.email,
                      u.displayName || 'N/A',
                      u.subscriptionId ? 'Yes' : 'No',
                      u.credits || 0,
                      new Date(u.createdAt).toLocaleString()
                    ]) || []
                  ];

                  const wb = XLSX.utils.book_new();
                  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
                  const wsPayments = XLSX.utils.aoa_to_sheet(paymentsData);
                  const wsUsers = XLSX.utils.aoa_to_sheet(usersData);

                  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
                  XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments');
                  XLSX.utils.book_append_sheet(wb, wsUsers, 'Users');

                  XLSX.writeFile(wb, `analytics-${new Date().toISOString().split('T')[0]}.xlsx`);
                  toast({ title: "Success", description: "Excel file exported successfully" });
                } catch (err) {
                  toast({ title: "Error", description: "Failed to export Excel", variant: "destructive" });
                }
              }}
              variant="outline"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>

            <Button
              onClick={async () => {
                // Export to PDF
                try {
                  const { jsPDF } = await import('jspdf');
                  const autoTable = (await import('jspdf-autotable')).default;

                  const doc = new jsPDF();
                  
                  // Title
                  doc.setFontSize(20);
                  doc.text('DigiZen-AI Analytics Report', 14, 20);
                  doc.setFontSize(10);
                  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

                  // Key Metrics
                  doc.setFontSize(14);
                  doc.text('Key Metrics', 14, 40);
                  
                  const metrics = [
                    ['Total Revenue', `NGN ${payments?.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.amount, 0) || 0}`],
                    ['Total Users', users?.length || 0],
                    ['Subscribed Users', users?.filter((u: any) => u.subscriptionId).length || 0],
                    ['Total Transactions', payments?.length || 0],
                    ['Completed Payments', payments?.filter((p: any) => p.status === 'completed').length || 0],
                    ['Pending Payments', payments?.filter((p: any) => p.status === 'pending').length || 0],
                  ];

                  (doc as any).autoTable({
                    startY: 45,
                    head: [['Metric', 'Value']],
                    body: metrics,
                  });

                  // Payments Table
                  doc.addPage();
                  doc.setFontSize(14);
                  doc.text('Recent Payments', 14, 20);

                  const paymentRows = payments?.slice(0, 50).map((p: any) => [
                    new Date(p.createdAt).toLocaleDateString(),
                    p.userId.substring(0, 8),
                    `${p.amount} ${p.currency || 'NGN'}`,
                    p.type,
                    p.status
                  ]) || [];

                  (doc as any).autoTable({
                    startY: 25,
                    head: [['Date', 'User', 'Amount', 'Type', 'Status']],
                    body: paymentRows,
                  });

                  doc.save(`analytics-${new Date().toISOString().split('T')[0]}.pdf`);
                  toast({ title: "Success", description: "PDF exported successfully" });
                } catch (err) {
                  toast({ title: "Error", description: "Failed to export PDF", variant: "destructive" });
                }
              }}
              variant="outline"
            >
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>

            <Button
              onClick={() => {
                // Export for Power BI (CSV format optimized for Power BI)
                const powerBIData = payments?.map((p: any) => ({
                  Date: new Date(p.createdAt).toISOString(),
                  Year: new Date(p.createdAt).getFullYear(),
                  Month: new Date(p.createdAt).getMonth() + 1,
                  Day: new Date(p.createdAt).getDate(),
                  UserId: p.userId,
                  Amount: p.amount,
                  Currency: p.currency || 'NGN',
                  Type: p.type,
                  Status: p.status,
                  PaymentMethod: p.paymentMethod || 'Unknown',
                  Reference: p.reference || ''
                })) || [];

                const headers = Object.keys(powerBIData[0] || {});
                const csvContent = [
                  headers.join(','),
                  ...powerBIData.map(row => 
                    headers.map(header => {
                      const value = (row as any)[header];
                      return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
                    }).join(',')
                  )
                ].join('\\n');

                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `powerbi-data-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                toast({ title: "Success", description: "Power BI data exported successfully" });
              }}
              variant="outline"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Export for Power BI
            </Button>
          </div>

          {/* Analytics Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-500">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  NGN {payments?.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.amount, 0).toLocaleString() || 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {payments?.filter((p: any) => p.status === 'completed').length || 0} completed payments
                </p>
              </CardContent>
            </Card>

            {/* Total Users */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-500">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {users?.length || 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {users?.filter((u: any) => u.subscriptionId).length || 0} subscribed
                </p>
              </CardContent>
            </Card>

            {/* Pending Payments */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-500">Pending Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {payments?.filter((p: any) => p.status === 'pending').length || 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  NGN {payments?.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + p.amount, 0).toLocaleString() || 0}
                </p>
              </CardContent>
            </Card>

            {/* Profit Margin */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-500">Estimated Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  NGN {Math.round((payments?.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.amount, 0) || 0) * 0.7).toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  ~70% profit margin
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(() => {
                  const methodRevenue: Record<string, number> = {};
                  payments?.filter((p: any) => p.status === 'completed').forEach((p: any) => {
                    const method = p.paymentMethod || 'Unknown';
                    methodRevenue[method] = (methodRevenue[method] || 0) + p.amount;
                  });

                  const totalRevenue = Object.values(methodRevenue).reduce((sum, val) => sum + val, 0);

                  return Object.entries(methodRevenue).map(([method, amount]) => (
                    <div key={method} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                        <span className="text-sm font-medium capitalize">{method}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">NGN {amount.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">
                          {((amount / totalRevenue) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Revenue Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(() => {
                  const last30Days = Array.from({ length: 30 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (29 - i));
                    return date.toISOString().split('T')[0];
                  });

                  const dailyRevenue: Record<string, number> = {};
                  payments?.filter((p: any) => p.status === 'completed').forEach((p: any) => {
                    const date = new Date(p.createdAt).toISOString().split('T')[0];
                    if (last30Days.includes(date)) {
                      dailyRevenue[date] = (dailyRevenue[date] || 0) + p.amount;
                    }
                  });

                  const maxRevenue = Math.max(...Object.values(dailyRevenue), 1);

                  return last30Days.slice(-7).map(date => {
                    const revenue = dailyRevenue[date] || 0;
                    const percentage = (revenue / maxRevenue) * 100;

                    return (
                      <div key={date} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-20">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-6 relative">
                          <div 
                            className="bg-blue-600 h-full rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          ></div>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                            NGN {revenue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Top Users by Spending */}
          <Card>
            <CardHeader>
              <CardTitle>Top Users by Spending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(() => {
                  const userSpending: Record<string, { total: number; email: string }> = {};
                  
                  payments?.filter((p: any) => p.status === 'completed').forEach((p: any) => {
                    const user = users?.find((u: any) => u.uid === p.userId);
                    if (user) {
                      if (!userSpending[p.userId]) {
                        userSpending[p.userId] = { total: 0, email: user.email };
                      }
                      userSpending[p.userId].total += p.amount;
                    }
                  });

                  return Object.entries(userSpending)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .slice(0, 5)
                    .map(([userId, data]) => (
                      <div key={userId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{data.email}</p>
                          <p className="text-xs text-slate-500">{userId.substring(0, 8)}...</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">NGN {data.total.toLocaleString()}</p>
                        </div>
                      </div>
                    ));
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Flagged Posts Tab */}
        <TabsContent value="flagged-posts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Flagged Forum Posts
                {flaggedPosts.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{flaggedPosts.length}</Badge>
                )}
              </CardTitle>
              <p className="text-sm text-slate-500">
                Review posts that have been flagged 10+ times and are hidden from users
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {flaggedPosts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No flagged posts requiring review</p>
                    <p className="text-sm mt-2">Posts with 10+ flags will appear here for admin review</p>
                  </div>
                ) : (
                  flaggedPosts.map((post: any) => (
                    <Card key={post.id} className="border-red-200 bg-red-50">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="destructive">
                                  {post.flagCount || 0} flags
                                </Badge>
                                <span className="text-sm text-slate-600">
                                  by {post.author || 'Unknown'}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {post.city || 'Unknown City'}
                                </span>
                              </div>
                              <p className="text-slate-800 mb-2">{post.content}</p>
                              <div className="flex gap-2 text-xs text-slate-500">
                                <span>👍 {post.upvotes || 0}</span>
                                <span>💬 {post.comments?.length || 0} comments</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                if (confirm('Reinstate this post? It will be visible to all users again.')) {
                                  reinstatePost.mutate(post.id);
                                }
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Reinstate
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={() => {
                                if (confirm('Permanently delete this post? This action cannot be undone.')) {
                                  deleteFlaggedPost.mutate(post.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete Permanently
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
