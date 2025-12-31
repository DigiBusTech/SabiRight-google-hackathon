import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { 
  User, 
  Mail, 
  MapPin, 
  Phone, 
  Save, 
  ShieldCheck, 
  Store, 
  AlertTriangle, 
  Trash2,
  Loader2,
  ChevronRight
} from "lucide-react";

const NIGERIAN_CITIES = [
  "Lagos",
  "Abuja",
  "Port Harcourt",
  "Kano",
  "Ibadan",
  "Kaduna",
  "Benin City",
  "Enugu",
  "Onitsha",
  "Jos",
  "Calabar",
  "Warri",
  "Uyo",
  "Owerri",
  "Abeokuta"
];

const CITY_STATE_MAP: Record<string, string> = {
  "Lagos": "Lagos",
  "Abuja": "FCT",
  "Port Harcourt": "Rivers",
  "Kano": "Kano",
  "Ibadan": "Oyo",
  "Kaduna": "Kaduna",
  "Benin City": "Edo",
  "Enugu": "Enugu",
  "Onitsha": "Anambra",
  "Jos": "Plateau",
  "Calabar": "Cross River",
  "Warri": "Delta",
  "Uyo": "Akwa Ibom",
  "Owerri": "Imo",
  "Abeokuta": "Ogun"
};

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || "");
  const [city, setCity] = useState(profile?.city || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveChanges = async () => {
    if (!user?.uid) return;
    
    setIsSaving(true);
    try {
      const state = city ? CITY_STATE_MAP[city] || "" : "";
      const res = await fetch(`/api/profile/${user.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          displayName,
          city,
          state,
          phone
        })
      });
      
      if (res.ok) {
        toast({ title: "Success", description: "Profile updated successfully" });
        await refreshProfile();
      } else {
        toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await signOut(auth);
      toast({ title: "Account Deleted", description: "Your account has been deleted" });
      setLocation("/");
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete account", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const userInitials = (user?.displayName || user?.email || "U")
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6 pb-20 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-settings-title">
          Profile Settings
        </h2>
        <p className="text-slate-500 text-sm md:text-base mt-1">
          Manage your account settings and preferences.
        </p>
      </div>

      <Card data-testid="card-profile-photo">
        <CardHeader>
          <CardTitle className="text-lg">Profile Photo</CardTitle>
          <CardDescription>Your profile photo from your authentication provider</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-20 w-20" data-testid="img-avatar">
            <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "User"} />
            <AvatarFallback className="text-lg bg-primary text-white">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium" data-testid="text-user-name">{user?.displayName || "No name set"}</p>
            <p className="text-sm text-slate-500" data-testid="text-user-email">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-edit-profile">
        <CardHeader>
          <CardTitle className="text-lg">Edit Profile</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="flex items-center gap-2">
              <User className="h-4 w-4" /> Display Name
            </Label>
            <Input
              id="displayName"
              data-testid="input-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email
            </Label>
            <Input
              id="email"
              data-testid="input-email"
              value={user?.email || ""}
              readOnly
              disabled
              className="bg-slate-50"
            />
            <p className="text-xs text-slate-500">Email cannot be changed here</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> City
            </Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger data-testid="select-city">
                <SelectValue placeholder="Select your city" />
              </SelectTrigger>
              <SelectContent>
                {NIGERIAN_CITIES.map((cityOption) => (
                  <SelectItem key={cityOption} value={cityOption} data-testid={`option-city-${cityOption}`}>
                    {cityOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> Phone Number
            </Label>
            <Input
              id="phone"
              data-testid="input-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
              type="tel"
            />
          </div>

          <Button 
            onClick={handleSaveChanges} 
            disabled={isSaving}
            className="w-full"
            data-testid="button-save-changes"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-account-status">
        <CardHeader>
          <CardTitle className="text-lg">Account Status</CardTitle>
          <CardDescription>Your verification and account status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">KYC Verification</p>
                <p className="text-sm text-slate-500">Identity verification status</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                data-testid="badge-kyc-status"
                className={
                  profile?.kycStatus === 'verified' 
                    ? 'bg-green-100 text-green-700' 
                    : profile?.kycStatus === 'pending'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-slate-100 text-slate-700'
                }
              >
                {profile?.kycStatus === 'verified' 
                  ? 'Verified' 
                  : profile?.kycStatus === 'pending'
                  ? 'Pending'
                  : 'Not Verified'}
              </Badge>
              {profile?.kycStatus !== 'verified' && (
                <Link href="/app/kyc">
                  <Button variant="ghost" size="sm" data-testid="link-kyc">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Store className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-medium">Vendor Status</p>
                <p className="text-sm text-slate-500">Marketplace vendor account</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                data-testid="badge-vendor-status"
                className={
                  profile?.vendorMode 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'bg-slate-100 text-slate-700'
                }
              >
                {profile?.vendorMode ? 'Active Vendor' : 'Not a Vendor'}
              </Badge>
              <Link href="/app/vendor">
                <Button variant="ghost" size="sm" data-testid="link-vendor">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-red-200" data-testid="card-danger-zone">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions for your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <h4 className="font-semibold text-red-700 mb-2">Delete Account</h4>
            <p className="text-sm text-red-600 mb-4">
              Once you delete your account, there is no going back. All your data, 
              including your profile, bookings, and credits will be permanently removed.
              This action cannot be undone.
            </p>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="gap-2"
                  data-testid="button-delete-account"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent data-testid="dialog-delete-confirm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your 
                    account and remove all your data from our servers including your 
                    profile, bookings, wallet balance, and credits.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAccount}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="button-confirm-delete"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Yes, delete my account"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
