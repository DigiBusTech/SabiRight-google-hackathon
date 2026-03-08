import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, Clock, ShieldCheck, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function EmailVerification() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState(user?.email || "");
  const [verificationCode, setVerificationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: profile, refetch } = useQuery({
    queryKey: [`profile-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const res = await fetch(`/api/profile/${user.uid}`);
      return res.ok ? res.json() : null;
    },
    enabled: !!user?.uid,
  });

  const handleSubmitVerification = async () => {
    if (!user?.uid || !email) {
      toast({ title: "Error", description: "Please enter your email address", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/email-verification/${user.uid}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (res.ok) {
        toast({ title: "Success", description: "Verification code sent to your email!" });
        refetch();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit verification');
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to submit verification", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!user?.uid || !verificationCode) {
      toast({ title: "Error", description: "Please enter the verification code", variant: "destructive" });
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch(`/api/email-verification/${user.uid}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode })
      });

      if (res.ok) {
        toast({ title: "Success", description: "Email verified successfully!" });
        refetch();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to verify code');
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to verify code", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email Verification</h2>
        <p className="text-slate-500 mt-1">Verify your email to access all platform features</p>
      </div>

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
                {profile?.emailVerificationStatus === 'verified' 
                  ? 'Your email has been verified'
                  : profile?.emailVerificationStatus === 'pending'
                  ? 'Your verification is pending admin review'
                  : profile?.emailVerificationStatus === 'rejected'
                  ? 'Your verification was rejected. Please try again.'
                  : 'Not yet submitted'}
              </p>
            </div>
            <Badge className={`${
              profile?.emailVerificationStatus === 'verified' 
                ? 'bg-green-100 text-green-800 border-green-300'
                : profile?.emailVerificationStatus === 'pending'
                ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                : profile?.emailVerificationStatus === 'rejected'
                ? 'bg-red-100 text-red-800 border-red-300'
                : 'bg-slate-100 text-slate-800 border-slate-300'
            }`}>
              {profile?.emailVerificationStatus === 'verified' && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {profile?.emailVerificationStatus === 'pending' && <Clock className="h-3 w-3 mr-1" />}
              {profile?.emailVerificationStatus?.toUpperCase() || 'NOT SUBMITTED'}
            </Badge>
          </div>

          {profile?.emailVerifiedAt && (
            <div className="text-xs text-slate-500 text-center">
              Verified on {new Date(profile.emailVerifiedAt).toLocaleDateString()}
            </div>
          )}
        </CardContent>
      </Card>

      {profile?.emailVerificationStatus === 'pending' && (
        <Card className="border-yellow-100 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Enter Verification Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">6-Digit Code</label>
              <Input
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
            <Button
              onClick={handleVerifyCode}
              disabled={isVerifying || verificationCode.length !== 6}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {isVerifying ? 'Verifying...' : 'Verify Code'}
            </Button>
            <p className="text-xs text-center text-yellow-800">
              Didn't receive the code? <button onClick={handleSubmitVerification} className="underline font-bold">Resend</button>
            </p>
          </CardContent>
        </Card>
      )}

      {profile?.emailVerificationStatus !== 'verified' && profile?.emailVerificationStatus !== 'pending' && (
        <Card className="border-blue-100 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Request Verification Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-10"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                />
              </div>
            </div>

            <div className="p-3 bg-blue-100/50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                A 6-digit verification code will be sent to your email.
              </p>
            </div>

            <Button
              onClick={handleSubmitVerification}
              disabled={isSubmitting || !email}
              className="w-full bg-primary hover:bg-primary/90 gap-2"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Sending Code...' : 'Send Verification Code'}
            </Button>
          </CardContent>
        </Card>
      )}

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
