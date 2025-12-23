import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Upload, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function KYCVerification() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [kycDocument, setKycDocument] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: profile, refetch } = useQuery({
    queryKey: [`profile-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const res = await fetch(`/api/profile/${user.uid}`);
      return res.ok ? res.json() : null;
    },
    enabled: !!user?.uid,
  });

  const handleSubmitKYC = async () => {
    if (!user?.uid || !kycDocument) {
      toast({ title: "Error", description: "Please provide a document", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/kyc/${user.uid}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kycDocument })
      });

      if (res.ok) {
        toast({ title: "Success", description: "KYC submission pending admin review" });
        setKycDocument("");
        refetch();
      } else {
        throw new Error('Failed to submit KYC');
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to submit KYC", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Identity Verification (KYC)</h2>
        <p className="text-slate-500 mt-1">Verify your identity to access all platform features</p>
      </div>

      {/* KYC Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verification Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-bold mb-1">Current Status</p>
              <p className="text-sm text-slate-600">
                {profile?.kycStatus === 'verified' 
                  ? 'Your identity has been verified'
                  : profile?.kycStatus === 'pending'
                  ? 'Your KYC is pending admin review'
                  : 'Not yet submitted'}
              </p>
            </div>
            <Badge className={`${
              profile?.kycStatus === 'verified' 
                ? 'bg-green-100 text-green-800 border-green-300'
                : profile?.kycStatus === 'pending'
                ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                : 'bg-slate-100 text-slate-800 border-slate-300'
            }`}>
              {profile?.kycStatus === 'verified' && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {profile?.kycStatus === 'pending' && <Clock className="h-3 w-3 mr-1" />}
              {profile?.kycStatus?.toUpperCase() || 'NOT SUBMITTED'}
            </Badge>
          </div>

          {profile?.kycVerifiedAt && (
            <div className="text-xs text-slate-500 text-center">
              Verified on {new Date(profile.kycVerifiedAt).toLocaleDateString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submission Form */}
      {profile?.kycStatus !== 'verified' && (
        <Card className="border-blue-100 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Submit KYC Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">Government ID / Document</label>
              <Input
                placeholder="Enter document ID or reference"
                value={kycDocument}
                onChange={(e) => setKycDocument(e.target.value)}
                className="mb-2"
              />
              <p className="text-xs text-slate-600">
                Accepted: National ID, Passport, Driver's License
              </p>
            </div>

            <Button
              onClick={handleSubmitKYC}
              disabled={isSubmitting || !kycDocument}
              className="w-full bg-primary hover:bg-primary/90 gap-2"
            >
              <Upload className="h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Benefits Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Why Verify?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Full Feature Access</p>
                <p className="text-xs text-slate-600">Unlock all marketplace and civic features</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Become a Vendor</p>
                <p className="text-xs text-slate-600">List services and reach customers</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Community Trust</p>
                <p className="text-xs text-slate-600">Build reputation as verified citizen</p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
