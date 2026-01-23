import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Wallet as WalletIcon, Building2, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Declare Paystack popup types
declare global {
  interface Window {
    PaystackPop: any;
  }
}

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

  // Parse query parameters
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const paymentType = searchParams.get('type') || 'wallet_topup';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const credits = parseInt(searchParams.get('credits') || '0');
  const planId = searchParams.get('planId');

  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [useWalletBalance, setUseWalletBalance] = useState(false);

  // Load Paystack inline script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
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

  // Fetch payment settings from admin
  const { data: paymentSettings } = useQuery({
    queryKey: ['payment-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings?category=payments');
      if (!res.ok) return {};
      const settings = await res.json();
      return settings.reduce((acc: any, setting: any) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
    }
  });

  // Fetch bank details from admin settings
  const { data: bankDetails } = useQuery({
    queryKey: ['bank-details'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings?category=bank_details');
      if (!res.ok) return null;
      const settings = await res.json();
      return settings.reduce((acc: any, setting: any) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
    }
  });

  // Fetch active payment methods from admin
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const res = await fetch('/api/payment-methods');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const paymentMode = paymentSettings?.payment_mode || 'automatic';
  const stripeEnabled = paymentSettings?.stripe_enabled === 'true';
  const paystackEnabled = paymentSettings?.paystack_enabled === 'true';
  const flutterwaveEnabled = paymentSettings?.flutterwave_enabled === 'true';

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
    onSuccess: (data) => {
      if (data.redirectUrl) {
        // Redirect to payment gateway
        window.location.href = data.redirectUrl;
      } else {
        // Manual payment - show success and instructions
        toast({
          title: "Payment Initiated",
          description: "Please complete the bank transfer and wait for admin approval.",
          duration: 5000
        });
        navigate('/app/wallet');
      }
    },
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

  const handlePayment = () => {
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
        metadata: {
          reference,
          ...(credits && { credits }),
          ...(planId && { planId })
        }
      };

      // Initiate payment to get Paystack public key
      initiatePayment.mutate(paymentData, {
        onSuccess: (data: any) => {
          // Get public key from settings
          const publicKey = paymentSettings?.paystack_public_key;
          
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

    // Handle other payment methods
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
      metadata: {
        reference: `${paymentType.toUpperCase()}-${Date.now()}`,
        ...(credits && { credits }),
        ...(planId && { planId })
      }
    };

    initiatePayment.mutate(paymentData);
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
      <div className="space-y-6 pb-20">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-slate-500">Invalid payment amount</p>
            <Button onClick={() => navigate('/app/dashboard')} className="mt-4">
              Go to Dashboard
            </Button>
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

      {/* Wallet Balance Option */}
      {wallet && canPayWithWallet && (
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
                {paystackEnabled && (
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

                {stripeEnabled && (
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

                {flutterwaveEnabled && (
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
                {paymentMethods.map((method: any) => (
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
              </div>
            </RadioGroup>

            {/* Dynamic Payment Method Instructions and Custom Fields */}
            {selectedMethod && paymentMethods.find((m: any) => m.id === selectedMethod) && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                {(() => {
                  const method = paymentMethods.find((m: any) => m.id === selectedMethod);
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
                                <Input type="file" required={field.required} className="mt-1" />
                              ) : (
                                <Input 
                                  type="text" 
                                  placeholder={field.placeholder} 
                                  required={field.required}
                                  className="mt-1"
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

            {/* Legacy Bank Transfer Instructions (for backward compatibility) */}
            {selectedMethod === 'bank_transfer' && bankDetails && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-bold text-sm mb-2">📋 Bank Transfer Instructions:</p>
                <div className="space-y-1 text-sm">
                  <p><strong>Bank:</strong> {bankDetails.bank_name || 'GTBank'}</p>
                  <p><strong>Account Number:</strong> {bankDetails.account_number || '0123456789'}</p>
                  <p><strong>Account Name:</strong> {bankDetails.account_name || 'SabiRight Technologies'}</p>
                  <p><strong>Amount:</strong> {formatCurrency(amount)}</p>
                </div>
                <p className="text-xs text-blue-700 mt-3">
                  ⏳ Your payment will be verified and credited within 1-24 hours after transfer.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
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
    </div>
  );
}
