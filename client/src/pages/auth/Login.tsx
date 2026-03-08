import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { 
  ShieldCheck, 
  Loader2, 
  Eye, 
  EyeOff, 
  CheckCircle2,
  Phone,
  User,
  MapPin,
  Calendar as CalendarIcon,
  ChevronRight,
  ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReCAPTCHA from "react-google-recaptcha";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", 
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe", 
  "Imo", "Jagawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", 
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", 
  "Taraba", "Yobe", "Zamfara"
];

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCompletingGoogleProfile, setIsCompletingGoogleProfile] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const captchaRef = useRef<ReCAPTCHA>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/settings/public')
      .then(res => res.json())
      .then(data => {
        if (data.captcha_site_key) {
          setSiteKey(data.captcha_site_key);
        }
      })
      .catch(err => console.error('Failed to fetch site key:', err));
  }, []);

  const handleGoogleAuth = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if profile exists and has required fields
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/profile/${user.uid}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      
      const profile = await response.json();
      
      // If profile is missing required fields, show the completion form
      if (!profile || !profile.userId || !profile.phoneNumber || !profile.dob || !profile.gender || !profile.state) {
        setGoogleUser(user);
        setName(user.displayName || "");
        setIsCompletingGoogleProfile(true);
        toast({ 
          title: "Almost there!", 
          description: "Please provide a few more details to complete your profile." 
        });
        return;
      }

      toast({ title: "Welcome back!", description: `Signed in as ${user.displayName}` });
      setLocation("/app");
    } catch (error: any) {
      console.error(error);
      toast({ 
        title: "Google Auth Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteGoogleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUser) return;

    setLoading(true);
    try {
      const idToken = await googleUser.getIdToken();
      await fetch(`/api/profile/${googleUser.uid}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          email: googleUser.email, 
          displayName: name || googleUser.displayName,
          phoneNumber,
          dob,
          gender,
          state,
          isGoogleAuth: true
        })
      });

      toast({ title: "Profile Completed!", description: "Welcome to SabiRight." });
      setLocation("/app");
    } catch (error: any) {
      toast({ 
        title: "Update Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && password !== confirmPassword) {
      toast({ 
        title: "Passwords do not match", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    const captchaToken = !isLogin ? captchaRef.current?.getValue() : null;
    
    if (!isLogin && siteKey && !captchaToken) {
      toast({ 
        title: "Verification Required", 
        description: "Please complete the reCAPTCHA verification.", 
        variant: "destructive" 
      });
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "Welcome back!", description: "Successfully logged in." });
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName: name });
          
          const idToken = await auth.currentUser.getIdToken();
          await fetch(`/api/profile/${auth.currentUser.uid}`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ 
              email: auth.currentUser.email, 
              displayName: name,
              phoneNumber,
              dob,
              gender,
              state,
              captchaToken
            })
          });
        }
        toast({ title: "Account created!", description: "Welcome to Digital Citizen." });
      }
      setLocation("/app");
    } catch (error: any) {
      console.error(error);
      toast({ 
        title: "Authentication Failed", 
        description: error.message || "Please check your credentials.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white overflow-hidden">
      {/* Left Column - Decorative Content (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
          <img 
            src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=2070&auto=format&fit=crop" 
            alt="Legal Background" 
            className="w-full h-full object-cover opacity-30"
          />
        </div>
        
        <div className="relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-white mb-12"
          >
            <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tighter">SabiRight</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-md"
          >
            <h1 className="text-5xl font-extrabold text-white leading-tight mb-6">
              Your Digital Hub for <span className="text-primary">Civic Empowerment.</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Access professional legal aid, discover verified job opportunities, and engage with your local community—all in one secure platform.
            </p>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 grid grid-cols-2 gap-6"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-1" />
            <div>
              <p className="text-white font-bold">Verified Identity</p>
              <p className="text-slate-500 text-sm">Secure email verification for all citizens.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-1" />
            <div>
              <p className="text-white font-bold">Expert Support</p>
              <p className="text-slate-500 text-sm">Connect with certified legal professionals.</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Column - Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-4 md:p-12 bg-slate-50/50">
        <div className="w-full max-w-md space-y-4 md:space-y-6">
          <AnimatePresence mode="wait">
            {isCompletingGoogleProfile ? (
              <motion.div
                key="complete-profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 md:space-y-6"
              >
                <div className="text-center lg:text-left space-y-1 md:space-y-2">
                  <button 
                    onClick={() => setIsCompletingGoogleProfile(false)}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-2 md:mb-4"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to Login
                  </button>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                    Complete Profile
                  </h2>
                  <p className="text-sm md:text-base text-slate-500">
                    Just a few more details to get you started.
                  </p>
                </div>

                <Card className="border-0 shadow-2xl shadow-slate-200/50 rounded-2xl md:rounded-3xl overflow-hidden">
                  <CardContent className="p-5 md:p-8">
                    <form onSubmit={handleCompleteGoogleProfile} className="space-y-4">
                      <div className="space-y-1.5 md:space-y-2">
                        <Label htmlFor="g-phone">Phone Number</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input 
                            id="g-phone" 
                            type="tel"
                            placeholder="+234 800 000 0000" 
                            value={phoneNumber} 
                            onChange={(e) => setPhoneNumber(e.target.value)} 
                            required 
                            className="h-11 md:h-12 pl-10"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <div className="space-y-1.5 md:space-y-2">
                          <Label htmlFor="g-dob">Date of Birth</Label>
                          <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                            <Input 
                              id="g-dob" 
                              type="date" 
                              value={dob} 
                              onChange={(e) => setDob(e.target.value)} 
                              required 
                              className="h-11 md:h-12 pl-10 text-xs md:text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5 md:space-y-2">
                          <Label htmlFor="g-gender">Gender</Label>
                          <Select value={gender} onValueChange={setGender} required>
                            <SelectTrigger id="g-gender" className="h-11 md:h-12">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1.5 md:space-y-2">
                        <Label htmlFor="g-state">State of Residence</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                          <Select value={state} onValueChange={setState} required>
                            <SelectTrigger id="g-state" className="h-11 md:h-12 pl-10">
                              <SelectValue placeholder="Choose your state" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[250px]">
                              {NIGERIAN_STATES.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full h-11 md:h-12 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all mt-2 md:mt-4 text-sm md:text-base" 
                        disabled={loading}
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Complete & Continue <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="auth-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4 md:space-y-6"
              >
                <div className="text-center lg:text-left space-y-1 md:space-y-2">
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                    {isLogin ? "Welcome Back" : "Create Account"}
                  </h2>
                  <p className="text-sm md:text-base text-slate-500">
                    {isLogin 
                      ? "Enter your credentials to access your dashboard." 
                      : "Fill in your details to get started with SabiRight."}
                  </p>
                </div>

                <Card className="border-0 shadow-2xl shadow-slate-200/50 rounded-2xl md:rounded-3xl overflow-hidden">
                  <CardContent className="p-5 md:p-8">
                    {/* Google Login Button */}
                    <Button 
                      variant="outline" 
                      className="w-full h-11 md:h-12 mb-4 md:mb-6 border-slate-200 hover:bg-slate-50 gap-3 font-semibold text-slate-700 text-sm md:text-base"
                      onClick={handleGoogleAuth}
                      disabled={loading}
                    >
                      <svg className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Continue with Google
                    </Button>

                    <div className="relative mb-4 md:mb-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-[10px] md:text-xs uppercase">
                        <span className="bg-white px-2 text-slate-400 font-medium">Or continue with email</span>
                      </div>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-3 md:space-y-4">
                      <AnimatePresence mode="wait">
                        {!isLogin && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 md:space-y-4 overflow-hidden"
                          >
                            <div className="space-y-1.5 md:space-y-2">
                              <Label htmlFor="name">Full Name</Label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input 
                                  id="name" 
                                  placeholder="Uyouko Ekpo" 
                                  value={name} 
                                  onChange={(e) => setName(e.target.value)} 
                                  required 
                                  className="h-11 md:h-12 pl-10"
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5 md:space-y-2">
                              <Label htmlFor="phone">Phone Number</Label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input 
                                  id="phone" 
                                  type="tel"
                                  placeholder="+234 800 000 0000" 
                                  value={phoneNumber} 
                                  onChange={(e) => setPhoneNumber(e.target.value)} 
                                  required 
                                  className="h-11 md:h-12 pl-10"
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 md:gap-4">
                              <div className="space-y-1.5 md:space-y-2">
                                <Label htmlFor="dob">Date of Birth</Label>
                                <div className="relative">
                                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                                  <Input 
                                    id="dob" 
                                    type="date" 
                                    value={dob} 
                                    onChange={(e) => setDob(e.target.value)} 
                                    required 
                                    className="h-11 md:h-12 pl-10 text-xs md:text-sm"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5 md:space-y-2">
                                <Label htmlFor="gender">Gender</Label>
                                <Select value={gender} onValueChange={setGender} required>
                                  <SelectTrigger id="gender" className="h-11 md:h-12">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="space-y-1.5 md:space-y-2">
                              <Label htmlFor="state">State of Residence</Label>
                              <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                                <Select value={state} onValueChange={setState} required>
                                  <SelectTrigger id="state" className="h-11 md:h-12 pl-10">
                                    <SelectValue placeholder="Choose your state" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[250px]">
                                    {NIGERIAN_STATES.map(s => (
                                      <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <div className="space-y-1.5 md:space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          placeholder="name@example.com" 
                          value={email} 
                          onChange={(e) => setEmail(e.target.value)} 
                          required 
                          className="h-11 md:h-12"
                        />
                      </div>

                      <div className="space-y-1.5 md:space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                          <Input 
                            id="password" 
                            type={showPassword ? "text" : "password"} 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                            className="h-11 md:h-12 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {!isLogin && (
                        <div className="space-y-1.5 md:space-y-2">
                          <Label htmlFor="confirmPassword">Confirm Password</Label>
                          <div className="relative">
                            <Input 
                              id="confirmPassword" 
                              type={showPassword ? "text" : "password"} 
                              value={confirmPassword} 
                              onChange={(e) => setConfirmPassword(e.target.value)} 
                              required 
                              className="h-11 md:h-12 pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      )}

                      {!isLogin && siteKey && (
                        <div className="flex justify-center py-1 md:py-2 scale-75 md:scale-90 origin-center">
                          <ReCAPTCHA
                            ref={captchaRef}
                            sitekey={siteKey}
                          />
                        </div>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full h-11 md:h-12 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all text-sm md:text-base" 
                        disabled={loading}
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLogin ? "Sign In" : "Create Account"}
                      </Button>
                    </form>

                    <div className="mt-6 md:mt-8 text-center">
                      <p className="text-sm text-slate-500">
                        {isLogin ? "New to SabiRight?" : "Already have an account?"}
                        <button
                          type="button"
                          onClick={() => setIsLogin(!isLogin)}
                          className="ml-1 font-bold text-primary hover:text-primary/80 transition-colors"
                        >
                          {isLogin ? "Create an account" : "Sign in instead"}
                        </button>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
          
          <p className="text-center text-[10px] text-slate-400 px-4 md:px-6">
            By continuing, you agree to our Terms of Service and Privacy Policy. 
            All legal information provided is for educational purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
