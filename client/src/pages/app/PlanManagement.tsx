import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface Plan {
  id: string;
  name: string;
  description: string;
  type: string;
  userType: string;
  price: string | null;
  billingCycle: string | null;
  dailyCredits: number | null;
  marketplaceListings: number | null;
  features: string[];
}

export default function PlanManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [userType, setUserType] = useState<'user' | 'vendor'>('user');
  const [currentPlan, setCurrentPlan] = useState<any>(null);

  // Fetch available plans
  const { data: plans = [] } = useQuery({
    queryKey: ['plans', userType],
    queryFn: async () => {
      const res = await fetch(`/api/plans/user-type/${userType}`);
      if (!res.ok) throw new Error('Failed to fetch plans');
      return res.json();
    }
  });

  // Fetch current subscription
  const { data: subscription } = useQuery({
    queryKey: [`subscription-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const res = await fetch(`/api/subscription/${user?.uid}`);
      if (res.ok) return res.json();
      return null;
    },
    enabled: !!user?.uid,
  });

  useEffect(() => {
    if (subscription) {
      setCurrentPlan(subscription);
    }
  }, [subscription]);

  const handleUpgrade = async (plan: Plan) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "Please log in to subscribe" });
      setLocation('/auth/login');
      return;
    }

    // Navigate to payment page with plan details
    const amount = parseFloat(plan.price || '0');
    if (amount > 0) {
      setLocation(`/app/payment?type=subscription&planId=${plan.id}&amount=${amount}`);
    } else {
      // Free plan - subscribe directly
      try {
        const res = await fetch('/api/subscription/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid, planId: plan.id })
        });

        if (!res.ok) throw new Error('Failed to upgrade plan');

        const data = await res.json();
        toast({ title: "Success", description: data.message });
        setCurrentPlan(data.subscription);
      } catch (err) {
        toast({ 
          title: "Error", 
          description: "Failed to upgrade plan",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Plans & Billing</h2>
        <p className="text-slate-500 mt-1">Choose the right plan for your needs</p>
      </div>

      {/* User Type Toggle */}
      <div className="flex gap-2">
        <Button
          variant={userType === 'user' ? 'default' : 'outline'}
          onClick={() => setUserType('user')}
        >
          User Plans
        </Button>
        <Button
          variant={userType === 'vendor' ? 'default' : 'outline'}
          onClick={() => setUserType('vendor')}
        >
          Vendor Plans
        </Button>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {plans.map((plan: Plan) => {
          const isCurrentPlan = currentPlan?.id === plan.id;
          const isFree = plan.type === 'free';

          return (
            <Card 
              key={plan.id}
              className={`relative overflow-hidden transition-all ${
                isCurrentPlan 
                  ? 'ring-2 ring-primary shadow-lg' 
                  : 'hover:shadow-lg'
              }`}
            >
              {isCurrentPlan && (
                <div className="absolute top-0 right-0 bg-primary text-white px-4 py-1 text-xs font-bold rounded-bl">
                  Current Plan
                </div>
              )}

              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">{plan.description}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Pricing */}
                <div>
                  {plan.price ? (
                    <div>
                      <p className="text-3xl font-bold text-slate-900">
                        ${plan.price}
                      </p>
                      <p className="text-sm text-slate-600">per {plan.billingCycle}</p>
                    </div>
                  ) : (
                    <p className="text-3xl font-bold text-green-600">Free</p>
                  )}
                </div>

                {/* Credits/Listings */}
                {plan.dailyCredits && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Zap className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-xs font-bold text-blue-900 uppercase">Daily Credits</p>
                      <p className="text-lg font-bold text-blue-700">{plan.dailyCredits} credits/day</p>
                    </div>
                  </div>
                )}

                {plan.marketplaceListings && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Check className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-xs font-bold text-green-900 uppercase">Marketplace</p>
                      <p className="text-lg font-bold text-green-700">{plan.marketplaceListings} listings</p>
                    </div>
                  </div>
                )}

                {/* Features */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-600 uppercase">Features</p>
                  <ul className="space-y-2">
                    {plan.features && plan.features.slice(0, 5).map((feature: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-slate-700 capitalize">
                          {feature.replace(/_/g, ' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                {isCurrentPlan ? (
                  <Button disabled className="w-full">
                    Current Plan
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleUpgrade(plan)}
                    className={`w-full ${
                      isFree 
                        ? 'bg-slate-200 hover:bg-slate-300 text-slate-900' 
                        : 'bg-primary hover:bg-primary/90'
                    }`}
                  >
                    {isFree ? 'Switch to Free' : 'Upgrade Now'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
