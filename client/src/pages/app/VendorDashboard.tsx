import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Store, FileCheck, TrendingUp, AlertCircle, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function VendorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isApplying, setIsApplying] = useState(false);
  const [businessForm, setBusinessForm] = useState({
    businessName: "",
    serviceType: "",
    businessDocument: "",
    taxId: ""
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
                  {application.status.toUpperCase()}
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
                  <p className="text-sm font-bold text-green-800">Approved! 🎉</p>
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

      {/* Vendor Benefits */}
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
                  <p className="text-2xl font-bold">0</p>
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Add Service Listing', href: '#' },
                { label: 'View Bookings', href: '#' },
                { label: 'Earnings', href: '#' }
              ].map((action, i) => (
                <button
                  key={i}
                  className="w-full p-3 text-left flex items-center justify-between rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <span className="font-bold text-sm">{action.label}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
