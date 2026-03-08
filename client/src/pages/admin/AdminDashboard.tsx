import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Settings, Users, CreditCard, MapPin, Calendar, Briefcase, Store, 
  Shield, Key, CheckCircle2, XCircle, Eye, EyeOff, Save, Bell, Mail, Trash2, Plus, Edit, Building2, Coins, ShieldCheck,
  BarChart3, Download, FileSpreadsheet, FileText, Flag, LogIn, User, ChevronRight, HelpCircle, MessageSquare, Upload,
  Menu, X, ChevronLeft, LayoutDashboard, Search, Filter, RefreshCcw, Copy, Check, Languages, BrainCircuit, Star, Smartphone, AlertTriangle
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const getAdminHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

const formatFirestoreDate = (date: any) => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (typeof date === 'object' && '_seconds' in date) {
    return new Date(date._seconds * 1000);
  }
  if (typeof date === 'object' && 'seconds' in date) {
    return new Date(date.seconds * 1000);
  }
  const d = new Date(date);
  return isNaN(d.getTime()) ? new Date() : d;
};

const PaymentItem = ({ payment, isManual }: { payment: any; isManual: boolean }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const approvePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/payments/${paymentId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` }
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
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/payments/${paymentId}/reject`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
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

  return (
    <div className="p-3 md:p-4 border rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-bold text-sm uppercase">{(payment?.type || 'payment').toString().replace('_', ' ')}</p>
            <Badge className={
              payment?.status === 'completed' ? 'bg-green-100 text-green-800' :
              payment?.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }>
              {payment?.status || 'unknown'}
            </Badge>
            {isManual && <Badge variant="outline" className="border-blue-200 text-blue-700">Manual</Badge>}
          </div>
          <p className="text-xs md:text-sm text-slate-500">{payment?.description || 'No description'}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[10px] md:text-xs text-slate-400">
              {payment?.createdAt ? formatFirestoreDate(payment.createdAt).toLocaleString() : 'Date unknown'}
            </p>
            <span className="text-[10px] text-slate-300">|</span>
            <p className="text-[10px] text-slate-400">Method: {payment?.paymentMethod || 'Unknown'}</p>
          </div>
          
          {payment.metadata && (
            <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-100 text-xs text-slate-600">
              {payment.metadata.credits && <p className="mb-1"><span className="font-semibold">Credits:</span> {payment.metadata.credits}</p>}
              {payment.metadata.reference && <p className="mb-1"><span className="font-semibold">Ref:</span> {payment.metadata.reference}</p>}
              
              {Array.isArray(payment.metadata.manualFields) && payment.metadata.manualFields.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="font-bold text-slate-700 border-b pb-1">Manual Payment Details:</p>
                  {payment.metadata.manualFields.map((f: any, i: number) => (
                    <div key={i} className="flex flex-col gap-1">
                      <span className="text-slate-500 font-medium">{f.name}:</span>
                      {f.type === 'file' ? (
                        <div className="mt-1">
                          {typeof f.value === 'string' && f.value.startsWith('data:') ? (
                            <div className="relative group">
                              <img src={f.value} alt={f.name} className="h-32 rounded border shadow-sm cursor-zoom-in" onClick={() => window.open(f.value)} />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                <Eye className="text-white h-6 w-6" />
                              </div>
                            </div>
                          ) : (
                            <a href={f.value} target="_blank" rel="noreferrer" className="inline-flex items-center text-blue-600 hover:underline font-medium">
                              <FileText className="h-4 w-4 mr-1" /> View Receipt / File
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="break-all bg-white p-1 rounded border border-slate-100">{f.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {payment.rejectionReason && (
            <p className="mt-2 text-xs text-red-600 font-medium p-2 bg-red-50 rounded border border-red-100">
              Rejection Reason: {payment.rejectionReason}
            </p>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-3 min-w-[120px]">
          <div className="text-right">
            <p className="font-bold text-lg md:text-xl text-slate-900">{payment?.currency || 'NGN'} {(payment?.amount || 0).toLocaleString()}</p>
            <p className="text-[10px] text-slate-400">Transaction ID: {payment?.id ? payment.id.substring(0, 8) : 'unknown'}...</p>
          </div>
          
          {isManual && payment?.status === 'pending' && (
            <div className="flex flex-col gap-2 w-full">
              <Button
                size="sm"
                variant="default"
                className="w-full bg-green-600 hover:bg-green-700 shadow-sm"
                onClick={() => {
                  if (confirm(`Approve payment of ${payment?.currency || 'NGN'} ${payment?.amount || 0} for ${(payment?.type || 'payment').toString().replace('_', ' ')}?`)) {
                    approvePayment.mutate(payment.id);
                  }
                }}
                disabled={approvePayment.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="w-full shadow-sm"
                onClick={() => {
                  const reason = prompt('Please provide a reason for rejection:');
                  if (reason !== null) {
                    rejectPayment.mutate({ paymentId: payment.id, reason });
                  }
                }}
                disabled={rejectPayment.isPending}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          )}
          
          {!isManual && payment.status === 'pending' && (
            <Badge variant="outline" className="text-slate-400 italic">Processing Automatically</Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const { user, profile, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserForStorage, setSelectedUserForStorage] = useState<string | null>(null);
  const [storageAmount, setStorageAmount] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [frontendPage, setFrontendPage] = useState("homepage");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const [setupKey, setSetupKey] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isAddingTrainingTerm, setIsAddingTrainingTerm] = useState(false);
  const [newTrainingTerm, setNewTrainingTerm] = useState({ term: "", category: "legal", context: "" });
  const [timeRange, setTimeRange] = useState("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const filterDataByTimeRange = (data: any[], dateField: string = 'createdAt') => {
    if (!data) return [];
    if (timeRange === "all") return data;
    
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "1w":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "1m":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "3m":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "6m":
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "custom":
        if (!customStartDate) return data;
        startDate = new Date(customStartDate);
        const endDate = customEndDate ? new Date(customEndDate) : new Date();
        endDate.setHours(23, 59, 59, 999);
        return data.filter(item => {
          const itemDate = formatFirestoreDate(item[dateField]);
          return itemDate >= startDate && itemDate <= endDate;
        });
      default:
        return data;
    }

    return data.filter(item => {
      const itemDate = formatFirestoreDate(item[dateField]);
      return itemDate >= startDate;
    });
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: "Copied", description: "API Key copied to clipboard" });
  };

  const getSetting = (key: string) => {
    return settings.find((s: any) => s.key === key)?.value || "";
  };

  const handleSettingChange = (key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleExportMoatData = () => {
    if (!moatItems || moatItems.length === 0) {
      toast({
        title: "No Data",
        description: "There is no MOAT data to export.",
        variant: "destructive"
      });
      return;
    }

    const dataStr = JSON.stringify(moatItems, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const exportFileDefaultName = `moat_data_export_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    URL.revokeObjectURL(url);
    
    toast({
      title: "Success",
      description: "MOAT data exported successfully as JSON"
    });
  };

  const handleSaveSetting = (key: string, category: string, isSecret: boolean = false) => {
     const value = localSettings[key] ?? getSetting(key);
 
     // Validation for SEO keywords
     if (key === 'seo_keywords' && value) {
       if (!value.includes(',')) {
         toast({ 
           title: "Format Suggestion", 
           description: "Consider using comma-separated keywords for better SEO results.", 
           variant: "default" 
         });
       }
     }
 
     saveSetting.mutate({ key, value, category, isSecret });
   };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        handleSettingChange(key, data.url);
        toast({ title: "Uploaded", description: "File uploaded successfully. Click save to apply." });
      }
    } catch (err) {
      toast({ title: "Upload Failed", description: "Failed to upload file", variant: "destructive" });
    }
  };

  const ApiKeyField = ({ label, id, category, placeholder, isSecret = true, description }: any) => {
    const value = localSettings[id] ?? getSetting(id);
    const isCopied = copiedKey === id;

    return (
      <div className="space-y-2">
        <Label className="flex items-center justify-between text-xs font-semibold text-slate-700">
          {label}
          <div className="flex items-center gap-1">
            {isSecret && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-slate-400 hover:text-primary" 
                onClick={() => setShowSecrets(!showSecrets)}
              >
                {showSecrets ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-slate-400 hover:text-primary" 
              onClick={() => handleCopy(value, id)}
              disabled={!value}
            >
              {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id={id}
              type={isSecret && !showSecrets ? "password" : "text"}
              placeholder={placeholder}
              value={value}
              onChange={(e) => handleSettingChange(id, e.target.value)}
              className="h-9 text-sm pr-10"
            />
            {value && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  value.length > 10 ? "bg-green-500" : "bg-amber-500"
                )} />
              </div>
            )}
          </div>
          <Button 
            size="sm" 
            className="h-9 px-3"
            onClick={() => handleSaveSetting(id, category, isSecret)}
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>
        {description && <p className="text-[10px] text-slate-500">{description}</p>}
      </div>
    );
  };

  const NAV_CATEGORIES = [
    {
      title: "Core",
      items: [
        { id: "settings", label: "General Settings", icon: Settings },
        { id: "api-keys", label: "API Keys", icon: Key },
              { id: "email-templates", label: "Email Templates", icon: Mail },
              { id: "analytics", label: "Analytics", icon: BarChart3 },
      ]
    },
    {
      title: "Financial",
      items: [
        { id: "plans", label: "Plans", icon: CreditCard },
        { id: "credits", label: "Credits", icon: Coins },
        { id: "payment-methods", label: "Payment Methods", icon: Building2 },
        { id: "payments", label: "Transactions", icon: CreditCard },
        { id: "escrow", label: "Escrow", icon: Shield },
      ]
    },
    {
      title: "Management",
      items: [
        { id: "users", label: "Users", icon: Users },
        { id: "vendors", label: "Vendors", icon: Store },
        { id: "vendor-services", label: "Services", icon: Briefcase },
      ]
    },
    {
      title: "Content",
      items: [
        { id: "frontend", label: "Frontend Management", icon: LayoutDashboard },
        { id: "jobs", label: "Jobs", icon: Briefcase },
        { id: "events", label: "Events", icon: Calendar },
        { id: "training", label: "AI Training", icon: BrainCircuit },
        { id: "faqs", label: "FAQs", icon: HelpCircle },
        { id: "testimonials", label: "Reviews", icon: MessageSquare },
        { id: "flagged-posts", label: "Flagged Posts", icon: Flag },
      ]
    },
    {
      title: "System",
      items: [
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "moat", label: "MOAT", icon: Shield },
        { id: "surveys", label: "Adoption", icon: MessageSquare },
      ]
    }
  ];

  const NAV_ITEMS = NAV_CATEGORIES.flatMap(c => c.items);

  const handleAdminSetup = async () => {
    if (!profile?.userId) return;
    setIsSettingUp(true);
    try {
      const res = await fetch(`/api/admin/setup/${profile.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupKey })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: "You are now an admin. Refreshing..." });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({ title: "Error", description: data.error || "Setup failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Request failed", variant: "destructive" });
    } finally {
      setIsSettingUp(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Protection Check
  if (!profile?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <Shield className="h-16 w-16 text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Admin Access Required</h2>
        <p className="text-slate-500 mb-8 max-w-md">
          This area is restricted to administrators. If you are a developer, you can use the setup key to grant yourself admin access.
          <br /><br />
          <span className="text-xs text-slate-400">Current User: {user?.email}</span>
        </p>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 w-full max-w-sm">
          <div className="space-y-4">
            <div className="text-left">
              <Label htmlFor="setupKey" className="text-xs font-bold uppercase text-slate-500">Setup Key</Label>
              <Input 
                id="setupKey"
                type="password" 
                placeholder="Enter admin setup key" 
                value={setupKey}
                onChange={(e) => setSetupKey(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button 
              onClick={handleAdminSetup} 
              disabled={isSettingUp || !setupKey}
              className="w-full"
            >
              {isSettingUp ? "Processing..." : "Grant Admin Access"}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/app")}
              className="w-full text-slate-500"
            >
              Return to App
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

  const { data: vendors = [] } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/vendors', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/payments', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: adminJobs = [] } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/jobs', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: adminEvents = [] } = useQuery({
    queryKey: ['admin-events'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/events', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: adminVendorServices = [] } = useQuery({
    queryKey: ['admin-vendor-services'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/vendor-services', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: moatItems = [] } = useQuery({
    queryKey: ['admin-moat'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/moat', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: faqs = [] } = useQuery({
    queryKey: ['admin-faqs'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/faqs', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: testimonials = [] } = useQuery({
    queryKey: ['admin-testimonials'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/testimonials', { headers });
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

  const { data: surveys = [] } = useQuery({
    queryKey: ['admin-surveys'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/surveys', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: trainingStats = { total: 0, verified: 0, totalVotes: 0, byLanguage: {} } } = useQuery({
    queryKey: ['admin-training-stats'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/crowd-translations/stats', { headers });
      return res.ok ? res.json() : { total: 0, verified: 0, totalVotes: 0, byLanguage: {} };
    }
  });

  const { data: surveyStats = {} } = useQuery({
    queryKey: ['admin-surveys-stats'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/surveys/stats', { headers });
      return res.ok ? res.json() : {};
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
      queryClient.invalidateQueries({ queryKey: ['/api/settings/public'] });
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

  const approveEmail = useMutation({
    mutationFn: async (userId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/email-verification/${userId}/approve`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: "Approved", description: "Email verification approved" });
    }
  });

  const approveVendorService = useMutation({
    mutationFn: async (serviceId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/vendor-services/${serviceId}/approve`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendor-services'] });
      toast({ title: "Approved", description: "Vendor service approved" });
    }
  });

  const rejectVendorService = useMutation({
    mutationFn: async (serviceId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/vendor-services/${serviceId}/reject`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendor-services'] });
      toast({ title: "Rejected", description: "Vendor service rejected" });
    }
  });

  const rejectEmail = useMutation({
    mutationFn: async (userId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/email-verification/${userId}/reject`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: "Rejected", description: "Email verification rejected" });
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

  const updateStorageLimit = useMutation({
    mutationFn: async ({ userId, limitBytes }: { userId: string; limitBytes: number }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/users/${userId}/storage-limit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ limitBytes })
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: "Updated", description: "User storage limit updated" });
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

  // FAQ Mutations
  const createFaq = useMutation({
    mutationFn: async (faq: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/faqs', {
        method: 'POST',
        headers,
        body: JSON.stringify(faq)
      });
      if (!res.ok) throw new Error('Failed to create FAQ');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-faqs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
      toast({ title: "Created", description: "FAQ added successfully" });
    }
  });

  const updateFaq = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/faqs/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update FAQ');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-faqs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
      toast({ title: "Updated", description: "FAQ updated successfully" });
    }
  });

  const deleteFaq = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/faqs/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed to delete FAQ');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-faqs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
      toast({ title: "Deleted", description: "FAQ removed" });
    }
  });

  // Testimonial Mutations
  const createTestimonial = useMutation({
    mutationFn: async (testimonial: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/testimonials', {
        method: 'POST',
        headers,
        body: JSON.stringify(testimonial)
      });
      if (!res.ok) throw new Error('Failed to create testimonial');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] });
      toast({ title: "Created", description: "Testimonial added successfully" });
    }
  });

  const createTrainingTerm = useMutation({
    mutationFn: async (term: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/training-terms', {
        method: 'POST',
        headers,
        body: JSON.stringify(term)
      });
      if (!res.ok) throw new Error('Failed to create training term');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-training-terms'] });
      toast({ title: "Created", description: "New training term added" });
      setNewTrainingTerm({ term: "", category: "legal", context: "" });
    }
  });

  const updateTestimonial = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update testimonial');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] });
      toast({ title: "Updated", description: "Testimonial updated successfully" });
    }
  });

  const deleteTestimonial = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed to delete testimonial');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] });
      toast({ title: "Deleted", description: "Testimonial removed" });
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

  const exportTrainingData = useMutation({
    mutationFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/crowd-translations/export', { headers });
      if (!res.ok) throw new Error('Failed to export training data');
      return res.text();
    },
    onSuccess: (data) => {
      const blob = new Blob([data], { type: 'application/x-jsonlines' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sabi_training_data_${new Date().toISOString().split('T')[0]}.jsonl`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: "Training data exported as JSONL" });
    }
  });

  const updateUser = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: any }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      toast({ title: "Updated", description: "User details updated successfully" });
      setEditingUser(null);
    }
  });

  const impersonateUser = useMutation({
    mutationFn: async (userId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/users/${userId}/impersonate`, {
        method: 'POST',
        headers
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: "Logging in as user..." });
      // In a real app, you would use data.token to sign in
      // For now, we'll just log it and show a message
      // Impersonation token: data.token
      window.open(`/auth/login?token=${data.token}`, '_blank');
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

  const updateCreditPackage = useMutation({
    mutationFn: async ({ packageId, updates }: { packageId: string; updates: any }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/credit-packages/${packageId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-credit-packages'] });
      toast({ title: "Updated", description: "Credit package updated" });
      setEditingPackage(null);
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

  const deleteJob = useMutation({
    mutationFn: async (jobId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/jobs/${jobId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      toast({ title: "Deleted", description: "Job deleted successfully" });
    }
  });

  const createJob = useMutation({
    mutationFn: async (job: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers,
        body: JSON.stringify(job)
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      toast({ title: "Created", description: "Job created successfully" });
      setNewJob({ title: '', company: '', location: '', type: 'Full-time', workMode: 'Remote', salary: '', description: '', contact: '' });
    }
  });

  const updateJob = useMutation({
    mutationFn: async ({ jobId, updates }: { jobId: string; updates: any }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/jobs/${jobId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      toast({ title: "Updated", description: "Job updated successfully" });
      setEditingJob(null);
    }
  });

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/events/${eventId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast({ title: "Deleted", description: "Event deleted successfully" });
    }
  });

  const createEvent = useMutation({
    mutationFn: async (event: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers,
        body: JSON.stringify(event)
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast({ title: "Created", description: "Event created successfully" });
      setNewEvent({ title: '', description: '', date: '', time: '', location: '', category: 'workshop', organizer: 'Admin', maxAttendees: 100 });
    }
  });

  const updateEvent = useMutation({
    mutationFn: async ({ eventId, updates }: { eventId: string; updates: any }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast({ title: "Updated", description: "Event updated successfully" });
      setEditingEvent(null);
    }
  });

  const deleteMoat = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/moat/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-moat'] });
      toast({ title: "Deleted", description: "MOAT entry deleted" });
    }
  });

  const createMoat = useMutation({
    mutationFn: async (data: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/moat', {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-moat'] });
      toast({ title: "Success", description: "MOAT data uploaded" });
    }
  });

  // Escrow Disputes
  const { data: disputes = [] } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/disputes', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const joinDispute = useMutation({
    mutationFn: async (disputeId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/disputes/${disputeId}/join`, {
        method: 'POST',
        headers
      });
      if (!res.ok) throw new Error('Failed to join dispute');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      toast({ title: "Joined Dispute", description: "You have joined the dispute chat. User and vendor can no longer message." });
    }
  });

  const resolveDispute = useMutation({
    mutationFn: async ({ disputeId, resolution, notes }: { disputeId: string, resolution: string, notes: string }) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, notes })
      });
      if (!res.ok) throw new Error('Failed to resolve dispute');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      toast({ title: "Dispute Resolved", description: "The dispute has been marked as resolved." });
    }
  });

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [newPlan, setNewPlan] = useState({ name: '', type: 'basic', userType: 'user', price: 0, credits: 10, description: '' });
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [resolvingDispute, setResolvingDispute] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; title: string; description: string } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionValue, setResolutionValue] = useState("user_favor");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [newMoat, setNewMoat] = useState({ title: '', content: '', source: '', category: 'constitution' });
  const [editingJob, setEditingJob] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [newJob, setNewJob] = useState<any>({ title: '', company: '', location: '', type: 'Full-time', workMode: 'Remote', salary: '', description: '', contact: '' });
  const [newEvent, setNewEvent] = useState<any>({ title: '', description: '', date: '', time: '', location: '', category: 'workshop', organizer: 'Admin', maxAttendees: 100 });
  
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

  const { data: trainingTerms = [] } = useQuery({
    queryKey: ['admin-training-terms'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/training-terms', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const { data: crowdTranslations = [] } = useQuery({
    queryKey: ['admin-crowd-translations'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/crowd-translations', { headers });
      return res.ok ? res.json() : [];
    }
  });

  const deleteTrainingTerm = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/training-terms/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed to delete training term');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-terms'] });
      toast({ title: "Deleted", description: "Training term removed" });
    }
  });

  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'system',
    subject: '',
    bodyTemplate: '',
    channels: { email: true, push: false, in_app: true }
  });

  // FAQ management states
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [editingFaq, setEditingFaq] = useState<any>(null);
  const [newFaq, setNewFaq] = useState({
    question: '',
    answer: '',
    category: 'general',
    order: 0,
    isActive: true
  });

  // Testimonial management states
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<any>(null);
  const [newTestimonial, setNewTestimonial] = useState({
    name: '',
    role: '',
    content: '',
    avatar: '',
    rating: 5,
    isActive: true
  });
  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: '587',
    username: '',
    password: '',
    fromEmail: '',
    fromName: '',
    encryption: 'tls',
    isActive: true
  });

  const [pushSettings, setPushSettings] = useState({
    publicKey: '',
    privateKey: '',
    subject: '',
    isActive: true
  });

  const [socialLinks, setSocialLinks] = useState({
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    youtube: '',
    whatsapp: ''
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
        return await res.json();
      }
      return null;
    }
  });

  const { data: pushData } = useQuery({
    queryKey: ['admin-push-settings'],
    queryFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/notifications/push', { headers });
      if (res.ok) {
        return await res.json();
      }
      return null;
    }
  });

  useEffect(() => {
    if (smtpData) {
      setSmtpSettings({
        host: smtpData.host || '',
        port: smtpData.port?.toString() || '587',
        username: smtpData.username || '',
        password: smtpData.password || '',
        fromEmail: smtpData.fromEmail || '',
        fromName: smtpData.fromName || '',
        encryption: smtpData.encryption || 'tls',
        isActive: smtpData.isActive !== false
      });
    }
  }, [smtpData]);

  useEffect(() => {
    if (pushData) {
      setPushSettings({
        publicKey: pushData.publicKey || '',
        privateKey: pushData.privateKey || '',
        subject: pushData.subject || '',
        isActive: pushData.isActive !== false
      });
    }
  }, [pushData]);

  useEffect(() => {
    const socialLinksSetting = settings.find((s: any) => s.key === 'social_links')?.value;
    if (socialLinksSetting) {
      try {
        const parsed = JSON.parse(socialLinksSetting);
        setSocialLinks(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Error parsing social links setting", e);
      }
    }
  }, [settings]);

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
        method: 'PATCH',
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

  const savePushSettings = useMutation({
    mutationFn: async (settings: any) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/notifications/push', {
        method: 'POST',
        headers,
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Failed to save Push settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-push-settings'] });
      toast({ title: "Saved", description: "Push notification settings saved successfully" });
    }
  });

  const generateVapidKeys = useMutation({
    mutationFn: async () => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/notifications/push/generate-keys', {
        method: 'POST',
        headers
      });
      if (!res.ok) throw new Error('Failed to generate VAPID keys');
      return res.json();
    },
    onSuccess: (keys) => {
      setPushSettings({
        ...pushSettings,
        publicKey: keys.publicKey,
        privateKey: keys.privateKey
      });
      toast({ title: "Keys Generated", description: "New VAPID keys have been generated. Don't forget to save." });
    }
  });

  const testPushNotification = useMutation({
    mutationFn: async (userId: string) => {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/notifications/push/test', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error('Push test failed');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Success", description: "Push notification test sent successfully" });
      } else {
        toast({ title: "Failed", description: "Push notification test failed. User might not have active subscriptions.", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to test push notification", variant: "destructive" });
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden md:flex flex-col border-r bg-white transition-all duration-300 sticky top-0 h-screen",
          isSidebarCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="p-4 border-b flex items-center justify-between">
          {!isSidebarCollapsed && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 font-bold text-xl text-primary"
            >
              <LayoutDashboard className="h-6 w-6" />
              <span>Admin Panel</span>
            </motion.div>
          )}
          {isSidebarCollapsed && (
            <LayoutDashboard className="h-6 w-6 text-primary mx-auto" />
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="ml-auto"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", isSidebarCollapsed && "rotate-180")} />
          </Button>
        </div>

        <ScrollArea className="flex-1 py-4">
          <nav className="px-3 space-y-6">
            {NAV_CATEGORIES.map((category) => (
              <div key={category.title} className="space-y-1">
                {!isSidebarCollapsed && (
                  <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    {category.title}
                  </h4>
                )}
                {category.items.map((item) => (
                  <Button
                    key={item.id}
                    variant={activeTab === item.id ? "default" : "ghost"}
                    className={cn(
                      "w-full transition-all duration-200 h-9",
                      isSidebarCollapsed ? "justify-center px-0" : "justify-start px-3",
                      activeTab === item.id ? "bg-primary text-primary-foreground shadow-sm font-medium" : "hover:bg-slate-100 text-slate-600"
                    )}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <item.icon className={cn("h-4 w-4", !isSidebarCollapsed && "mr-3")} />
                    {!isSidebarCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-sm"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </Button>
                ))}
                {isSidebarCollapsed && <div className="h-px bg-slate-100 mx-4 my-2" />}
              </div>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t mt-auto">
          <Link href="/app">
            <Button 
              variant="outline" 
              className={cn("w-full gap-2", isSidebarCollapsed && "px-0 justify-center")}
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              {!isSidebarCollapsed && "Back to App"}
            </Button>
          </Link>
        </div>
      </aside>

      {/* Mobile Menu Sheet */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin Navigation</SheetTitle>
            <SheetDescription>Mobile navigation menu for admin panel</SheetDescription>
          </SheetHeader>
          <div className="p-4 border-b flex items-center gap-2 font-bold text-xl text-primary">
            <LayoutDashboard className="h-6 w-6" />
            <span>Admin Panel</span>
          </div>
          <ScrollArea className="h-[calc(100vh-64px)] py-4">
            <nav className="px-3 space-y-6">
              {NAV_CATEGORIES.map((category) => (
                <div key={category.title} className="space-y-1">
                  <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    {category.title}
                  </h4>
                  {category.items.map((item) => (
                    <Button
                      key={item.id}
                      variant={activeTab === item.id ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-start px-3 h-10",
                        activeTab === item.id ? "bg-primary text-primary-foreground font-medium" : "text-slate-600"
                      )}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <item.icon className="h-4 w-4 mr-3" />
                      <span className="text-sm">{item.label}</span>
                    </Button>
                  ))}
                </div>
              ))}
              <div className="pt-4 mt-4 border-t px-3">
                <Link href="/app">
                  <Button variant="outline" className="w-full gap-2 justify-start h-10">
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Back to App
                  </Button>
                </Link>
              </div>
            </nav>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-white sticky top-0 z-10">
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-2 font-bold text-primary">
            <LayoutDashboard className="h-5 w-5" />
            <span>Admin</span>
          </div>
          <div className="w-10" />
        </header>

        <main className="flex-1 p-4 md:p-8 lg:p-10">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <motion.h1 
                  key={activeTab}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-3xl font-bold tracking-tight text-slate-900"
                >
                  {NAV_ITEMS.find(i => i.id === activeTab)?.label || "Dashboard"}
                </motion.h1>
                <p className="text-slate-500 mt-1">
                  Manage your platform {activeTab.replace('-', ' ')} and overview.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="px-3 py-1 border-red-200 text-red-700 bg-red-50 font-medium">
                  <Shield className="h-3 w-3 mr-1" /> Admin Access
                </Badge>
              </div>
            </div>

            {/* Stats Overview - Show only on settings or analytics */}
            {(activeTab === 'settings' || activeTab === 'analytics') && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              >
                {[
                  { label: "Total Users", value: users.length, icon: Users, color: "blue" },
                  { label: "Active Vendors", value: vendorApps.filter((a: any) => a.status === 'approved').length, icon: Store, color: "green" },
                  { label: "Total Events", value: adminEvents.length, icon: Calendar, color: "purple" },
                  { label: "Transactions", value: payments.length, icon: CreditCard, color: "amber" }
                ].map((stat, idx) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + (idx * 0.1) }}
                  >
                    <Card className="border-none shadow-sm bg-white overflow-hidden group">
                      <div className={cn("absolute top-0 left-0 w-1 h-full", `bg-${stat.color}-500`)} />
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                            <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                          </div>
                          <div className={cn("h-12 w-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform", `bg-${stat.color}-50`)}>
                            <stat.icon className={cn("h-6 w-6", `text-${stat.color}-600`)} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                  {/* AI Training Tab */}
                  <TabsContent value="training" className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <BrainCircuit className="h-6 w-6 text-blue-500" />
                          AI Model Training
                        </h3>
                        <p className="text-sm text-slate-500">Crowd-sourced translation progress and model fine-tuning data</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Dialog open={isAddingTrainingTerm} onOpenChange={setIsAddingTrainingTerm}>
                          <DialogTrigger asChild>
                            <Button className="bg-green-600 hover:bg-green-700">
                              <Plus className="h-4 w-4 mr-2" />
                              Add New Word
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Training Word</DialogTitle>
                              <DialogDescription>
                                Add a new word or phrase to be crowd-translated and verified for AI training.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="term">Word or Phrase</Label>
                                <Input 
                                  id="term" 
                                  placeholder="e.g. Affidavit, Power of Attorney" 
                                  value={newTrainingTerm.term}
                                  onChange={(e) => setNewTrainingTerm({...newTrainingTerm, term: e.target.value})}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Select 
                                  value={newTrainingTerm.category} 
                                  onValueChange={(value) => setNewTrainingTerm({...newTrainingTerm, category: value})}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="legal">Legal</SelectItem>
                                    <SelectItem value="civic">Civic</SelectItem>
                                    <SelectItem value="medical">Medical</SelectItem>
                                    <SelectItem value="general">General</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="context">Context (Optional)</Label>
                                <Input 
                                  id="context" 
                                  placeholder="Provide context for better translation" 
                                  value={newTrainingTerm.context}
                                  onChange={(e) => setNewTrainingTerm({...newTrainingTerm, context: e.target.value})}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsAddingTrainingTerm(false)}>Cancel</Button>
                              <Button 
                                onClick={() => {
                                  if (!newTrainingTerm.term) {
                                    toast({ title: "Error", description: "Term is required", variant: "destructive" });
                                    return;
                                  }
                                  createTrainingTerm.mutate(newTrainingTerm, {
                                    onSuccess: () => {
                                      setIsAddingTrainingTerm(false);
                                      setNewTrainingTerm({ term: "", category: "legal", context: "" });
                                    }
                                  });
                                }}
                                disabled={createTrainingTerm.isPending}
                              >
                                {createTrainingTerm.isPending ? "Adding..." : "Add Word"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        
                        <Button 
                          onClick={() => exportTrainingData.mutate()} 
                          disabled={exportTrainingData.isPending || (trainingStats?.verified || 0) === 0}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export JSONL
                        </Button>
                      </div>
                    </div>

                    {/* Training Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-blue-50/50 border-blue-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-blue-600">Total Submissions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-blue-900">{trainingStats?.total || 0}</div>
                          <p className="text-xs text-blue-600 mt-1">Translations submitted by users</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-50/50 border-green-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-green-600">Verified Terms</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-green-900">{trainingStats?.verified || 0}</div>
                          <p className="text-xs text-green-600 mt-1">Ready for model fine-tuning</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-amber-50/50 border-amber-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-amber-600">Avg. Votes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-amber-900">
                            {trainingStats?.total > 0 ? (trainingStats.totalVotes / trainingStats.total).toFixed(1) : '0.0'}
                          </div>
                          <p className="text-xs text-amber-600 mt-1">Community verification activity</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Language Breakdown */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Language Distribution</CardTitle>
                        <CardDescription>Number of verified translations per language</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={Object.entries(trainingStats?.byLanguage || {}).map(([lang, count]) => ({
                                language: lang.charAt(0).toUpperCase() + lang.slice(1),
                                count
                              }))}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="language" />
                              <YAxis />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                cursor={{ fill: '#f8fafc' }}
                              />
                              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Export Info */}
                    <Card className="border-dashed">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <div className="bg-slate-100 p-2 rounded-lg">
                            <FileText className="h-5 w-5 text-slate-600" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-semibold text-sm">Export Format (JSONL)</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              The export generates a .jsonl file where each line is a training example:
                              <br />
                              <code className="bg-slate-50 p-1 rounded mt-1 block">
                                {"{\"instruction\": \"Translate [Term] to [Language]\", \"input\": \"[Context]\", \"output\": \"[Translation]\"}"}
                              </code>
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* User Submitted Translations Section */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Languages className="h-4 w-4 text-purple-500" />
                          User Submitted Translations (Sabi Contributor)
                        </h4>
                      </div>
                      
                      <Card>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>English Term</TableHead>
                              <TableHead>Translation / Meaning</TableHead>
                              <TableHead>Language</TableHead>
                              <TableHead>Votes</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Submitted On</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {crowdTranslations.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                  No user submissions yet.
                                </TableCell>
                              </TableRow>
                            ) : (
                              crowdTranslations.map((t: any) => (
                                <TableRow key={t.id}>
                                  <TableCell className="font-medium">{t.english}</TableCell>
                                  <TableCell className="text-slate-700 font-semibold">{t.translation}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="capitalize">{t.language}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Star className={cn("h-3 w-3", t.votes > 0 ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
                                      <span>{t.votes || 0}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {t.verified ? (
                                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Verified</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">Pending</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-400">
                                    {new Date(t.createdAt).toLocaleDateString()}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </Card>
                    </div>

                    {/* Manual Training Words Section */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Plus className="h-4 w-4 text-blue-500" />
                          Manual Training Terms
                        </h4>
                      </div>
                      
                      <Card>
                        <CardContent className="pt-6 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-500 uppercase">Term / Word</label>
                              <Input 
                                placeholder="e.g. SabiGuard" 
                                value={newTrainingTerm.term}
                                onChange={(e) => setNewTrainingTerm(prev => ({ ...prev, term: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-500 uppercase">Context / Definition (Optional)</label>
                              <Input 
                                placeholder="e.g. AI-powered community security system" 
                                value={newTrainingTerm.context}
                                onChange={(e) => setNewTrainingTerm(prev => ({ ...prev, context: e.target.value }))}
                              />
                            </div>
                          </div>
                          <Button 
                            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700"
                            disabled={!newTrainingTerm.term || createTrainingTerm.isPending}
                            onClick={() => createTrainingTerm.mutate(newTrainingTerm)}
                          >
                            {createTrainingTerm.isPending ? "Adding..." : "Add Training Term"}
                          </Button>
                        </CardContent>
                      </Card>

                      <Card>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Term</TableHead>
                              <TableHead>Context</TableHead>
                              <TableHead>Added On</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {trainingTerms.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                  No manual training terms added yet.
                                </TableCell>
                              </TableRow>
                            ) : (
                              trainingTerms.map((term: any) => (
                                <TableRow key={term.id}>
                                  <TableCell className="font-medium">{term.term}</TableCell>
                                  <TableCell className="text-slate-500 italic">{term.context || '-'}</TableCell>
                                  <TableCell className="text-xs text-slate-400">
                                    {new Date(term.createdAt).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => deleteTrainingTerm.mutate(term.id)}
                                      disabled={deleteTrainingTerm.isPending}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </Card>
                    </div>
                  </TabsContent>

                <TabsContent value="frontend" className="mt-0">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <LayoutDashboard className="h-5 w-5 text-primary" />
                          Frontend Management
                        </CardTitle>
                        <CardDescription>Manage the content and pages of your public website.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Tabs value={frontendPage} onValueChange={setFrontendPage} className="w-full">
                          <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1 bg-slate-100/50">
                            <TabsTrigger value="homepage" className="text-xs py-2">Homepage</TabsTrigger>
                            <TabsTrigger value="about" className="text-xs py-2">About Us</TabsTrigger>
                            <TabsTrigger value="contact" className="text-xs py-2">Contact</TabsTrigger>
                            <TabsTrigger value="footer" className="text-xs py-2">Footer</TabsTrigger>
                            <TabsTrigger value="legal" className="text-xs py-2">Legal Pages</TabsTrigger>
                          </TabsList>

                          <div className="mt-6">
                            {frontendPage === "homepage" && (
                              <div className="space-y-6">
                                <Card>
                                  <CardHeader>
                                    <CardTitle>Hero Section</CardTitle>
                                    <p className="text-sm text-slate-500">Manage the main hero section of the homepage.</p>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="hero_title">Hero Title</Label>
                                      <Input
                                        id="hero_title"
                                        value={localSettings['hero_title'] ?? getSetting('hero_title')}
                                        onChange={(e) => handleSettingChange('hero_title', e.target.value)}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="hero_subtitle">Hero Subtitle</Label>
                                      <Textarea
                                        id="hero_subtitle"
                                        value={localSettings['hero_subtitle'] ?? getSetting('hero_subtitle')}
                                        onChange={(e) => handleSettingChange('hero_subtitle', e.target.value)}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="video_demo_url">Video Demo URL (YouTube)</Label>
                                      <div className="flex gap-2">
                                        <Input
                                          id="video_demo_url"
                                          placeholder="https://www.youtube.com/watch?v=..."
                                          value={localSettings['video_demo_url'] ?? getSetting('video_demo_url')}
                                          onChange={(e) => handleSettingChange('video_demo_url', e.target.value)}
                                        />
                                      </div>
                                      <p className="text-[10px] text-slate-500">Paste a YouTube URL. It will be automatically converted to an embed.</p>
                                    </div>
                                    <Button size="sm" onClick={() => {
                                      handleSaveSetting('hero_title', 'homepage');
                                      handleSaveSetting('hero_subtitle', 'homepage');
                                      handleSaveSetting('video_demo_url', 'homepage');
                                    }}>
                                      <Save className="h-4 w-4 mr-2" /> Save Hero Section
                                    </Button>
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader>
                                    <CardTitle>SEO Management</CardTitle>
                                    <p className="text-sm text-slate-500">Configure global SEO settings for the public website.</p>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="seo_title">SEO Title</Label>
                                      <Input
                                        id="seo_title"
                                        placeholder="SabiRight - AI-Powered Civic Empowerment"
                                        value={localSettings['seo_title'] ?? getSetting('seo_title')}
                                        onChange={(e) => handleSettingChange('seo_title', e.target.value)}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="seo_description">SEO Description</Label>
                                      <Textarea
                                        id="seo_description"
                                        placeholder="Empowering citizens with law-based guidance..."
                                        value={localSettings['seo_description'] ?? getSetting('seo_description')}
                                        onChange={(e) => handleSettingChange('seo_description', e.target.value)}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="seo_keywords">SEO Keywords (Comma separated)</Label>
                                      <Input
                                        id="seo_keywords"
                                        placeholder="civic tech, law-based guidance, nigeria police act"
                                        value={localSettings['seo_keywords'] ?? getSetting('seo_keywords')}
                                        onChange={(e) => handleSettingChange('seo_keywords', e.target.value)}
                                      />
                                    </div>
                                    <Button size="sm" onClick={() => {
                                      handleSaveSetting('seo_title', 'seo');
                                      handleSaveSetting('seo_description', 'seo');
                                      handleSaveSetting('seo_keywords', 'seo');
                                    }}>
                                      <Save className="h-4 w-4 mr-2" /> Save SEO Settings
                                    </Button>
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader>
                                    <CardTitle>Features Section</CardTitle>
                                    <p className="text-sm text-slate-500">Manage the platform advantages graphic text.</p>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="platform_advantages_title">Advantages Title</Label>
                                      <Input
                                        id="platform_advantages_title"
                                        value={localSettings['platform_advantages_title'] ?? getSetting('platform_advantages_title')}
                                        onChange={(e) => handleSettingChange('platform_advantages_title', e.target.value)}
                                      />
                                    </div>
                                    <Button size="sm" onClick={() => handleSaveSetting('platform_advantages_title', 'homepage')}>
                                      <Save className="h-4 w-4 mr-2" /> Save Features Section
                                    </Button>
                                  </CardContent>
                                </Card>
                              </div>
                            )}

                            {frontendPage === "legal" && (
                              <div className="space-y-6">
                                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl mb-6 flex justify-between items-center">
                                  <div>
                                    <h4 className="font-bold text-sm text-amber-700 mb-1">Legal Documents</h4>
                                    <p className="text-xs text-amber-600">These pages are essential for compliance and trust.</p>
                                  </div>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="bg-white border-amber-200 text-amber-800 hover:bg-amber-100"
                                    onClick={() => {
                                      if (confirm("This will overwrite existing content with SabiRight templates. Continue?")) {
                                        const templates: Record<string, string> = {
                                          privacy_policy: `<h2>Privacy Policy for SabiRight</h2><p><strong>Effective Date:</strong> ${new Date().toLocaleDateString()}</p><p>At SabiRight, we prioritize your privacy and data security in compliance with the Nigeria Data Protection Regulation (NDPR) 2019.</p><h3>1. Information We Collect</h3><ul><li><strong>Personal Information:</strong> Name, email address, phone number, and location data for service matching.</li><li><strong>Usage Data:</strong> Information on how you interact with our AI legal assistant and marketplace.</li></ul><h3>2. How We Use Your Data</h3><p>We use your data to:</p><ul><li>Connect you with verified legal and civic professionals nearby.</li><li>Improve our AI training models (anonymized data only).</li><li>Send critical civic alerts and updates.</li></ul><h3>3. Data Security</h3><p>We implement banking-grade encryption to protect your personal information. We do not sell your data to third parties.</p>`,
                                          terms_of_service: `<h2>Terms of Service</h2><p><strong>Last Updated:</strong> ${new Date().toLocaleDateString()}</p><p>Welcome to SabiRight. By accessing our platform, you agree to these terms.</p><h3>1. Platform Use</h3><p>SabiRight is a civic engagement tool. The "Right-To-Know" AI provides information based on the 1999 Constitution and Police Act 2020 but does not constitute legal advice.</p><h3>2. User Conduct</h3><p>You agree not to misuse the platform for illegal activities or to harass professionals.</p><h3>3. Professional Services</h3><p>Contractors and lawyers on our platform are independent service providers. SabiRight is not liable for their off-platform conduct.</p>`,
                                          cookie_policy: `<h2>Cookie Policy</h2><p>SabiRight uses cookies to enhance your experience.</p><ul><li><strong>Essential Cookies:</strong> Required for login and security.</li><li><strong>Analytics Cookies:</strong> Help us understand how you use the platform to improve features.</li></ul><p>You can manage your cookie preferences in your browser settings.</p>`
                                        };
                                        Object.entries(templates).forEach(([key, val]) => {
                                          handleSettingChange(key, val);
                                          // We don't auto-save to allow review, but we update the local state
                                        });
                                        toast({ title: "Templates Loaded", description: "Review and save each document." });
                                      }
                                    }}
                                  >
                                    <BrainCircuit className="h-4 w-4 mr-2" /> Generate SabiRight Content
                                  </Button>
                                </div>
                                <div className="space-y-8">
                                  {[
                                    { key: 'privacy_policy', label: 'Privacy Policy' },
                                    { key: 'terms_of_service', label: 'Terms of Service' },
                                    { key: 'cookie_policy', label: 'Cookie Policy' }
                                  ].map((item) => (
                                    <Card key={item.key} className="overflow-hidden">
                                      <CardHeader className="bg-slate-50/50 border-b">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <CardTitle className="text-lg">{item.label}</CardTitle>
                                            <CardDescription>Update the content for your {item.label.toLowerCase()}.</CardDescription>
                                          </div>
                                          <Button size="sm" onClick={() => handleSaveSetting(item.key, 'legal')}>
                                            <Save className="h-4 w-4 mr-2" /> Save {item.label}
                                          </Button>
                                        </div>
                                      </CardHeader>
                                      <CardContent className="p-0">
                                        <ReactQuill 
                                          theme="snow" 
                                          value={localSettings[item.key] ?? getSetting(item.key)} 
                                          onChange={(val) => handleSettingChange(item.key, val)}
                                          className="bg-white border-none min-h-[400px]"
                                          modules={{
                                            toolbar: [
                                              [{ 'header': [1, 2, 3, false] }],
                                              ['bold', 'italic', 'underline', 'strike'],
                                              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                              ['link', 'clean']
                                            ]
                                          }}
                                        />
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            )}

                            {frontendPage === "about" && (
                              <div className="space-y-6">
                                <Card>
                                  <CardHeader>
                                    <CardTitle>About Us Page</CardTitle>
                                    <p className="text-sm text-slate-500">Manage the content for the About Us page.</p>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="about_content">About Us Content</Label>
                                      <ReactQuill 
                                        theme="snow" 
                                        value={localSettings['about_content'] ?? getSetting('about_content')} 
                                        onChange={(val) => handleSettingChange('about_content', val)}
                                        className="bg-white min-h-[400px]"
                                        modules={{
                                          toolbar: [
                                            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                                            ['bold', 'italic', 'underline', 'strike'],
                                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                            [{ 'color': [] }, { 'background': [] }],
                                            ['link', 'image', 'clean']
                                          ]
                                        }}
                                      />
                                    </div>
                                    <Button size="sm" onClick={() => handleSaveSetting('about_content', 'frontend')}>
                                      <Save className="h-4 w-4 mr-2" /> Save About Us Content
                                    </Button>
                                  </CardContent>
                                </Card>
                              </div>
                            )}

                            {frontendPage === "contact" && (
                              <div className="space-y-6">
                                <Card>
                                  <CardHeader>
                                    <CardTitle>Contact Page</CardTitle>
                                    <p className="text-sm text-slate-500">Manage the content for the Contact page.</p>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="contact_content">Contact Page Content</Label>
                                      <ReactQuill 
                                        theme="snow" 
                                        value={localSettings['contact_content'] ?? getSetting('contact_content')} 
                                        onChange={(val) => handleSettingChange('contact_content', val)}
                                        className="bg-white min-h-[400px]"
                                        modules={{
                                          toolbar: [
                                            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                                            ['bold', 'italic', 'underline', 'strike'],
                                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                            [{ 'color': [] }, { 'background': [] }],
                                            ['link', 'image', 'clean']
                                          ]
                                        }}
                                      />
                                    </div>
                                    <Button size="sm" onClick={() => handleSaveSetting('contact_content', 'frontend')}>
                                      <Save className="h-4 w-4 mr-2" /> Save Contact Page Content
                                    </Button>
                                  </CardContent>
                                </Card>
                              </div>
                            )}

                            {frontendPage === "footer" && (
                              <div className="space-y-6">
                                <Card>
                                  <CardHeader>
                                    <CardTitle>Footer Information</CardTitle>
                                    <p className="text-sm text-slate-500">Manage global footer content and contact details.</p>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="footer_about">Footer About Text</Label>
                                      <Textarea
                                        id="footer_about"
                                        placeholder="SabiRight is Nigeria's unified platform..."
                                        value={localSettings['footer_about'] ?? getSetting('footer_about')}
                                        onChange={(e) => handleSettingChange('footer_about', e.target.value)}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="footer_address">Physical Address</Label>
                                      <Input
                                        id="footer_address"
                                        placeholder="Lagos, Nigeria"
                                        value={localSettings['footer_address'] ?? getSetting('footer_address')}
                                        onChange={(e) => handleSettingChange('footer_address', e.target.value)}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="footer_phone">Contact Phone</Label>
                                      <Input
                                        id="footer_phone"
                                        placeholder="+234 ..."
                                        value={localSettings['footer_phone'] ?? getSetting('footer_phone')}
                                        onChange={(e) => handleSettingChange('footer_phone', e.target.value)}
                                      />
                                    </div>
                                    
                                    <div className="pt-4 border-t mt-4">
                                      <h4 className="font-bold text-sm mb-4">Social Media Links</h4>
                                      <div className="grid md:grid-cols-2 gap-4">
                                        {[
                                          { key: 'social_facebook', label: 'Facebook URL' },
                                          { key: 'social_twitter', label: 'Twitter / X URL' },
                                          { key: 'social_instagram', label: 'Instagram URL' },
                                          { key: 'social_linkedin', label: 'LinkedIn URL' },
                                          { key: 'social_youtube', label: 'YouTube URL' },
                                          { key: 'social_whatsapp', label: 'WhatsApp Link' }
                                        ].map(social => (
                                          <div key={social.key} className="space-y-2">
                                            <Label htmlFor={social.key}>{social.label}</Label>
                                            <Input
                                              id={social.key}
                                              placeholder="https://..."
                                              value={localSettings[social.key] ?? getSetting(social.key)}
                                              onChange={(e) => handleSettingChange(social.key, e.target.value)}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <Button size="sm" onClick={() => {
                                      handleSaveSetting('footer_about', 'frontend');
                                      handleSaveSetting('footer_address', 'frontend');
                                      handleSaveSetting('footer_phone', 'frontend');
                                      ['social_facebook', 'social_twitter', 'social_instagram', 'social_linkedin', 'social_youtube', 'social_whatsapp'].forEach(key => {
                                        handleSaveSetting(key, 'social');
                                      });
                                    }}>
                                      <Save className="h-4 w-4 mr-2" /> Save Footer Info
                                    </Button>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </div>
                        </Tabs>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="mt-0">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Branding</CardTitle>
                  <p className="text-sm text-slate-500">Configure your platform's visual identity for light and dark modes.</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Site Title */}
                    <div className="space-y-2">
                      <Label htmlFor="site_title">Site Title</Label>
                      <div className="flex gap-2">
                        <Input
                          id="site_title"
                          placeholder="SabiRight"
                          value={localSettings['site_title'] ?? getSetting('site_title')}
                          onChange={(e) => handleSettingChange('site_title', e.target.value)}
                        />
                        <Button size="sm" onClick={() => handleSaveSetting('site_title', 'branding')}>
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Contact Email */}
                    <div className="space-y-2">
                      <Label htmlFor="contact_email">Support Email</Label>
                      <div className="flex gap-2">
                        <Input
                          id="contact_email"
                          placeholder="support@sabiright.com"
                          value={localSettings['contact_email'] ?? getSetting('contact_email')}
                          onChange={(e) => handleSettingChange('contact_email', e.target.value)}
                        />
                        <Button size="sm" onClick={() => handleSaveSetting('contact_email', 'contact')}>
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 pt-4 border-t">
                    {/* Light Mode Branding */}
                    <div className="space-y-6">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" /> Light Mode Assets
                      </h4>
                      
                      {/* Light Logo */}
                      <div className="space-y-2">
                        <Label htmlFor="site_logo">Light Logo URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="site_logo"
                            placeholder="https://example.com/logo-light.png"
                            value={localSettings['site_logo'] ?? getSetting('site_logo')}
                            onChange={(e) => handleSettingChange('site_logo', e.target.value)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => document.getElementById('logo-light-upload')?.click()}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <input type="file" id="logo-light-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'site_logo')} />
                          <Button size="sm" onClick={() => handleSaveSetting('site_logo', 'branding')}>
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="h-20 border rounded bg-slate-50 flex items-center justify-center p-2">
                          {(localSettings['site_logo'] ?? getSetting('site_logo')) ? <img src={localSettings['site_logo'] ?? getSetting('site_logo')} className="max-h-full" /> : <span className="text-xs text-slate-400">No logo</span>}
                        </div>
                      </div>

                      {/* Light Favicon */}
                      <div className="space-y-2">
                        <Label htmlFor="site_favicon">Light Favicon URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="site_favicon"
                            placeholder="https://example.com/favicon-light.ico"
                            value={localSettings['site_favicon'] ?? getSetting('site_favicon')}
                            onChange={(e) => handleSettingChange('site_favicon', e.target.value)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => document.getElementById('fav-light-upload')?.click()}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <input type="file" id="fav-light-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'site_favicon')} />
                          <Button size="sm" onClick={() => handleSaveSetting('site_favicon', 'branding')}>
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Dark Mode Branding */}
                    <div className="space-y-6">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <Star className="h-4 w-4 text-indigo-500 fill-indigo-500" /> Dark Mode Assets
                      </h4>
                      
                      {/* Dark Logo */}
                      <div className="space-y-2">
                        <Label htmlFor="site_logo_dark">Dark Logo URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="site_logo_dark"
                            placeholder="https://example.com/logo-dark.png"
                            value={localSettings['site_logo_dark'] ?? getSetting('site_logo_dark')}
                            onChange={(e) => handleSettingChange('site_logo_dark', e.target.value)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => document.getElementById('logo-dark-upload')?.click()}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <input type="file" id="logo-dark-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'site_logo_dark')} />
                          <Button size="sm" onClick={() => handleSaveSetting('site_logo_dark', 'branding')}>
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="h-20 border rounded bg-slate-900 flex items-center justify-center p-2">
                          {(localSettings['site_logo_dark'] ?? getSetting('site_logo_dark')) ? <img src={localSettings['site_logo_dark'] ?? getSetting('site_logo_dark')} className="max-h-full" /> : <span className="text-xs text-slate-400">No logo</span>}
                        </div>
                      </div>

                      {/* Dark Favicon */}
                      <div className="space-y-2">
                        <Label htmlFor="site_favicon_dark">Dark Favicon URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="site_favicon_dark"
                            placeholder="https://example.com/favicon-dark.ico"
                            value={localSettings['site_favicon_dark'] ?? getSetting('site_favicon_dark')}
                            onChange={(e) => handleSettingChange('site_favicon_dark', e.target.value)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => document.getElementById('fav-dark-upload')?.click()}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <input type="file" id="fav-dark-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'site_favicon_dark')} />
                          <Button size="sm" onClick={() => handleSaveSetting('site_favicon_dark', 'branding')}>
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Video Snippet Management</CardTitle>
                  <p className="text-sm text-slate-500">Manage the video featured on the homepage.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="video_demo_url">Homepage Video URL (YouTube Link)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="video_demo_url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={localSettings['video_demo_url'] ?? getSetting('video_demo_url')}
                        onChange={(e) => handleSettingChange('video_demo_url', e.target.value)}
                      />
                      <Button size="sm" onClick={() => handleSaveSetting('video_demo_url', 'branding')}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-500">Paste a YouTube link here. The platform will automatically convert it to an embeddable format.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Social Media Links</CardTitle>
                  <p className="text-sm text-slate-500">Configure the social media links shown in the footer.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'whatsapp'].map((platform) => (
                      <div key={platform} className="space-y-2">
                        <Label htmlFor={`social_${platform}`} className="capitalize">{platform}</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`social_${platform}`}
                            placeholder={`https://${platform}.com/sabiright`}
                            value={localSettings[`social_${platform}`] ?? getSetting(`social_${platform}`)}
                            onChange={(e) => handleSettingChange(`social_${platform}`, e.target.value)}
                          />
                          <Button size="sm" onClick={() => handleSaveSetting(`social_${platform}`, 'social')}>
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Color Settings</CardTitle>
                  <p className="text-sm text-slate-500">Manage the primary and secondary colors for your platform branding.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Primary Color */}
                    <div className="space-y-2">
                      <Label htmlFor="primary_color">Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primary_color"
                          type="color"
                          className="w-12 h-10 p-1"
                          value={localSettings['primary_color'] ?? getSetting('primary_color') ?? '#3b82f6'}
                          onChange={(e) => handleSettingChange('primary_color', e.target.value)}
                        />
                        <Input
                          placeholder="#3b82f6"
                          value={localSettings['primary_color'] ?? getSetting('primary_color') ?? '#3b82f6'}
                          onChange={(e) => handleSettingChange('primary_color', e.target.value)}
                        />
                        <Button size="sm" onClick={() => handleSaveSetting('primary_color', 'branding')}>
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Secondary Color */}
                    <div className="space-y-2">
                      <Label htmlFor="secondary_color">Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="secondary_color"
                          type="color"
                          className="w-12 h-10 p-1"
                          value={localSettings['secondary_color'] ?? getSetting('secondary_color') ?? '#1e293b'}
                          onChange={(e) => handleSettingChange('secondary_color', e.target.value)}
                        />
                        <Input
                          placeholder="#1e293b"
                          value={localSettings['secondary_color'] ?? getSetting('secondary_color') ?? '#1e293b'}
                          onChange={(e) => handleSettingChange('secondary_color', e.target.value)}
                        />
                        <Button size="sm" onClick={() => handleSaveSetting('secondary_color', 'branding')}>
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SEO & Metadata</CardTitle>
                  <p className="text-sm text-slate-500">Optimize how your platform appears in search engines.</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="seo_description">Meta Description</Label>
                    <div className="flex gap-2">
                      <Textarea
                        id="seo_description"
                        placeholder="SabiRight is a comprehensive platform for..."
                        value={localSettings['seo_description'] ?? getSetting('seo_description')}
                        onChange={(e) => handleSettingChange('seo_description', e.target.value)}
                      />
                      <Button size="sm" onClick={() => handleSaveSetting('seo_description', 'seo')}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seo_keywords">Meta Keywords</Label>
                    <div className="flex gap-2">
                      <Input
                        id="seo_keywords"
                        placeholder="AI, Governance, Community, Nigeria"
                        value={localSettings['seo_keywords'] ?? getSetting('seo_keywords')}
                        onChange={(e) => handleSettingChange('seo_keywords', e.target.value)}
                      />
                      <Button size="sm" onClick={() => handleSaveSetting('seo_keywords', 'seo')}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-500">Comma-separated list of keywords for SEO.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="og_image">Open Graph Image URL (SEO)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="og_image"
                        placeholder="https://example.com/og-image.jpg"
                        value={localSettings['og_image'] ?? getSetting('og_image')}
                        onChange={(e) => handleSettingChange('og_image', e.target.value)}
                      />
                      <div className="flex gap-2">
                        <input
                          type="file"
                          id="og-image-upload"
                          className="hidden"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const formData = new FormData();
                              formData.append('file', file);
                              try {
                                const res = await fetch('/api/upload', {
                                  method: 'POST',
                                  body: formData
                                });
                                const data = await res.json();
                                if (data.url) {
                                  handleSettingChange('og_image', data.url);
                                  toast({ title: "Uploaded", description: "OG Image uploaded. Click save to apply." });
                                }
                              } catch (err) {
                                toast({ title: "Upload Failed", description: "Failed to upload image", variant: "destructive" });
                              }
                            }
                          }}
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => document.getElementById('og-image-upload')?.click()}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button size="sm" onClick={() => handleSaveSetting('og_image', 'seo')}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-500">The image displayed when your site is shared on social media (1200x630 recommended).</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Footer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                      <Label htmlFor="footer_text">Footer Copyright Text</Label>
                      <div className="flex gap-2">
                        <Input
                          id="footer_text"
                          placeholder="© 2024 SabiRight. All rights reserved."
                          value={localSettings['footer_text'] ?? getSetting('footer_text')}
                          onChange={(e) => handleSettingChange('footer_text', e.target.value)}
                        />
                        <Button size="sm" onClick={() => handleSaveSetting('footer_text', 'branding')}>
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-4">
                      <Label className="text-sm font-bold">Social Media Links</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(socialLinks).map(([platform, value]) => (
                          <div key={platform} className="space-y-1">
                            <Label htmlFor={`social_${platform}`} className="text-xs capitalize">{platform}</Label>
                            <Input
                              id={`social_${platform}`}
                              placeholder={`https://${platform}.com/yourprofile`}
                              value={value}
                              onChange={(e) => setSocialLinks(prev => ({ ...prev, [platform]: e.target.value }))}
                              className="h-8 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                      <Button 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => {
                          saveSetting.mutate({ 
                            key: 'social_links', 
                            value: JSON.stringify(socialLinks), 
                            category: 'branding' 
                          });
                        }}
                      >
                        <Save className="h-4 w-4 mr-2" /> Save Social Links
                      </Button>
                    </div>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50/30">
                <CardHeader>
                  <CardTitle className="text-red-700">Data Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-red-100 rounded-lg bg-white">
                    <div>
                      <h4 className="font-bold text-slate-800">Export All Data</h4>
                      <p className="text-sm text-slate-500">Download a complete backup of the system database (JSON format).</p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => setConfirmAction({
                        type: 'export',
                        title: 'Export Database',
                        description: 'Are you sure you want to export the entire database? This may contain sensitive information.'
                      })}
                    >
                      <Download className="h-4 w-4 mr-2" /> Export Database
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-blue-100 rounded-lg bg-white">
                    <div>
                      <h4 className="font-bold text-blue-800">Export MOAT Data</h4>
                      <p className="text-sm text-slate-500">Download MOAT intelligence data for model training (JSON format).</p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={handleExportMoatData}
                    >
                      <Download className="h-4 w-4 mr-2" /> Export MOAT Data
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-red-100 rounded-lg bg-white">
                    <div>
                      <h4 className="font-bold text-red-700">Clear System Cache</h4>
                      <p className="text-sm text-slate-500">Force refresh all system caches and sessions.</p>
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setConfirmAction({
                        type: 'cache',
                        title: 'Clear System Cache',
                        description: 'This will force all users to re-authenticate and clear temporary server data. Continue?'
                      })}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Clear Cache
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Push Notification Configuration Guide */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-purple-500" />
                    Push Notification Configuration Guide
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-sm mb-2">Step 1: Firebase Project Setup</h4>
                    <p className="text-sm text-slate-600 mb-2">
                      1. Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Firebase Console</a>.<br />
                      2. Select your project or create a new one.<br />
                      3. Go to <strong>Project Settings</strong> (gear icon) &gt; <strong>Service Accounts</strong>.<br />
                      4. Click <strong>Generate New Private Key</strong> and download the JSON file.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-sm mb-2">Step 2: Server-Side Configuration</h4>
                    <p className="text-sm text-slate-600 mb-2">
                      1. Open your server environment variables or <code>.env</code> file.<br />
                      2. Add the content of the downloaded JSON file to <code>FIREBASE_SERVICE_ACCOUNT</code>.<br />
                      3. Ensure <code>FIREBASE_PROJECT_ID</code> is also set correctly.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-sm mb-2">Step 3: Client-Side Configuration</h4>
                    <p className="text-sm text-slate-600 mb-2">
                      1. Go to <strong>Project Settings</strong> &gt; <strong>General</strong> &gt; <strong>Your Apps</strong>.<br />
                      2. Add a Web App if you haven't already.<br />
                      3. Copy the <code>firebaseConfig</code> object and update it in your client-side config file.<br />
                      4. Go to <strong>Cloud Messaging</strong> tab and generate a <strong>VAPID key</strong> in the Web configuration section.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-sm mb-2">Step 4: User Subscription</h4>
                    <p className="text-sm text-slate-600 mb-2">
                      Users will be prompted to allow notifications when they log in or visit the settings page. Once they allow, their device token is securely stored and linked to their profile.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
                    <AlertTriangle className="h-5 w-5" />
                    <p className="text-xs font-medium">
                      Note: Push notifications require a secure (HTTPS) connection or localhost to work in modern browsers.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys">
            <div className="grid gap-6">
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">AI Configuration</CardTitle>
                      <CardDescription>Configure the primary AI engines powering your platform features.</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Enterprise Ready
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8 bg-slate-50/30">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="p-4 bg-white rounded-xl border shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Settings className="h-4 w-4 text-blue-600" />
                          </div>
                          <h3 className="font-bold text-sm">Provider Selection</h3>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Primary AI Model</Label>
                          <Select 
                            value={localSettings['ai_provider'] ?? getSetting('ai_provider') ?? 'google'}
                            onValueChange={(v) => handleSettingChange('ai_provider', v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="google">Google Gemini Pro (Default)</SelectItem>
                              <SelectItem value="openai">OpenAI GPT-4o</SelectItem>
                              <SelectItem value="anthropic">Anthropic Claude 3.5</SelectItem>
                              <SelectItem value="deepseek">DeepSeek V3 (Free/Fast)</SelectItem>
                              <SelectItem value="groq">Groq (Llama 3/Mixtral) - Free/Fast</SelectItem>
                              <SelectItem value="openrouter">OpenRouter (Multi-Provider)</SelectItem>
                              <SelectItem value="perplexity">Perplexity (Search AI)</SelectItem>
                              <SelectItem value="mistral">Mistral AI (Open Source)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-slate-500">The default model used for intelligent suggestions and automated tasks.</p>
                        </div>
                        <Button className="w-full h-9" size="sm" onClick={() => handleSaveSetting('ai_provider', 'ai')}>
                          Update Provider
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">AI Credentials</h3>
                        <div className="grid gap-4">
                          <ApiKeyField 
                            label="Google Gemini API Key" 
                            id="google_gemini_api_key" 
                            category="ai" 
                            placeholder="AIzaSy..." 
                            description="Used for main content analysis and chatbot."
                          />
                          <ApiKeyField 
                            label="OpenAI API Key" 
                            id="openai_api_key" 
                            category="ai" 
                            placeholder="sk-..." 
                            description="Backup provider for complex reasoning tasks."
                          />
                          <ApiKeyField 
                            label="Anthropic Claude API Key" 
                            id="anthropic_api_key" 
                            category="ai" 
                            placeholder="sk-ant-..." 
                            description="Claude 3.5 Sonnet/Opus for high-quality generation."
                          />
                          <ApiKeyField 
                            label="Groq API Key" 
                            id="groq_api_key" 
                            category="ai" 
                            placeholder="gsk_..." 
                            description="Fast & Free Llama 3 / Mixtral models via Groq Cloud."
                          />
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Free AI Models</h3>
                        <div className="grid gap-4">
                          <ApiKeyField 
                            label="DeepSeek API Key" 
                            id="deepseek_api_key" 
                            category="ai" 
                            placeholder="sk-..." 
                            description="DeepSeek Coder/Chat - High performance free/cheap alternative."
                          />
                          <ApiKeyField 
                            label="OpenRouter API Key" 
                            id="openrouter_api_key" 
                            category="ai" 
                            placeholder="sk-or-..." 
                            description="Access multiple free models (Llama, Mistral, etc) via OpenRouter."
                          />
                          <ApiKeyField 
                            label="HuggingFace Token" 
                            id="huggingface_api_key" 
                            category="ai" 
                            placeholder="hf_..." 
                            description="Access thousands of open-source models for free."
                          />
                          <ApiKeyField 
                            label="Perplexity API Key" 
                            id="perplexity_api_key" 
                            category="ai" 
                            placeholder="pplx-..." 
                            description="Search-augmented AI generation."
                          />
                          <ApiKeyField 
                            label="Mistral API Key" 
                            id="mistral_api_key" 
                            category="ai" 
                            placeholder="sk-..." 
                            description="Access high-performance open-source models via Mistral AI."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Infrastructure & Maps</h3>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="link" size="sm" className="h-auto p-0 text-[10px] text-blue-600 font-bold uppercase tracking-tight">
                                Setup Guide
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Google Maps API Setup Guide</DialogTitle>
                                <DialogDescription>
                                  Follow these steps to enable SabiMove and location services.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <h4 className="font-bold text-sm">1. Create a Google Cloud Project</h4>
                                  <p className="text-sm text-slate-600">Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline">Google Cloud Console</a> and create a new project.</p>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="font-bold text-sm">2. Enable Required APIs</h4>
                                  <p className="text-sm text-slate-600">Search for and enable the following APIs in your project:</p>
                                  <ul className="list-disc list-inside text-sm text-slate-600 ml-2">
                                    <li>Maps JavaScript API (for map display)</li>
                                    <li>Geocoding API (for address search)</li>
                                    <li>Directions API (for route calculation)</li>
                                    <li>Distance Matrix API (for traffic analysis)</li>
                                  </ul>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="font-bold text-sm">3. Create API Key</h4>
                                  <p className="text-sm text-slate-600">Go to <strong>APIs &amp; Services &gt; Credentials</strong>, click <strong>Create Credentials &gt; API Key</strong>.</p>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="font-bold text-sm">4. Restrict Your Key (Recommended)</h4>
                                  <p className="text-sm text-slate-600">Restrict the key to only the APIs listed above to prevent unauthorized usage and stay within free tier limits.</p>
                                </div>
                                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                                  <p className="text-xs text-blue-800 leading-relaxed">
                                    <strong>Pro Tip:</strong> SabiMove uses these APIs to provide real-time traffic updates and "cloaked" route status. Ensure your billing is active on Google Cloud to avoid service interruptions.
                                  </p>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        <div className="grid gap-4">
                          <ApiKeyField 
                            label="Google Maps API Key" 
                            id="google_maps_api_key" 
                            category="maps" 
                            placeholder="AIza..." 
                            description="Powers SabiMove, location search, and service radius mapping."
                          />
                        </div>
                      </div>

                      <div className="space-y-4 pt-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Security (reCAPTCHA v3)</h3>
                        <div className="grid gap-4">
                          <ApiKeyField 
                            label="Site Key" 
                            id="captcha_site_key" 
                            category="security" 
                            isSecret={false}
                            placeholder="Public Site Key" 
                          />
                          <ApiKeyField 
                            label="Secret Key" 
                            id="captcha_secret_key" 
                            category="security" 
                            placeholder="Private Secret Key" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                        <LogIn className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">Google Authentication (SSO)</h3>
                        <p className="text-[10px] text-slate-500">Configure OAuth 2.0 for one-click user sign-in.</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6 bg-white p-4 rounded-xl border shadow-sm">
                      <ApiKeyField 
                        label="Client ID" 
                        id="google_client_id" 
                        category="auth" 
                        isSecret={false}
                        placeholder="xxx.apps.googleusercontent.com" 
                      />
                      <ApiKeyField 
                        label="Client Secret" 
                        id="google_client_secret" 
                        category="auth" 
                        placeholder="GOCSPX-..." 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="email-templates">
            <div className="space-y-6">
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Rich Email Templates</CardTitle>
                      <CardDescription>Manage beautiful, formatted email communications for your users.</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <Mail className="h-3 w-3 mr-1" /> Rich Formatting
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6 bg-slate-50/30">
                  {/* Variable Guide */}
                  <div className="p-4 bg-white rounded-xl border shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <HelpCircle className="h-4 w-4 text-blue-600" />
                      </div>
                      <h3 className="font-bold text-sm">Template Variable Guide</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <code className="text-blue-600 font-bold">{"{{userName}}"}</code>
                        <p className="text-slate-500 mt-1">Recipient's full name</p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <code className="text-blue-600 font-bold">{"{{code}}"}</code>
                        <p className="text-slate-500 mt-1">Verification code</p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <code className="text-blue-600 font-bold">{"{{expiry}}"}</code>
                        <p className="text-slate-500 mt-1">Code expiry time</p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <code className="text-blue-600 font-bold">{"{{appName}}"}</code>
                        <p className="text-slate-500 mt-1">SabiRight</p>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-800">Email Identity Tip</p>
                          <p className="text-[10px] text-amber-700 leading-relaxed mt-1">
                            To show your logo in the recipient's inbox (as a profile image), associate your "From Email" address with a <a href="https://gravatar.com" target="_blank" rel="noreferrer" className="underline font-bold">Gravatar</a> account or a Google Workspace profile. We automatically include your favicon in the email body.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Template Editor */}
                  <div className="p-6 bg-white rounded-xl border shadow-sm space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                        <Plus className="h-4 w-4 text-green-600" />
                      </div>
                      <h3 className="font-bold text-sm">Create New Email Template</h3>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Template Name</Label>
                        <Input 
                          className="h-9"
                          placeholder="e.g., Welcome Email"
                          value={newTemplate.name}
                          onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Subject Line</Label>
                        <Input 
                          className="h-9"
                          placeholder="e.g., Welcome to SabiRight!"
                          value={newTemplate.subject}
                          onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Email Body (Rich Text Editor)</Label>
                      <div className="bg-white rounded-xl border overflow-hidden shadow-inner">
                        <ReactQuill 
                          theme="snow"
                          value={newTemplate.bodyTemplate}
                          onChange={(content) => setNewTemplate({ ...newTemplate, bodyTemplate: content })}
                          modules={{
                            toolbar: [
                              [{ 'header': [1, 2, 3, false] }],
                              ['bold', 'italic', 'underline', 'strike'],
                              [{ 'color': [] }, { 'background': [] }],
                              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                              ['link', 'image'],
                              ['clean']
                            ],
                          }}
                          className="h-80 mb-12"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        size="sm"
                        onClick={() => {
                          createTemplate.mutate({
                            ...newTemplate,
                            channels: ['email'],
                            type: 'transactional'
                          });
                        }}
                        disabled={createTemplate.isPending || !newTemplate.name || !newTemplate.subject}
                        className="bg-blue-600 hover:bg-blue-700 h-9"
                      >
                        {createTemplate.isPending ? "Creating..." : "Create Email Template"}
                      </Button>
                    </div>
                  </div>

                  {/* Existing Email Templates */}
                  <div className="space-y-4 pt-6 border-t">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Manage Templates</h3>
                    <div className="grid gap-4">
                      {notificationTemplates.filter((t: any) => t.channels?.includes('email')).map((template: any) => (
                        <div key={template.id} className="p-5 bg-white rounded-xl border shadow-sm transition-all hover:shadow-md">
                          {editingTemplate?.id === template.id ? (
                            <div className="space-y-5">
                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold uppercase text-slate-400">Subject</Label>
                                  <Input 
                                    className="h-9"
                                    value={editingTemplate.subject}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold uppercase text-slate-400">Template Name</Label>
                                  <Input 
                                    className="h-9"
                                    value={editingTemplate.name}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase text-slate-400">Body Content</Label>
                                <div className="bg-white rounded-xl border overflow-hidden">
                                  <ReactQuill 
                                    theme="snow"
                                    value={editingTemplate.bodyTemplate}
                                    onChange={(content) => setEditingTemplate({ ...editingTemplate, bodyTemplate: content })}
                                    className="h-64 mb-12"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="outline" onClick={() => setEditingTemplate(null)} className="h-8">Cancel</Button>
                                <Button size="sm" onClick={() => updateTemplate.mutate({ templateId: template.id, updates: editingTemplate })} className="h-8 bg-blue-600">Save Changes</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h5 className="font-bold text-slate-900">{template.name}</h5>
                                  <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-slate-100 text-slate-600">{template.type}</Badge>
                                </div>
                                <p className="text-sm text-slate-500 font-medium">{template.subject}</p>
                                <div className="mt-2 text-xs text-slate-400 line-clamp-1 italic" dangerouslySetInnerHTML={{ __html: template.bodyTemplate.substring(0, 100) + '...' }} />
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button size="sm" variant="outline" onClick={() => setEditingTemplate(template)} className="h-8 w-8 p-0">
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => deleteTemplate.mutate(template.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {notificationTemplates.filter((t: any) => t.channels?.includes('email')).length === 0 && (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                          <Mail className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-slate-400 text-sm">No email templates found.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="plans">
            <div className="space-y-6">
              {/* Create New Plan */}
              <Card>
                <CardHeader>
                  <CardTitle>Create New Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label>Plan Name</Label>
                      <Input
                        placeholder="e.g. Basic Monthly"
                        value={newPlan.name}
                        onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                      />
                      <p className="text-[10px] text-slate-500">Public name of the subscription plan</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Tier Level</Label>
                      <select
                        className="w-full h-10 px-3 border rounded-md text-sm"
                        value={newPlan.type}
                        onChange={(e) => setNewPlan({ ...newPlan, type: e.target.value })}
                      >
                        <option value="free">Free</option>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                      <p className="text-[10px] text-slate-500">Service tier for feature access</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Target Audience</Label>
                      <select
                        className="w-full h-10 px-3 border rounded-md text-sm"
                        value={newPlan.userType}
                        onChange={(e) => setNewPlan({ ...newPlan, userType: e.target.value })}
                      >
                        <option value="user">Regular User</option>
                        <option value="vendor">Service Vendor</option>
                      </select>
                      <p className="text-[10px] text-slate-500">Who can subscribe to this plan</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Price (NGN)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={newPlan.price}
                        onChange={(e) => setNewPlan({ ...newPlan, price: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-[10px] text-slate-500">Monthly billing amount in Naira</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Credit Allowance</Label>
                      <Input
                        type="number"
                        placeholder="10"
                        value={newPlan.credits}
                        onChange={(e) => setNewPlan({ ...newPlan, credits: parseInt(e.target.value) || 10 })}
                      />
                      <p className="text-[10px] text-slate-500">Credits provided per month/refresh</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Plan Description</Label>
                      <Input
                        placeholder="Features, benefits..."
                        value={newPlan.description}
                        onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                      />
                      <p className="text-[10px] text-slate-500">Short summary of plan features</p>
                    </div>
                  </div>
                  <Button 
                    className="mt-6" 
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
                        <div className="space-y-1.5">
                          <Label>Package Name</Label>
                          <Input
                            placeholder="e.g., Starter Pack"
                            value={newCreditPackage.name}
                            onChange={(e) => setNewCreditPackage({ ...newCreditPackage, name: e.target.value })}
                          />
                          <p className="text-[10px] text-slate-500">Public name of the credit bundle</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Credits</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={newCreditPackage.credits}
                            onChange={(e) => setNewCreditPackage({ ...newCreditPackage, credits: parseInt(e.target.value) || 0 })}
                          />
                          <p className="text-[10px] text-slate-500">Base number of credits in this package</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Price (NGN)</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={newCreditPackage.price}
                            onChange={(e) => setNewCreditPackage({ ...newCreditPackage, price: parseInt(e.target.value) || 0 })}
                          />
                          <p className="text-[10px] text-slate-500">Cost to purchase this bundle</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Bonus Credits (optional)</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={newCreditPackage.bonus}
                            onChange={(e) => setNewCreditPackage({ ...newCreditPackage, bonus: parseInt(e.target.value) || 0 })}
                          />
                          <p className="text-[10px] text-slate-500">Extra credits given as an incentive</p>
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Description</Label>
                          <Input
                            placeholder="e.g. Best for small businesses"
                            value={newCreditPackage.description}
                            onChange={(e) => setNewCreditPackage({ ...newCreditPackage, description: e.target.value })}
                          />
                          <p className="text-[10px] text-slate-500">Short summary of package value</p>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <Checkbox
                            checked={newCreditPackage.popular}
                            onCheckedChange={(checked) => setNewCreditPackage({ ...newCreditPackage, popular: checked as boolean })}
                          />
                          <Label>Mark as Popular</Label>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
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
                          {editingPackage?.id === pkg.id ? (
                            <div className="space-y-3">
                              <div className="grid md:grid-cols-2 gap-3">
                                <Input
                                  value={editingPackage.name}
                                  onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                                />
                                <Input
                                  type="number"
                                  value={editingPackage.credits}
                                  onChange={(e) => setEditingPackage({ ...editingPackage, credits: parseInt(e.target.value) || 0 })}
                                />
                                <Input
                                  type="number"
                                  value={editingPackage.price}
                                  onChange={(e) => setEditingPackage({ ...editingPackage, price: parseInt(e.target.value) || 0 })}
                                />
                                <Input
                                  type="number"
                                  value={editingPackage.bonus}
                                  onChange={(e) => setEditingPackage({ ...editingPackage, bonus: parseInt(e.target.value) || 0 })}
                                />
                                <Input
                                  className="md:col-span-2"
                                  value={editingPackage.description}
                                  onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })}
                                />
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={editingPackage.popular}
                                    onCheckedChange={(checked) => setEditingPackage({ ...editingPackage, popular: checked as boolean })}
                                  />
                                  <Label>Popular</Label>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => updateCreditPackage.mutate({ 
                                  packageId: pkg.id, 
                                  updates: { 
                                    name: editingPackage.name,
                                    credits: editingPackage.credits,
                                    price: editingPackage.price,
                                    bonus: editingPackage.bonus,
                                    description: editingPackage.description,
                                    popular: editingPackage.popular
                                  }
                                })}>
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingPackage(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
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
                            </>
                          )}
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
                        <Label>Referral Signup Reward (to new user)</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_reward_referral'] ?? getSetting('credit_reward_referral') ?? '10'}
                          onChange={(e) => handleSettingChange('credit_reward_referral', e.target.value)}
                          placeholder="10"
                        />
                      </div>
                      <div>
                        <Label>Referrer Bonus (to referrer)</Label>
                        <Input
                          type="number"
                          value={localSettings['referral_reward_credits'] ?? getSetting('referral_reward_credits') ?? '50'}
                          onChange={(e) => handleSettingChange('referral_reward_credits', e.target.value)}
                          placeholder="50"
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
                        <Label>Verify Email</Label>
                        <Input
                          type="number"
                          value={localSettings['credit_reward_email_verification'] ?? getSetting('credit_reward_email_verification') ?? '20'}
                          onChange={(e) => handleSettingChange('credit_reward_email_verification', e.target.value)}
                          placeholder="20"
                        />
                      </div>
                    </div>
                    <Button onClick={() => {
                      handleSaveSetting('credit_reward_post_like', 'credit_rewards', false);
                      handleSaveSetting('credit_reward_post_comment', 'credit_rewards', false);
                      handleSaveSetting('credit_reward_referral', 'credit_rewards', false);
                      handleSaveSetting('referral_reward_credits', 'credit_rewards', false);
                      handleSaveSetting('credit_reward_daily_login', 'credit_rewards', false);
                      handleSaveSetting('credit_reward_complete_profile', 'credit_rewards', false);
                      handleSaveSetting('credit_reward_email_verification', 'credit_rewards', false);
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
                          {window.location.origin}/api/payments/flutterwave/webhook
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
                      <p className="text-xs text-slate-500 mt-2">
                        💡 <strong>Webhook URL:</strong> Configure this in your Paystack dashboard:<br/>
                        <code className="bg-slate-100 px-2 py-1 rounded text-xs">
                          {window.location.origin}/api/payments/paystack/webhook
                        </code>
                      </p>
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
                <Tabs defaultValue="manual-pending" className="space-y-4">
                  <TabsList className="bg-slate-100 p-1">
                    <TabsTrigger value="manual-pending" className="text-xs">Manual Pending</TabsTrigger>
                    <TabsTrigger value="manual-completed" className="text-xs">Manual Completed</TabsTrigger>
                    <TabsTrigger value="automatic" className="text-xs">Automatic</TabsTrigger>
                    <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual-pending" className="space-y-3">
                    {payments.filter((p: any) => p.status === 'pending' && p.paymentMethod !== 'stripe' && p.paymentMethod !== 'paystack' && p.paymentMethod !== 'flutterwave').length === 0 ? (
                      <p className="text-center py-8 text-slate-400">No pending manual payments</p>
                    ) : (
                      payments.filter((p: any) => p.status === 'pending' && p.paymentMethod !== 'stripe' && p.paymentMethod !== 'paystack' && p.paymentMethod !== 'flutterwave')
                        .map((p: any) => <PaymentItem key={p.id} payment={p} isManual={true} />)
                    )}
                  </TabsContent>

                  <TabsContent value="manual-completed" className="space-y-3">
                    {payments.filter((p: any) => p.status === 'completed' && p.paymentMethod !== 'stripe' && p.paymentMethod !== 'paystack' && p.paymentMethod !== 'flutterwave').length === 0 ? (
                      <p className="text-center py-8 text-slate-400">No completed manual payments</p>
                    ) : (
                      payments.filter((p: any) => p.status === 'completed' && p.paymentMethod !== 'stripe' && p.paymentMethod !== 'paystack' && p.paymentMethod !== 'flutterwave')
                        .map((p: any) => <PaymentItem key={p.id} payment={p} isManual={true} />)
                    )}
                  </TabsContent>

                  <TabsContent value="automatic" className="space-y-3">
                    {payments.filter((p: any) => ['stripe', 'paystack', 'flutterwave'].includes(p.paymentMethod)).length === 0 ? (
                      <p className="text-center py-8 text-slate-400">No automatic payments yet</p>
                    ) : (
                      payments.filter((p: any) => ['stripe', 'paystack', 'flutterwave'].includes(p.paymentMethod))
                        .map((p: any) => <PaymentItem key={p.id} payment={p} isManual={false} />)
                    )}
                  </TabsContent>

                  <TabsContent value="all" className="space-y-3">
                    {payments.length === 0 ? (
                      <p className="text-center py-8 text-slate-400">No transactions yet</p>
                    ) : (
                      payments.map((p: any) => (
                        <PaymentItem 
                          key={p.id} 
                          payment={p} 
                          isManual={!['stripe', 'paystack', 'flutterwave'].includes(p.paymentMethod)} 
                        />
                      ))
                    )}
                  </TabsContent>
                </Tabs>
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
                          <div className="flex-1">
                            <p className="font-bold text-sm md:text-base">{user.displayName || 'Unknown'}</p>
                            <p className="text-xs md:text-sm text-slate-500 truncate">{user.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] md:text-xs">
                                Credits: {user.credits || 0}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] md:text-xs">
                                Storage: {Math.round((user.chatStorageUsed || 0) / 1024)}KB / {Math.round((user.chatStorageLimit || 524288) / 1024)}KB
                              </Badge>
                              {user.planId && (
                                <Badge variant="secondary" className="text-[10px] md:text-xs">
                                  Plan: {user.planId}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-[10px] md:text-xs ${
                              user.emailVerificationStatus === 'verified' ? 'bg-green-100 text-green-800' : 
                              user.emailVerificationStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              Email: {user.emailVerificationStatus || 'pending'}
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
                          <div className="flex items-center gap-2 mr-auto">
                            <Input
                              type="number"
                              placeholder="KB"
                              className="w-24 h-8"
                              value={selectedUserForStorage === user.userId ? storageAmount : ""}
                              onChange={(e) => {
                                setSelectedUserForStorage(user.userId);
                                setStorageAmount(e.target.value);
                              }}
                            />
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8"
                              onClick={() => {
                                if (!storageAmount) return;
                                updateStorageLimit.mutate({ 
                                  userId: user.userId, 
                                  limitBytes: parseInt(storageAmount) * 1024 
                                });
                                setStorageAmount("");
                                setSelectedUserForStorage(null);
                              }}
                              disabled={updateStorageLimit.isPending}
                            >
                              Set Storage
                            </Button>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setViewingUser(user)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingUser(user)}>
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => impersonateUser.mutate(user.userId)}
                            disabled={impersonateUser.isPending}
                          >
                            <LogIn className="h-4 w-4 mr-1" /> Login as User
                          </Button>

                          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
                          
                          {/* Email Verification Actions */}
                          {user.emailVerificationStatus === 'pending' && (
                            <>
                              <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => approveEmail.mutate(user.userId)}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Verify Email
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => rejectEmail.mutate(user.userId)}
                              >
                                <XCircle className="h-4 w-4 mr-1" /> Reject Email
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
                              Set
                            </Button>
                          </div>

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
                            <Trash2 className="h-4 w-4" />
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
          <TabsContent value="vendor-services">
            <Card>
              <CardHeader>
                <CardTitle>Vendor Service Approval</CardTitle>
                <CardDescription>Review and approve service listings from vendors</CardDescription>
              </CardHeader>
              <CardContent>
                {adminVendorServices.length === 0 ? (
                  <p className="text-center py-8 text-slate-400">No service listings to review</p>
                ) : (
                  <div className="space-y-4">
                    {adminVendorServices.map((service: any) => (
                      <div key={service.id} className="p-4 border rounded-lg flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-lg">{service.name}</h4>
                            <Badge className={
                              service.status === 'approved' ? 'bg-green-100 text-green-800' :
                              service.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {service.status || 'pending'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600">{service.description}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" /> Vendor ID: {service.vendorId}</span>
                            <span className="flex items-center gap-1"><Coins className="h-3 w-3" /> Price: NGN {service.price}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Location: {service.location}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {service.status !== 'approved' && (
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => approveVendorService.mutate(service.id)}
                              disabled={approveVendorService.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                            </Button>
                          )}
                          {service.status !== 'rejected' && (
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => rejectVendorService.mutate(service.id)}
                              disabled={rejectVendorService.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Active Vendors</CardTitle>
                </CardHeader>
                <CardContent>
                  {vendors.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">No active vendors yet</p>
                  ) : (
                    <div className="space-y-3">
                      {vendors.map((vendor: any) => (
                        <div key={vendor.userId} className="p-3 md:p-4 border rounded-lg">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-bold text-sm md:text-base">{vendor.displayName || 'Unknown'}</p>
                              <p className="text-xs md:text-sm text-slate-500">{vendor.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px] md:text-xs">
                                  Plan: {vendor.planId || 'None'}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] md:text-xs">
                                  Credits: {vendor.credits || 0}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => setEditingVendor(vendor)}>
                                <Edit className="h-4 w-4 mr-1" /> Edit
                              </Button>
                              <Button 
                                size="sm" 
                                variant="secondary"
                                onClick={() => impersonateUser.mutate(vendor.userId)}
                              >
                                <LogIn className="h-4 w-4 mr-1" /> Login as Vendor
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vendor Service Listings</CardTitle>
                </CardHeader>
                <CardContent>
                  {adminVendorServices.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">No service listings found</p>
                  ) : (
                    <div className="space-y-4">
                      {adminVendorServices.map((service: any) => (
                        <div key={service.id} className="p-4 border rounded-lg">
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg">{service.name}</h3>
                                <Badge className={
                                  service.status === 'approved' ? 'bg-green-100 text-green-800' :
                                  service.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }>
                                  {service.status || 'pending'}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 mb-2">{service.description}</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="bg-slate-50 p-2 rounded">
                                  <p className="text-slate-500 uppercase font-bold">Category</p>
                                  <p>{service.category}</p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded">
                                  <p className="text-slate-500 uppercase font-bold">Price</p>
                                  <p>{service.price} Credits</p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded">
                                  <p className="text-slate-500 uppercase font-bold">Duration</p>
                                  <p>{service.duration}</p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded">
                                  <p className="text-slate-500 uppercase font-bold">Vendor ID</p>
                                  <p className="truncate">{service.vendorId}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-row md:flex-col gap-2 justify-center">
                              {service.status !== 'approved' && (
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700 w-full"
                                  onClick={() => approveVendorService.mutate(service.id)}
                                  disabled={approveVendorService.isPending}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                                </Button>
                              )}
                              {service.status !== 'rejected' && (
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  className="w-full"
                                  onClick={() => rejectVendorService.mutate(service.id)}
                                  disabled={rejectVendorService.isPending}
                                >
                                  <XCircle className="h-4 w-4 mr-2" /> Reject
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

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
                                Applied: {formatFirestoreDate(app.createdAt).toLocaleDateString()}
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
            </div>
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
                      onClick={() => {
                        const channelsArray = Object.entries(newTemplate.channels)
                          .filter(([_, enabled]) => enabled)
                          .map(([channel]) => channel);
                        createTemplate.mutate({
                          ...newTemplate,
                          channels: channelsArray
                        });
                      }}
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
                                    onClick={() => {
                                      const channelsArray = Object.entries(editingTemplate.channels || {})
                                        .filter(([_, enabled]) => enabled)
                                        .map(([channel]) => channel);
                                      updateTemplate.mutate({
                                        templateId: template.id,
                                        updates: {
                                          ...editingTemplate,
                                          channels: channelsArray
                                        }
                                      });
                                    }}
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
                                    {Array.isArray(template.channels) ? (
                                      <>
                                        {template.channels.includes('email') && <Badge variant="secondary" className="text-[10px]"><Mail className="h-3 w-3 mr-1" />Email</Badge>}
                                        {template.channels.includes('push') && <Badge variant="secondary" className="text-[10px]"><Bell className="h-3 w-3 mr-1" />Push</Badge>}
                                        {template.channels.includes('in_app') && <Badge variant="secondary" className="text-[10px]"><Bell className="h-3 w-3 mr-1" />In-App</Badge>}
                                      </>
                                    ) : (
                                      <>
                                        {template.channels?.email && <Badge variant="secondary" className="text-[10px]"><Mail className="h-3 w-3 mr-1" />Email</Badge>}
                                        {template.channels?.push && <Badge variant="secondary" className="text-[10px]"><Bell className="h-3 w-3 mr-1" />Push</Badge>}
                                        {template.channels?.in_app && <Badge variant="secondary" className="text-[10px]"><Bell className="h-3 w-3 mr-1" />In-App</Badge>}
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`button-edit-template-${template.id}`}
                                    onClick={() => {
                                      const channelsObj = Array.isArray(template.channels) 
                                        ? {
                                            email: template.channels.includes('email'),
                                            push: template.channels.includes('push'),
                                            in_app: template.channels.includes('in_app')
                                          }
                                        : (template.channels || { email: true, push: false, in_app: true });
                                      
                                      setEditingTemplate({
                                        ...template,
                                        channels: channelsObj
                                      });
                                    }}
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
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 md:col-span-2">
                      <div className="space-y-0.5">
                        <Label>Service Active</Label>
                        <p className="text-xs text-slate-500">Enable or disable all email notifications</p>
                      </div>
                      <Switch 
                        checked={smtpSettings.isActive}
                        onCheckedChange={(checked) => setSmtpSettings({ ...smtpSettings, isActive: checked })}
                      />
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

              {/* Push Notification VAPID Settings */}
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Smartphone className="h-5 w-5 text-purple-500" />
                      Web-Push VAPID Configuration
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => generateVapidKeys.mutate()}
                      disabled={generateVapidKeys.isPending}
                    >
                      {generateVapidKeys.isPending ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
                      Generate Keys
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="push-subject">Subject (mailto: or URL)</Label>
                      <Input
                        id="push-subject"
                        placeholder="mailto:admin@example.com"
                        value={pushSettings.subject}
                        onChange={(e) => setPushSettings({ ...pushSettings, subject: e.target.value })}
                      />
                      <p className="text-xs text-slate-500">This must be either a mailto: URI or a website URL.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="push-public-key">VAPID Public Key</Label>
                      <Input
                        id="push-public-key"
                        placeholder="Public Key"
                        value={pushSettings.publicKey}
                        onChange={(e) => setPushSettings({ ...pushSettings, publicKey: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="push-private-key">VAPID Private Key</Label>
                      <Input
                        id="push-private-key"
                        type="password"
                        placeholder="••••••••"
                        value={pushSettings.privateKey}
                        onChange={(e) => setPushSettings({ ...pushSettings, privateKey: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                      <div className="space-y-0.5">
                        <Label>Service Active</Label>
                        <p className="text-xs text-slate-500">Enable or disable web-push notifications</p>
                      </div>
                      <Switch 
                        checked={pushSettings.isActive}
                        onCheckedChange={(checked) => setPushSettings({ ...pushSettings, isActive: checked })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <Button
                      onClick={() => savePushSettings.mutate(pushSettings)}
                      disabled={savePushSettings.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {savePushSettings.isPending ? "Saving..." : "Save Push Settings"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const userId = prompt("Enter User ID to send test push to:");
                        if (userId) testPushNotification.mutate(userId);
                      }}
                      disabled={testPushNotification.isPending}
                    >
                      {testPushNotification.isPending ? "Sending..." : "Send Test Push"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        <TabsContent value="analytics" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">Analytics & Insights</h3>
              <p className="text-sm text-slate-500">Comprehensive business analytics and data export</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="1w">Last 1 Week</SelectItem>
                  <SelectItem value="1m">Last 1 Month</SelectItem>
                  <SelectItem value="3m">Last 3 Months</SelectItem>
                  <SelectItem value="6m">Last 6 Months</SelectItem>
                  <SelectItem value="1y">Last 1 Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {timeRange === 'custom' && (
            <Card className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date" 
                    value={customStartDate} 
                    onChange={(e) => setCustomStartDate(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input 
                    type="date" 
                    value={customEndDate} 
                    onChange={(e) => setCustomEndDate(e.target.value)} 
                  />
                </div>
                <Button variant="outline" onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}>
                  Clear
                </Button>
              </div>
            </Card>
          )}

          {(() => {
            const filteredPayments = filterDataByTimeRange(payments);
            const filteredUsers = filterDataByTimeRange(users);
            
            // Calculate Demographics
            const demographics = (() => {
              const genderCounts: Record<string, number> = { Male: 0, Female: 0, Other: 0, Unknown: 0 };
              const ageGroups: Record<string, number> = { "Under 18": 0, "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0, "Unknown": 0 };
              const stateCounts: Record<string, number> = {};

              filteredUsers.forEach((u: any) => {
                // Gender
                const gender = u.gender || "Unknown";
                if (genderCounts[gender] !== undefined) genderCounts[gender]++;
                else genderCounts["Unknown"]++;

                // Age from DOB
                if (u.dob) {
                  const birthDate = new Date(u.dob);
                  const age = new Date().getFullYear() - birthDate.getFullYear();
                  if (age < 18) ageGroups["Under 18"]++;
                  else if (age <= 24) ageGroups["18-24"]++;
                  else if (age <= 34) ageGroups["25-34"]++;
                  else if (age <= 44) ageGroups["35-44"]++;
                  else if (age <= 54) ageGroups["45-54"]++;
                  else ageGroups["55+"]++;
                } else {
                  ageGroups["Unknown"]++;
                }

                // State
                const state = u.state || "Unknown";
                stateCounts[state] = (stateCounts[state] || 0) + 1;
              });

              return {
                gender: Object.entries(genderCounts).map(([name, value]) => ({ name, value })).filter(d => d.value > 0),
                age: Object.entries(ageGroups).map(([name, value]) => ({ name, value })).filter(d => d.value > 0),
                states: Object.entries(stateCounts)
                  .map(([name, value]) => ({ name, value }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 10) // Top 10 states
              };
            })();

            return (
              <>
          {/* Export Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => {
                // Export to CSV
                const analyticsData = {
                  revenue: {
                    total: filteredPayments?.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.amount, 0) || 0,
                    byMethod: {}
                  },
                  users: {
                    total: filteredUsers?.length || 0,
                    subscribed: filteredUsers?.filter((u: any) => u.subscriptionId).length || 0
                  },
                  transactions: filteredPayments?.length || 0
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
                  ...filteredPayments?.map((p: any) => [
                    formatFirestoreDate(p.createdAt).toLocaleDateString(),
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
                    ['SabiRight Analytics Report'],
                    ['Generated:', new Date().toLocaleString()],
                    ['Time Range:', timeRange],
                    [''],
                    ['Key Metrics'],
                    ['Total Revenue', filteredPayments?.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.amount, 0) || 0],
                    ['Total Users', filteredUsers?.length || 0],
                    ['Subscribed Users', filteredUsers?.filter((u: any) => u.subscriptionId).length || 0],
                    ['Total Transactions', filteredPayments?.length || 0],
                    ['Completed Payments', filteredPayments?.filter((p: any) => p.status === 'completed').length || 0],
                    ['Pending Payments', filteredPayments?.filter((p: any) => p.status === 'pending').length || 0],
                  ];

                  // Payments sheet
                  const paymentsData = [
                    ['Date', 'User ID', 'Amount', 'Currency', 'Type', 'Status', 'Method', 'Reference'],
                    ...filteredPayments?.map((p: any) => [
                      formatFirestoreDate(p.createdAt).toLocaleString(),
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
                    ...filteredUsers?.map((u: any) => [
                      u.email,
                      u.displayName || 'N/A',
                      u.subscriptionId ? 'Yes' : 'No',
                      u.credits || 0,
                      formatFirestoreDate(u.createdAt).toLocaleString()
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
                  doc.text('SabiRight Analytics Report', 14, 20);
                  doc.setFontSize(10);
                  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

                  // Key Metrics
                  doc.setFontSize(14);
                  doc.text('Key Metrics', 14, 40);
                  
                  const metrics = [
                    ['Total Revenue', `NGN ${filteredPayments?.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.amount, 0) || 0}`],
                    ['Total Users', filteredUsers?.length || 0],
                    ['Subscribed Users', filteredUsers?.filter((u: any) => u.subscriptionId).length || 0],
                    ['Total Transactions', filteredPayments?.length || 0],
                    ['Completed Payments', filteredPayments?.filter((p: any) => p.status === 'completed').length || 0],
                    ['Pending Payments', filteredPayments?.filter((p: any) => p.status === 'pending').length || 0],
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

                  const paymentRows = filteredPayments?.slice(0, 100).map((p: any) => [
                    formatFirestoreDate(p.createdAt).toLocaleDateString(),
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
                const powerBIData = filteredPayments?.map((p: any) => {
                  const d = formatFirestoreDate(p.createdAt || new Date());
                  return {
                  Date: d.toISOString(),
                  Year: d.getFullYear(),
                  Month: d.getMonth() + 1,
                  Day: d.getDate(),
                  UserId: p.userId,
                  Amount: p.amount,
                  Currency: p.currency || 'NGN',
                  Type: p.type,
                  Status: p.status,
                  PaymentMethod: p.paymentMethod || 'Unknown',
                  Reference: p.reference || ''
                }}) || [];

                const headers = Object.keys(powerBIData[0] || {});
                const csvContent = [
                  headers.join(','),
                  ...powerBIData.map((row: Record<string, any>) => 
                    headers.map(header => {
                      const value = row[header];
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

          {/* Demographics Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Gender Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800">Gender Distribution</CardTitle>
                <p className="text-xs text-slate-500">Breakdown of users by gender</p>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={demographics.gender}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {demographics.gender.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              entry.name === 'Male' ? '#3b82f6' : 
                              entry.name === 'Female' ? '#ec4899' : 
                              entry.name === 'Other' ? '#8b5cf6' : '#94a3b8'
                            } 
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Age Groups */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800">Age Groups</CardTitle>
                <p className="text-xs text-slate-500">User distribution by age</p>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={demographics.age} layout="vertical" margin={{ left: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Geographic Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800">Geographic Distribution</CardTitle>
                <p className="text-xs text-slate-500">Top 10 states by user count</p>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={demographics.states} layout="vertical" margin={{ left: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Revenue Area Chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg font-bold">Revenue Trends</CardTitle>
                  <p className="text-xs text-slate-500">Daily revenue for the selected period</p>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Total: NGN {filteredPayments?.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.amount, 0).toLocaleString()}
                </Badge>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={(() => {
                        // Dynamic range based on timeRange
                        let days = 30;
                        if (timeRange === '24h') days = 1;
                        if (timeRange === '1w') days = 7;
                        if (timeRange === '1m') days = 30;
                        if (timeRange === '3m') days = 90;
                        if (timeRange === '6m') days = 180;
                        if (timeRange === '1y') days = 365;
                        if (timeRange === 'all' && filteredPayments.length > 0) {
                          const firstDate = formatFirestoreDate(filteredPayments[filteredPayments.length - 1].createdAt);
                          days = Math.ceil((new Date().getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        }

                        const range = Array.from({ length: Math.min(days, 365) }, (_, i) => {
                          const date = new Date();
                          date.setDate(date.getDate() - (Math.min(days, 365) - 1 - i));
                          return date.toISOString().split('T')[0];
                        });
                        
                        const dailyRevenue: Record<string, number> = {};
                        filteredPayments?.filter((p: any) => p.status === 'completed').forEach((p: any) => {
                          const date = formatFirestoreDate(p.createdAt).toISOString().split('T')[0];
                          dailyRevenue[date] = (dailyRevenue[date] || 0) + p.amount;
                        });

                        return range.map(date => ({
                          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                          amount: dailyRevenue[date] || 0
                        }));
                      })()}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        minTickGap={30}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(value) => `₦${value >= 1000 ? (value / 1000) + 'k' : value}`}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value: number) => [`NGN ${value.toLocaleString()}`, 'Revenue']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorRev)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Payment Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold">Payment Status</CardTitle>
                <p className="text-xs text-slate-500">Distribution of all transactions</p>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(() => {
                          const statusCounts: Record<string, number> = {};
                          filteredPayments?.forEach((p: any) => {
                            statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
                          });
                          return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
                        })()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {['completed', 'pending', 'failed', 'refunded'].map((status, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              status === 'completed' ? '#10b981' : 
                              status === 'pending' ? '#f59e0b' : 
                              status === 'failed' ? '#ef4444' : '#64748b'
                            } 
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* User Growth Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold">User Growth</CardTitle>
                <p className="text-xs text-slate-500">New users per month (Last 6 months)</p>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(() => {
                        const months = Array.from({ length: 6 }, (_, i) => {
                          const d = new Date();
                          d.setMonth(d.getMonth() - (5 - i));
                          return d.toLocaleString('en-US', { month: 'short' });
                        });
                        const monthlyUsers: Record<string, number> = {};
                        filteredUsers?.forEach((u: any) => {
                          if (u.createdAt) {
                            const month = formatFirestoreDate(u.createdAt).toLocaleString('en-US', { month: 'short' });
                            if (months.includes(month)) {
                              monthlyUsers[month] = (monthlyUsers[month] || 0) + 1;
                            }
                          }
                        });
                        return months.map(month => ({
                          name: month,
                          users: monthlyUsers[month] || 0
                        }));
                      })()}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="users" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Users by Spending */}
          <Card>
            <CardHeader>
              <CardTitle>Top Users by Spending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(() => {
                  const userSpending: Record<string, { total: number; email: string }> = {};
                  
                  filteredPayments?.filter((p: any) => p.status === 'completed').forEach((p: any) => {
                    const user = filteredUsers?.find((u: any) => u.userId === p.userId);
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
        </>
      );
    })()}
  </TabsContent>

        <TabsContent value="flagged-posts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5" />
                  Flagged Forum Posts
                  {flaggedPosts.length > 0 && (
                    <Badge variant="destructive" className="ml-2">{flaggedPosts.length}</Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="flag-threshold" className="text-xs font-bold whitespace-nowrap">Shadow Threshold:</Label>
                    <Input
                      id="flag-threshold"
                      type="number"
                      className="w-16 h-8 text-xs"
                      value={localSettings['flag_shadow_threshold'] ?? getSetting('flag_shadow_threshold') ?? 50}
                      onChange={(e) => handleSettingChange('flag_shadow_threshold', e.target.value)}
                    />
                  </div>
                  <Button 
                    size="sm" 
                    className="h-8 px-2"
                    onClick={() => handleSaveSetting('flag_shadow_threshold', 'forum', true)}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Review posts that have reached the flag threshold and are hidden from users.
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
        <TabsContent value="escrow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Escrow Management
                {disputes.filter((d: any) => d.status === 'open' || d.status === 'under_review').length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {disputes.filter((d: any) => d.status === 'open' || d.status === 'under_review').length}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-slate-500">
                Manage escrow disputes and mediate between users and vendors.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {disputes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active disputes</p>
                  </div>
                ) : (
                  disputes.map((dispute: any) => (
                    <Card key={dispute.id} className={dispute.status === 'open' ? 'border-red-200 bg-red-50/30' : ''}>
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge className={
                                dispute.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                dispute.status === 'under_review' ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {(dispute.status || 'status').replace('_', ' ')}
                              </Badge>
                              <span className="text-xs text-slate-400">
                                Opened: {formatFirestoreDate(dispute.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <h3 className="font-bold text-lg">{dispute.reason}</h3>
                            <p className="text-sm text-slate-600">{dispute.description}</p>
                            
                            {dispute.evidence && dispute.evidence.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-bold mb-1">Evidence Provided:</p>
                                <div className="flex flex-wrap gap-2">
                                  {dispute.evidence.map((item: any, i: number) => (
                                    <a 
                                      key={i} 
                                      href={item.url} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="text-[10px] bg-white border px-2 py-1 rounded flex items-center gap-1 hover:bg-slate-50"
                                    >
                                      <FileText className="h-3 w-3" />
                                      {item.type} {i + 1}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-2 min-w-[150px]">
                            {dispute.status !== 'resolved' && dispute.status !== 'closed' && (
                              <>
                                {!dispute.adminJoined ? (
                                  <Button 
                                    size="sm" 
                                    className="w-full"
                                    onClick={() => joinDispute.mutate(dispute.id)}
                                    disabled={joinDispute.isPending}
                                  >
                                    Join Chat & Mediate
                                  </Button>
                                ) : (
                                  <>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="w-full bg-blue-50"
                                      onClick={() => window.location.href = `/bookings/${dispute.bookingId}`}
                                    >
                                      Go to Chat
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      className="w-full bg-green-600 hover:bg-green-700"
                                      onClick={() => {
                                        setResolvingDispute(dispute);
                                        setResolutionNotes("");
                                      }}
                                    >
                                      Resolve Dispute
                                    </Button>
                                  </>
                                )}
                              </>
                            )}
                            {dispute.status === 'resolved' && (
                              <div className="text-right">
                                <p className="text-xs font-bold text-green-600">Resolved</p>
                                <p className="text-[10px] text-slate-500">Favor: {(dispute.resolution || 'unknown').replace('_', ' ')}</p>
                              </div>
                            )}
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

        <TabsContent value="jobs">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New Job</CardTitle>
                <p className="text-sm text-slate-500">Post a new job opportunity for users.</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Job Title</Label>
                      <Input 
                        placeholder="e.g. Senior Lawyer" 
                        value={newJob.title}
                        onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input 
                        placeholder="e.g. Sabiguard Legal" 
                        value={newJob.company}
                        onChange={(e) => setNewJob({ ...newJob, company: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input 
                        placeholder="e.g. Lagos, Nigeria" 
                        value={newJob.location}
                        onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Salary Range</Label>
                      <Input 
                        placeholder="e.g. N200k - N400k" 
                        value={newJob.salary}
                        onChange={(e) => setNewJob({ ...newJob, salary: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={newJob.type} onValueChange={(v) => setNewJob({ ...newJob, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full-time">Full-time</SelectItem>
                          <SelectItem value="Part-time">Part-time</SelectItem>
                          <SelectItem value="Contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Work Mode</Label>
                      <Select value={newJob.workMode} onValueChange={(v) => setNewJob({ ...newJob, workMode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Remote">Remote</SelectItem>
                          <SelectItem value="Onsite">Onsite</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Contact (Email/URL)</Label>
                    <Input 
                      placeholder="e.g. careers@company.com" 
                      value={newJob.contact}
                      onChange={(e) => setNewJob({ ...newJob, contact: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea 
                      placeholder="Detailed job description..." 
                      className="min-h-[150px]"
                      value={newJob.description}
                      onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                    />
                  </div>
                  <Button 
                    onClick={() => createJob.mutate(newJob)}
                    disabled={!newJob.title || !newJob.company || createJob.isPending}
                  >
                    {createJob.isPending ? 'Posting...' : 'Post Job'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Job Management ({adminJobs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adminJobs.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">No jobs found</p>
                  ) : (
                    adminJobs.map((job: any) => (
                      <div key={job.id} className="p-4 border rounded-lg flex justify-between items-center">
                        <div>
                          <p className="font-bold">{job.title}</p>
                          <p className="text-sm text-slate-500">{job.company} - {job.location}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingJob(job)}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => {
                            if (confirm('Delete this job?')) deleteJob.mutate(job.id);
                          }}>Delete</Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New Event</CardTitle>
                <p className="text-sm text-slate-500">Organize a new community event or workshop.</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Event Title</Label>
                      <Input 
                        placeholder="e.g. Legal Rights Workshop" 
                        value={newEvent.title}
                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={newEvent.category} onValueChange={(v) => setNewEvent({ ...newEvent, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="workshop">Workshop</SelectItem>
                          <SelectItem value="seminar">Seminar</SelectItem>
                          <SelectItem value="townhall">Town Hall</SelectItem>
                          <SelectItem value="legal_aid">Legal Aid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input 
                        type="date"
                        value={newEvent.date}
                        onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Input 
                        type="time"
                        value={newEvent.time}
                        onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input 
                        placeholder="e.g. Online or Lagos Office" 
                        value={newEvent.location}
                        onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Attendees</Label>
                      <Input 
                        type="number"
                        value={newEvent.maxAttendees}
                        onChange={(e) => setNewEvent({ ...newEvent, maxAttendees: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea 
                      placeholder="What is this event about?" 
                      className="min-h-[100px]"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    />
                  </div>
                  <Button 
                    onClick={() => createEvent.mutate(newEvent)}
                    disabled={!newEvent.title || !newEvent.date || createEvent.isPending}
                  >
                    {createEvent.isPending ? 'Creating...' : 'Create Event'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Event Management ({adminEvents.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adminEvents.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">No events found</p>
                  ) : (
                    adminEvents.map((event: any) => (
                      <div key={event.id} className="p-4 border rounded-lg flex justify-between items-center">
                        <div>
                          <p className="font-bold">{event.title}</p>
                          <p className="text-sm text-slate-500">{new Date(event.date).toLocaleDateString()} - {event.location}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingEvent(event)}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => {
                            if (confirm('Delete this event?')) deleteEvent.mutate(event.id);
                          }}>Delete</Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="faqs">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>FAQ Management</CardTitle>
                    <p className="text-sm text-slate-500">Manage frequently asked questions for users.</p>
                  </div>
                  <Button onClick={() => setShowFaqForm(!showFaqForm)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showFaqForm && (
                  <div className="p-4 border rounded-lg mb-6 bg-slate-50 space-y-4">
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input 
                        placeholder="e.g. How do I earn credits?"
                        value={newFaq.question}
                        onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer</Label>
                      <Textarea 
                        placeholder="Detailed answer..."
                        value={newFaq.answer}
                        onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={newFaq.category} onValueChange={(v) => setNewFaq({ ...newFaq, category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="billing">Billing & Credits</SelectItem>
                            <SelectItem value="marketplace">Marketplace</SelectItem>
                            <SelectItem value="vendor">Vendor Related</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Display Order</Label>
                        <Input 
                          type="number"
                          value={newFaq.order}
                          onChange={(e) => setNewFaq({ ...newFaq, order: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch 
                        checked={newFaq.isActive}
                        onCheckedChange={(checked) => setNewFaq({ ...newFaq, isActive: checked })}
                      />
                      <Label>Active (Visible to users)</Label>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={() => createFaq.mutate(newFaq)} disabled={!newFaq.question || !newFaq.answer}>
                        Save FAQ
                      </Button>
                      <Button variant="outline" onClick={() => setShowFaqForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {faqs.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">No FAQs found</p>
                  ) : (
                    faqs.map((faq: any) => (
                      <div key={faq.id} className="p-4 border rounded-lg space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">{faq.category}</Badge>
                              {!faq.isActive && <Badge variant="secondary">Hidden</Badge>}
                              <span className="text-xs text-slate-400">Order: {faq.order}</span>
                            </div>
                            <p className="font-bold">{faq.question}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => {
                              if (confirm('Delete this FAQ?')) deleteFaq.mutate(faq.id);
                            }}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">{faq.answer}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="testimonials">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Testimonials & Reviews</CardTitle>
                    <p className="text-sm text-slate-500">Manage user success stories and platform reviews.</p>
                  </div>
                  <Button onClick={() => setShowTestimonialForm(!showTestimonialForm)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Testimonial
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showTestimonialForm && (
                  <div className="p-4 border rounded-lg mb-6 bg-slate-50 space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>User Name</Label>
                        <Input 
                          placeholder="e.g. John Doe"
                          value={newTestimonial.name}
                          onChange={(e) => setNewTestimonial({ ...newTestimonial, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role / Title</Label>
                        <Input 
                          placeholder="e.g. Small Business Owner"
                          value={newTestimonial.role}
                          onChange={(e) => setNewTestimonial({ ...newTestimonial, role: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Content / Testimonial</Label>
                      <Textarea 
                        placeholder="What did they say?"
                        value={newTestimonial.content}
                        onChange={(e) => setNewTestimonial({ ...newTestimonial, content: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Avatar URL (Optional)</Label>
                        <Input 
                          placeholder="https://..."
                          value={newTestimonial.avatar}
                          onChange={(e) => setNewTestimonial({ ...newTestimonial, avatar: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rating (1-5)</Label>
                        <Select 
                          value={newTestimonial.rating.toString()} 
                          onValueChange={(v) => setNewTestimonial({ ...newTestimonial, rating: parseInt(v) })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 Stars</SelectItem>
                            <SelectItem value="4">4 Stars</SelectItem>
                            <SelectItem value="3">3 Stars</SelectItem>
                            <SelectItem value="2">2 Stars</SelectItem>
                            <SelectItem value="1">1 Star</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch 
                        checked={newTestimonial.isActive}
                        onCheckedChange={(checked) => setNewTestimonial({ ...newTestimonial, isActive: checked })}
                      />
                      <Label>Active (Featured on home page)</Label>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={() => createTestimonial.mutate(newTestimonial)} disabled={!newTestimonial.name || !newTestimonial.content}>
                        Save Testimonial
                      </Button>
                      <Button variant="outline" onClick={() => setShowTestimonialForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  {testimonials.length === 0 ? (
                    <p className="col-span-full text-center py-8 text-slate-400">No testimonials found</p>
                  ) : (
                    testimonials.map((t: any) => (
                      <Card key={t.id} className="bg-white border-slate-200">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border">
                                {t.avatar ? (
                                  <img src={t.avatar} alt={t.name} className="h-full w-full object-cover" />
                                ) : (
                                  <User className="h-5 w-5 text-slate-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-sm">{t.name}</p>
                                <p className="text-[10px] text-slate-500">{t.role}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => {
                                if (confirm('Delete this testimonial?')) deleteTestimonial.mutate(t.id);
                              }}>
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Badge key={i} variant="outline" className={`h-4 w-4 p-0 flex items-center justify-center border-none ${i < (t.rating || 5) ? 'text-amber-500' : 'text-slate-200'}`}>
                                ★
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-3 italic">"{t.content}"</p>
                          {!t.isActive && <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="moat">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload MOAT Data</CardTitle>
                <p className="text-sm text-slate-500">Upload laws, acts, and other data to train the AI and improve accuracy.</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input 
                        placeholder="e.g. 1999 Constitution" 
                        value={newMoat.title}
                        onChange={(e) => setNewMoat({ ...newMoat, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select 
                        value={newMoat.category}
                        onValueChange={(v) => setNewMoat({ ...newMoat, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="constitution">Constitution</SelectItem>
                          <SelectItem value="police_act">Police Act</SelectItem>
                          <SelectItem value="case_documents">Case Documents</SelectItem>
                          <SelectItem value="forum">Forum Data</SelectItem>
                          <SelectItem value="marketplace">Marketplace Data</SelectItem>
                          <SelectItem value="events">Events Data</SelectItem>
                          <SelectItem value="jobs">Jobs Data</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Source / Reference</Label>
                    <Input 
                      placeholder="e.g. Federal Government of Nigeria" 
                      value={newMoat.source}
                      onChange={(e) => setNewMoat({ ...newMoat, source: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Textarea 
                      placeholder="Paste the full text here..." 
                      className="min-h-[200px]"
                      value={newMoat.content}
                      onChange={(e) => setNewMoat({ ...newMoat, content: e.target.value })}
                    />
                  </div>
                  <Button 
                    onClick={() => createMoat.mutate(newMoat)}
                    disabled={!newMoat.title || !newMoat.content || createMoat.isPending}
                  >
                    {createMoat.isPending ? 'Uploading...' : 'Upload Data'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing MOAT Data ({moatItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {moatItems.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">No MOAT data uploaded yet</p>
                  ) : (
                    moatItems.map((item: any) => (
                      <div key={item.id} className="p-4 border rounded-lg flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold">{item.title}</p>
                            <Badge variant="outline">{item.category}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mb-2">Source: {item.source}</p>
                          <p className="text-sm text-slate-600 line-clamp-3">{item.content}</p>
                        </div>
                        <Button size="sm" variant="destructive" className="ml-4" onClick={() => {
                          if (confirm('Delete this MOAT item?')) deleteMoat.mutate(item.id);
                        }}>Delete</Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="surveys" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Adoption & Feedback</h2>
              <p className="text-muted-foreground">Monitor user adoption and feature feedback.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(surveyStats).map(([feature, stats]: [string, any]) => (
              <Card key={feature}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium capitalize">{feature.replace(/-/g, ' ')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-end">
                      <span className="text-2xl font-bold">{stats.averageRating.toFixed(1)}/5</span>
                      <span className="text-xs text-muted-foreground">{stats.count} responses</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full mt-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all" 
                        style={{ width: `${(stats.averageRating / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {Object.keys(surveyStats).length === 0 && (
              <div className="col-span-full py-12 text-center bg-slate-50 rounded-xl border-2 border-dashed">
                <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">No feedback data yet</h3>
                <p className="text-slate-500">Feature feedback will appear here as users submit surveys.</p>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Responses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {surveys.length === 0 ? (
                  <p className="text-center py-8 text-slate-400">No individual responses found</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Feature</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Feedback</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {surveys.map((survey: any) => (
                          <TableRow key={survey.id}>
                            <TableCell className="font-medium text-xs">
                              {survey.userId.substring(0, 8)}...
                            </TableCell>
                            <TableCell className="capitalize">{survey.feature.replace(/-/g, ' ')}</TableCell>
                            <TableCell>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star 
                                    key={star}
                                    className={`h-3 w-3 ${star <= survey.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`}
                                  />
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-md">
                              <p className="text-sm italic text-slate-600 line-clamp-2">
                                {survey.feedback || "No comment provided"}
                              </p>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {new Date(survey.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  </AnimatePresence>
</div>
</main>
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={confirmAction?.type === 'cache' ? 'text-red-600' : ''}>
              {confirmAction?.title || "Confirm Action"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.description || "Are you sure you want to perform this action?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button 
              variant={confirmAction?.type === 'cache' ? 'destructive' : 'default'}
              onClick={async () => {
                if (confirmAction?.type === 'export') {
                  window.open('/api/admin/export', '_blank');
                } else if (confirmAction?.type === 'cache') {
                  try {
                    await fetch('/api/admin/clear-cache', { method: 'POST' });
                    toast({ title: "Success", description: "System cache cleared successfully." });
                  } catch (err) {
                    toast({ title: "Error", description: "Failed to clear cache", variant: "destructive" });
                  }
                }
                setConfirmAction(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dispute Dialog */}
      <Dialog open={!!resolvingDispute} onOpenChange={() => setResolvingDispute(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Escrow Dispute</DialogTitle>
            <DialogDescription>
              Decide how the escrow funds should be released. This action is final.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Resolution Decision</Label>
              <Select value={resolutionValue} onValueChange={setResolutionValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user_favor">Full Refund to User</SelectItem>
                  <SelectItem value="vendor_favor">Full Payment to Vendor</SelectItem>
                  <SelectItem value="split">50/50 Split</SelectItem>
                  <SelectItem value="cancelled">Cancel & Refund All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Internal Resolution Notes</Label>
              <Textarea 
                placeholder="Explain the reasoning for this decision..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolvingDispute(null)}>Cancel</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                resolveDispute.mutate({
                  disputeId: resolvingDispute.id,
                  resolution: resolutionValue,
                  notes: resolutionNotes
                });
                setResolvingDispute(null);
              }}
              disabled={resolveDispute.isPending}
            >
              Confirm Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Detailed information about the selected user account.
            </DialogDescription>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-slate-500" />
                </div>
                <div>
                  <p className="font-bold text-lg">{viewingUser.displayName || 'Unknown'}</p>
                  <p className="text-sm text-slate-500">{viewingUser.email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-slate-500">User ID</p>
                  <p className="font-mono text-xs">{viewingUser.userId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500">Status</p>
                  <Badge variant={viewingUser.emailVerificationStatus === 'verified' ? 'default' : 'secondary'}>
                    {viewingUser.emailVerificationStatus || 'pending'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500">Credits</p>
                  <p className="font-bold">{viewingUser.credits || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500">Plan</p>
                  <p className="font-bold">{viewingUser.planId || 'None'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500">Account Type</p>
                  <div className="flex gap-1">
                    {viewingUser.isAdmin && <Badge className="bg-red-100 text-red-800">Admin</Badge>}
                    {viewingUser.isVendor && <Badge className="bg-purple-100 text-purple-800">Vendor</Badge>}
                    {!viewingUser.isAdmin && !viewingUser.isVendor && <Badge>User</Badge>}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500">Joined</p>
                  <p>{viewingUser.createdAt ? formatFirestoreDate(viewingUser.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewingUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User/Vendor Dialog */}
      <Dialog open={!!editingUser || !!editingVendor} onOpenChange={() => { setEditingUser(null); setEditingVendor(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editingUser ? 'User' : 'Vendor'} Details</DialogTitle>
            <DialogDescription>
              Update user profile information. Email and Password cannot be changed here.
            </DialogDescription>
          </DialogHeader>
          {(editingUser || editingVendor) && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input 
                  value={(editingUser || editingVendor).displayName || ''} 
                  onChange={(e) => {
                    if (editingUser) setEditingUser({ ...editingUser, displayName: e.target.value });
                    else setEditingVendor({ ...editingVendor, displayName: e.target.value });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Email Status</Label>
                <Select 
                  value={(editingUser || editingVendor).emailVerificationStatus || 'pending'} 
                  onValueChange={(value) => {
                    if (editingUser) setEditingUser({ ...editingUser, emailVerificationStatus: value });
                    else setEditingVendor({ ...editingVendor, emailVerificationStatus: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="is-admin" 
                    checked={(editingUser || editingVendor).isAdmin || false}
                    onCheckedChange={(checked) => {
                      if (editingUser) setEditingUser({ ...editingUser, isAdmin: checked });
                      else setEditingVendor({ ...editingVendor, isAdmin: checked });
                    }}
                  />
                  <Label htmlFor="is-admin">Admin Access</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="is-vendor" 
                    checked={(editingUser || editingVendor).isVendor || false}
                    onCheckedChange={(checked) => {
                      if (editingUser) setEditingUser({ ...editingUser, isVendor: checked });
                      else setEditingVendor({ ...editingVendor, isVendor: checked });
                    }}
                  />
                  <Label htmlFor="is-vendor">Vendor Account</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingUser(null); setEditingVendor(null); }}>Cancel</Button>
            <Button 
              onClick={() => {
                const target = editingUser || editingVendor;
                updateUser.mutate({ 
                  userId: target.userId, 
                  updates: {
                    displayName: target.displayName,
                    emailVerificationStatus: target.emailVerificationStatus,
                    isAdmin: target.isAdmin,
                    isVendor: target.isVendor
                  }
                });
              }}
              disabled={updateUser.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={!!editingJob} onOpenChange={() => setEditingJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Job Opportunity</DialogTitle>
            <DialogDescription>
              Update the job details, requirements, and contact information.
            </DialogDescription>
          </DialogHeader>
          {editingJob && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input 
                    value={editingJob.title}
                    onChange={(e) => setEditingJob({ ...editingJob, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input 
                    value={editingJob.company}
                    onChange={(e) => setEditingJob({ ...editingJob, company: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input 
                    value={editingJob.location}
                    onChange={(e) => setEditingJob({ ...editingJob, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Salary Range</Label>
                  <Input 
                    value={editingJob.salary}
                    onChange={(e) => setEditingJob({ ...editingJob, salary: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={editingJob.type} onValueChange={(v) => setEditingJob({ ...editingJob, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work Mode</Label>
                  <Select value={editingJob.workMode} onValueChange={(v) => setEditingJob({ ...editingJob, workMode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Remote">Remote</SelectItem>
                      <SelectItem value="Onsite">Onsite</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Contact (Email/URL)</Label>
                <Input 
                  value={editingJob.contact}
                  onChange={(e) => setEditingJob({ ...editingJob, contact: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  className="min-h-[150px]"
                  value={editingJob.description}
                  onChange={(e) => setEditingJob({ ...editingJob, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingJob(null)}>Cancel</Button>
            <Button 
              onClick={() => updateJob.mutate({ jobId: editingJob.id, updates: editingJob })}
              disabled={updateJob.isPending}
            >
              {updateJob.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update event information, schedule, and location details.
            </DialogDescription>
          </DialogHeader>
          {editingEvent && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Event Title</Label>
                  <Input 
                    value={editingEvent.title}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={editingEvent.category} onValueChange={(v) => setEditingEvent({ ...editingEvent, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="workshop">Workshop</SelectItem>
                      <SelectItem value="seminar">Seminar</SelectItem>
                      <SelectItem value="townhall">Town Hall</SelectItem>
                      <SelectItem value="legal_aid">Legal Aid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input 
                    type="date"
                    value={editingEvent.date}
                    onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input 
                    type="time"
                    value={editingEvent.time}
                    onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input 
                    value={editingEvent.location}
                    onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Attendees</Label>
                  <Input 
                    type="number"
                    value={editingEvent.maxAttendees}
                    onChange={(e) => setEditingEvent({ ...editingEvent, maxAttendees: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  className="min-h-[100px]"
                  value={editingEvent.description}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEvent(null)}>Cancel</Button>
            <Button 
              onClick={() => updateEvent.mutate({ eventId: editingEvent.id, updates: editingEvent })}
              disabled={updateEvent.isPending}
            >
              {updateEvent.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
  );
}
