import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Wallet as WalletIcon, Building2, ArrowLeft, Loader2, CheckCircle2, UploadCloud } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReCAPTCHA from "react-google-recaptcha";

// Declare Paystack and Flutterwave popup types
declare global {
  interface Window {
    PaystackPop: any;
    FlutterwaveCheckout: any;
  }
}

// Stripe Checkout Form Component
const StripeCheckoutForm = ({ clientSecret, onSuccess }: { clientSecret: string, onSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const { error: submitError } = await elements.submit();
    if (submitError) {
        setError(submitError.message || "An error occurred");
        setProcessing(false);
        return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/app/wallet?payment=success",
      },
    });

    if (error) {
      setError(error.message || "Payment failed");
      setProcessing(false);
    } else {
      // The return_url will handle the rest
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <Button type="submit" disabled={!stripe || processing} className="w-full">
        {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Pay Now"}
      </Button>
    </form>
  );
};

export default function Payment() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const navigate = (path: string | number) => {
    if (typeof path === 'number') {
      window.history.go(path);
    } else {
      setLocation(path);
    }
  };
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse query parameters from window.location.search (wouter location doesn't include query params)
  const searchParams = new URLSearchParams(window.location.search);
  const paymentType = searchParams.get('type') || 'wallet_topup';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const credits = parseInt(searchParams.get('credits') || '0');
  const planId = searchParams.get('planId');

  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [manualFieldValues, setManualFieldValues] = useState<Record<string, any>>({});
  const [manualFiles, setManualFiles] = useState<Record<string, File>>({});
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const captchaRef = useRef<ReCAPTCHA>(null);

  // Debug: Log payment parameters
  useEffect(() => {
    // Fetch public site key
    fetch('/api/settings/public')
      .then(res => res.json())
      .then(data => {
        if (data.captcha_site_key) {
          setSiteKey(data.captcha_site_key);
        }
      })
      .catch(err => console.error('Failed to fetch site key:', err));
  }, []);

  useEffect(() => {
    // Debug: Log payment parameters removed for production
  }, [paymentType, amount, credits, planId]);

  // Load Paystack and Flutterwave inline scripts
  useEffect(() => {
    const paystackScript = document.createElement('script');
    paystackScript.src = 'https://js.paystack.co/v1/inline.js';
    paystackScript.async = true;
    document.body.appendChild(paystackScript);

    const flutterwaveScript = document.createElement('script');
    flutterwaveScript.src = 'https://checkout.flutterwave.com/v3.js';
    flutterwaveScript.async = true;
    document.body.appendChild(flutterwaveScript);

    return () => {
      if (document.body.contains(paystackScript)) {
        document.body.removeChild(paystackScript);
      }
      if (document.body.contains(flutterwaveScript)) {
        document.body.removeChild(flutterwaveScript);
      }
    };
  }, []);

  // Fetch wallet balance
  const { data: wallet } = useQuery({
    queryKey: [`wallet-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const token = await user.getIdToken();
      const res = await fetch(`/api/wallet/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.uid
  });

  // Fetch all payment methods (both automatic and manual)
  const { data: allPaymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const res = await fetch('/api/payment-methods');
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Separate automatic gateways from manual methods
  const automaticGateways = allPaymentMethods.filter((m: any) => 
    ['paystack', 'flutterwave', 'stripe'].includes(m.type)
  );
  const manualMethods = allPaymentMethods.filter((m: any) => 
    m.type === 'manual' || (m.type !== 'wallet' && !['paystack', 'flutterwave', 'stripe'].includes(m.type))
  );

  // Get specific gateway configurations
  const paystackGateway = automaticGateways.find((g: any) => g.type === 'paystack');
  const flutterwaveGateway = automaticGateways.find((g: any) => g.type === 'flutterwave');
  const stripeGateway = automaticGateways.find((g: any) => g.type === 'stripe');
  const walletMethod = allPaymentMethods.find((m: any) => m.type === 'wallet');

  // Initialize Stripe
  useEffect(() => {
    if (stripeGateway?.publicKey && !stripePromise) {
        setStripePromise(loadStripe(stripeGateway.publicKey));
    }
  }, [stripeGateway, stripePromise]);

  // Count total active payment methods
  const totalActiveMethods = automaticGateways.length + manualMethods.length;

  const walletBalance = wallet ? parseFloat(wallet.balance) : 0;
  const canPayWithWallet = walletBalance >= amount;

  // Payment initiation mutation
  const initiatePayment = useMutation({
    mutationFn: async (data: any) => {
      if (!user?.uid) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Payment initiation failed');
      }

      return res.json();
    },
    // Note: onSuccess handlers are defined per payment method (Paystack, Flutterwave, Manual)
    // No global onSuccess to avoid conflicts with inline checkout handlers
    onError: (error: Error) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Wallet payment mutation
  const payWithWallet = useMutation({
    mutationFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const token = await user.getIdToken();

      const res = await fetch('/api/payments/wallet-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.uid,
          amount,
          type: paymentType,
          planId,
          credits
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Wallet payment failed');
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment Successful",
        description: paymentType === 'credit_purchase' 
          ? `${credits} credits added to your account!`
          : "Your subscription has been activated!",
      });
      queryClient.invalidateQueries({ queryKey: [`wallet-${user?.uid}`] });
      navigate('/app/dashboard');
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handlePayment = async () => {
    if (!user?.uid) {
      toast({
        title: "Authentication Required",
        description: "Please log in to continue",
        variant: "destructive"
      });
      navigate('/auth/login');
      return;
    }

    if (useWalletBalance) {
      payWithWallet.mutate();
      return;
    }

    if (!selectedMethod) {
      toast({
        title: "Select Payment Method",
        description: "Please choose a payment method to continue",
        variant: "destructive"
      });
      return;
    }

    const captchaToken = captchaRef.current?.getValue();
    if (siteKey && !captchaToken) {
      toast({
        title: "Verification Required",
        description: "Please complete the reCAPTCHA verification.",
        variant: "destructive"
      });
      return;
    }

    // Handle Stripe Payment
    if (selectedMethod === 'stripe') {
        const paymentData = {
            userId: user.uid,
            amount,
            currency: 'NGN',
            provider: 'stripe',
            type: paymentType,
            description: paymentType === 'credit_purchase' 
              ? `Purchase ${credits} credits`
              : paymentType === 'subscription'
              ? `Subscription to plan ${planId}`
              : `Wallet top-up - NGN ${amount}`,
            captchaToken,
            metadata: {
              ...(credits && { credits }),
              ...(planId && { planId })
            }
        };

        initiatePayment.mutate(paymentData, {
            onSuccess: (data: any) => {
                if (data.clientSecret) {
                    setStripeClientSecret(data.clientSecret);
                    setIsStripeModalOpen(true);
                } else {
                    toast({
                        title: "Error",
                        description: "Failed to initialize Stripe payment",
                        variant: "destructive"
                    });
                }
            }
        });
        return;
    }

    // Handle Paystack inline payment
    if (selectedMethod === 'paystack') {
      if (!window.PaystackPop) {
        toast({
          title: "Payment Error",
          description: "Paystack is not loaded. Please refresh the page.",
          variant: "destructive"
        });
        return;
      }

      const reference = `${paymentType.toUpperCase()}-${Date.now()}`;
      const paymentData = {
        userId: user.uid,
        amount,
        currency: 'NGN',
        provider: 'paystack',
        type: paymentType,
        email: user.email || `user-${user.uid}@sabiright.com`,
        description: paymentType === 'credit_purchase' 
          ? `Purchase ${credits} credits`
          : paymentType === 'subscription'
          ? `Subscription to plan ${planId}`
          : `Wallet top-up - NGN ${amount}`,
        captchaToken,
        metadata: {
          reference,
          ...(credits && { credits }),
          ...(planId && { planId })
        }
      };

      // Initiate payment to get Paystack public key
      initiatePayment.mutate(paymentData, {
        onSuccess: (data: any) => {
          // Get public key from configured payment method
          const publicKey = (paystackGateway as any)?.publicKey;
          
          if (!publicKey) {
            toast({
              title: "Configuration Error",
              description: "Paystack is not properly configured.",
              variant: "destructive"
            });
            return;
          }

          // Open Paystack popup
          const handler = window.PaystackPop.setup({
            key: publicKey,
            email: paymentData.email,
            amount: Math.round(amount * 100), // Convert to kobo
            currency: 'NGN',
            ref: reference,
            metadata: {
              paymentId: data.id,
              userId: user.uid,
              type: paymentType,
              ...(credits && { credits }),
              ...(planId && { planId })
            },
            onClose: function() {
              toast({
                title: "Payment Cancelled",
                description: "You closed the payment window.",
              });
            },
            callback: function(response: any) {
              // Payment successful
              toast({
                title: "Payment Successful!",
                description: "Your payment is being verified...",
              });
              
              // Verify payment
              fetch('/api/payments/paystack/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference: response.reference })
              }).then(res => res.json())
                .then(data => {
                  if (data.status && data.data.status === 'success') {
                    queryClient.invalidateQueries({ queryKey: [`wallet-${user.uid}`] });
                    queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
                    navigate('/app/wallet?payment=success');
                  } else {
                    navigate('/app/wallet?payment=failed');
                  }
                })
                .catch(err => {
                  console.error('Verification error:', err);
                  navigate('/app/wallet?payment=failed');
                });
            }
          });

          handler.openIframe();
        }
      });
      return;
    }

    // Handle Flutterwave inline payment
    if (selectedMethod === 'flutterwave') {
      if (!window.FlutterwaveCheckout) {
        toast({
          title: "Payment Error",
          description: "Flutterwave is not loaded. Please refresh the page.",
          variant: "destructive"
        });
        return;
      }

      const reference = `FLW-${paymentType.toUpperCase()}-${Date.now()}`;
      const paymentData = {
        userId: user.uid,
        amount,
        currency: 'NGN',
        provider: 'flutterwave',
        type: paymentType,
        email: user.email || `user-${user.uid}@sabiright.com`,
        description: paymentType === 'credit_purchase' 
          ? `Purchase ${credits} credits`
          : paymentType === 'subscription'
          ? `Subscription to plan ${planId}`
          : `Wallet top-up - NGN ${amount}`,
        captchaToken,
        metadata: {
          reference,
          ...(credits && { credits }),
          ...(planId && { planId })
        }
      };

      // Initiate payment to create payment record
      initiatePayment.mutate(paymentData, {
        onSuccess: (data: any) => {
          // Get public key from flutterwaveGateway
          const publicKey = flutterwaveGateway?.publicKey;
          
          if (!publicKey) {
            toast({
              title: "Configuration Error",
              description: "Flutterwave is not properly configured.",
              variant: "destructive"
            });
            return;
          }

          // Open Flutterwave modal
          window.FlutterwaveCheckout({
            public_key: publicKey,
            tx_ref: reference,
            amount: amount,
            currency: 'NGN',
            payment_options: 'card,banktransfer,ussd,mobilemoney',
            redirect_url: window.location.origin + "/app/wallet?payment=success&provider=flutterwave",
            customer: {
              email: paymentData.email,
              name: user.displayName || 'SabiRight User',
            },
            customizations: {
              title: 'SabiRight Payment',
              description: paymentData.description,
              logo: 'https://sabiright.com/logo.png',
            },
            meta: {
              paymentId: data.id,
              userId: user.uid,
              type: paymentType,
              ...(credits && { credits }),
              ...(planId && { planId })
            },
            callback: function(response: any) {
              console.log('Flutterwave callback:', response);
              if (response.status === 'successful' || response.status === 'completed') {
                toast({
                  title: "Payment Successful!",
                  description: "Your payment is being verified...",
                });
                
                // Verify payment
                fetch('/api/payments/flutterwave/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    transaction_id: response.transaction_id,
                    tx_ref: response.tx_ref 
                  })
                }).then(res => res.json())
                  .then(data => {
                    if (data.status === 'success') {
                      queryClient.invalidateQueries({ queryKey: [`wallet-${user.uid}`] });
                      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
                      navigate('/app/wallet?payment=success');
                    } else {
                      navigate('/app/wallet?payment=failed');
                    }
                  })
                  .catch(err => {
                    console.error('Verification error:', err);
                    navigate('/app/wallet?payment=failed');
                  });
              } else {
                toast({
                  title: "Payment Failed",
                  description: "Your payment was not successful.",
                  variant: "destructive"
                });
              }
            },
            onclose: function() {
              toast({
                title: "Payment Cancelled",
                description: "You closed the payment window.",
              });
            }
          });
        }
      });
      return;
    }

    // Handle other payment methods (manual methods)
    // Upload files first
    const uploadPromises = Object.entries(manualFiles).map(async ([fieldName, file]) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!res.ok) throw new Error('File upload failed');
        const data = await res.json();
        return { fieldName, url: data.url };
    });

    try {
        const uploadedFiles = await Promise.all(uploadPromises);
        const updatedManualFieldValues = { ...manualFieldValues };
        
        uploadedFiles.forEach(({ fieldName, url }) => {
            updatedManualFieldValues[fieldName] = url;
        });

        const paymentData = {
          userId: user.uid,
          amount,
          currency: 'NGN',
          provider: selectedMethod,
          type: paymentType,
          description: paymentType === 'credit_purchase' 
            ? `Purchase ${credits} credits`
            : paymentType === 'subscription'
            ? `Subscription to plan ${planId}`
            : `Wallet top-up - NGN ${amount}`,
          captchaToken,
          metadata: (() => {
            const method = manualMethods.find((m: any) => m.id === selectedMethod);
            const manualFields = (method?.fields || []).map((f: any) => ({
              name: f.name,
              type: f.type,
              required: !!f.required,
              value: updatedManualFieldValues[f.name] ?? ''
            }));
            const missingRequired = manualFields.some((f: any) => f.required && !f.value);
            if (missingRequired) {
              toast({
                title: "Missing Required Fields",
                description: "Please fill all required manual payment fields.",
                variant: "destructive"
              });
              throw new Error("Missing required manual fields");
            }
            return {
              reference: `${paymentType.toUpperCase()}-${Date.now()}`,
              ...(credits && { credits }),
              ...(planId && { planId }),
              manualFields
            };
          })()
        };

        // For manual payment methods, show success message after initiation
        initiatePayment.mutate(paymentData, {
          onSuccess: () => {
            toast({
              title: "Payment Initiated",
              description: "Please wait for admin approval.",
              duration: 5000
            });
            navigate('/app/wallet');
          }
        });
    } catch (error) {
        console.error("Upload error", error);
        toast({
            title: "Error",
            description: "Failed to upload receipt or initiate payment",
            variant: "destructive"
        });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (!amount || amount <= 0) {
    return (
      <div className="space-y-6 pb-20 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Payment Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">The payment amount is missing or invalid.</p>
            <div className="bg-slate-100 p-4 rounded-lg text-sm">
              <p className="font-bold mb-2">Debug Information:</p>
              <p>Amount: {searchParams.get('amount') || 'Not provided'}</p>
              <p>Type: {paymentType}</p>
              <p>Credits: {credits || 'N/A'}</p>
              <p>Plan ID: {planId || 'N/A'}</p>
            </div>
            <p className="text-sm text-slate-500">Please go back and try again. Make sure to enter a valid amount.</p>
            <div className="flex gap-2">
              <Button onClick={() => navigate(-1)} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              <Button onClick={() => navigate('/app/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Complete Payment</h2>
          <p className="text-slate-500 text-sm mt-1">Choose your preferred payment method</p>
        </div>
      </div>

      {/* Payment Summary */}
      <Card className="border-2 border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-lg">Payment Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-600">Type:</span>
            <span className="font-bold capitalize">{paymentType.replace('_', ' ')}</span>
          </div>
          {credits > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">Credits:</span>
              <Badge className="bg-amber-500">{credits} Credits</Badge>
            </div>
          )}
          <div className="flex justify-between text-lg pt-2 border-t">
            <span className="font-bold">Total Amount:</span>
            <span className="font-bold text-blue-600">{formatCurrency(amount)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Wallet Balance Option - Hidden for wallet top-ups */}
      {wallet && canPayWithWallet && paymentType !== 'wallet_topup' && (
        <Card className="border-2 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                checked={useWalletBalance}
                onChange={(e) => {
                  setUseWalletBalance(e.target.checked);
                  if (e.target.checked) setSelectedMethod('');
                }}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <WalletIcon className="h-5 w-5 text-green-600" />
                  <p className="font-bold">Pay with Wallet Balance</p>
                  <Badge className="bg-green-100 text-green-700">Available</Badge>
                </div>
                <p className="text-sm text-slate-600">
                  Current Balance: <strong>{formatCurrency(walletBalance)}</strong>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Instant payment - No waiting time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Methods */}
      {!useWalletBalance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
              <div className="space-y-3">
                {/* Automatic Gateways */}
                {paystackGateway && (
                  <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">
                    <RadioGroupItem value="paystack" />
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-bold">Paystack</p>
                      <p className="text-xs text-slate-500">Pay with card, bank transfer, or USSD</p>
                    </div>
                    <Badge>Instant</Badge>
                  </label>
                )}

                {stripeGateway && (
                  <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">
                    <RadioGroupItem value="stripe" />
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    <div className="flex-1">
                      <p className="font-bold">Stripe</p>
                      <p className="text-xs text-slate-500">Pay with international cards</p>
                    </div>
                    <Badge>Instant</Badge>
                  </label>
                )}

                {flutterwaveGateway && (
                  <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">
                    <RadioGroupItem value="flutterwave" />
                    <CreditCard className="h-5 w-5 text-orange-600" />
                    <div className="flex-1">
                      <p className="font-bold">Flutterwave</p>
                      <p className="text-xs text-slate-500">Pay with card or bank transfer</p>
                    </div>
                    <Badge>Instant</Badge>
                  </label>
                )}

                {/* Dynamic Manual Payment Methods from Admin */}
                {manualMethods.map((method: any) => (
                  <label key={method.id} className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">
                    <RadioGroupItem value={method.id} />
                    <Building2 className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <p className="font-bold">{method.name}</p>
                      <p className="text-xs text-slate-500">{method.description}</p>
                    </div>
                    <Badge variant="outline">Manual</Badge>
                  </label>
                ))}

                {/* Empty State */}
                {totalActiveMethods === 0 && (
                  <div className="p-8 text-center border-2 border-dashed rounded-lg">
                    <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <p className="font-bold text-slate-600 mb-1">No Payment Methods Available</p>
                    <p className="text-sm text-slate-500">
                      Please contact the administrator to enable payment methods.
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      Debug: Check browser console for details
                    </p>
                  </div>
                )}
              </div>
            </RadioGroup>

            {/* Dynamic Payment Method Instructions and Custom Fields */}
            {selectedMethod && manualMethods.find((m: any) => m.id === selectedMethod) && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                {(() => {
                  const method = manualMethods.find((m: any) => m.id === selectedMethod);
                  return (
                    <>
                      <p className="font-bold text-sm mb-2">📋 Payment Instructions:</p>
                      <p className="text-sm whitespace-pre-wrap mb-3">{method.instructions}</p>
                      
                      {/* Custom Fields */}
                      {method.fields && method.fields.length > 0 && (
                        <div className="space-y-2 mt-3">
                          <p className="font-bold text-sm">Required Information:</p>
                          {method.fields.map((field: any, idx: number) => (
                            <div key={idx}>
                              <Label>{field.name} {field.required && '*'}</Label>
                              {field.type === 'file' ? (
                                <Input 
                                  type="file" 
                                  required={field.required} 
                                  className="mt-1"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setManualFiles((prev) => ({
                                      ...prev,
                                      [field.name]: file
                                    }));
                                  }}
                                />
                              ) : (
                                <Input 
                                  type="text" 
                                  placeholder={field.placeholder} 
                                  required={field.required}
                                  className="mt-1"
                                  value={manualFieldValues[field.name] ?? ''}
                                  onChange={(e) => {
                                    setManualFieldValues((prev) => ({
                                      ...prev,
                                      [field.name]: e.target.value
                                    }));
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <p className="text-xs text-blue-700 mt-3">
                        ⏳ Your payment will be verified and credited after admin approval.
                      </p>
                    </>
                  );
                })()}
              </div>
            )}


          </CardContent>
        </Card>
      )}

      {/* reCAPTCHA Verification */}
      {siteKey && (
        <div className="flex justify-center my-4">
          <ReCAPTCHA
            ref={captchaRef}
            sitekey={siteKey}
            onChange={(val) => console.log("Captcha value:", val)}
          />
        </div>
      )}

      {/* Payment Button */}
      <Button 
        onClick={handlePayment}
        disabled={(!selectedMethod && !useWalletBalance) || initiatePayment.isPending || payWithWallet.isPending}
        className="w-full h-12 text-lg"
        size="lg"
      >
        {(initiatePayment.isPending || payWithWallet.isPending) ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-5 w-5" />
            {useWalletBalance ? 'Pay with Wallet' : 'Proceed to Payment'}
          </>
        )}
      </Button>

      {/* Security Notice */}
      <p className="text-xs text-center text-slate-500">
        🔒 Your payment information is secure and encrypted
      </p>

      {/* Stripe Modal */}
      <Dialog open={isStripeModalOpen} onOpenChange={setIsStripeModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Complete Payment with Stripe</DialogTitle>
                <DialogDescription>
                    Please provide your payment details to complete the transaction securely via Stripe.
                </DialogDescription>
            </DialogHeader>
            {stripeClientSecret && stripePromise && (
                <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
                    <StripeCheckoutForm clientSecret={stripeClientSecret} onSuccess={() => setIsStripeModalOpen(false)} />
                </Elements>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
