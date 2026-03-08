import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Zap, CheckCircle2, Languages } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SabiContributorModal } from "@/components/SabiContributorModal";

interface CreditPlan {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  bonus?: number;
  popular?: boolean;
  features: string[];
}

export default function Credits() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showSabiModal, setShowSabiModal] = useState(false);

  // Fetch available credit packages from admin settings
  const { data: creditPlans = [] } = useQuery<CreditPlan[]>({
    queryKey: ['credit-packages'],
    queryFn: async () => {
      const res = await fetch('/api/credit-packages');
      if (!res.ok) {
        // Return default plans if API fails
        return [
          {
            id: 'basic',
            name: 'Starter Pack',
            credits: 50,
            price: 2000,
            currency: 'NGN',
            features: ['50 AI queries', 'Basic support', 'Valid for 30 days']
          },
          {
            id: 'popular',
            name: 'Popular Pack',
            credits: 150,
            price: 5000,
            currency: 'NGN',
            bonus: 20,
            popular: true,
            features: ['150 AI queries', '+20 bonus credits', 'Priority support', 'Valid for 30 days']
          },
          {
            id: 'premium',
            name: 'Premium Pack',
            credits: 300,
            price: 9000,
            currency: 'NGN',
            bonus: 50,
            features: ['300 AI queries', '+50 bonus credits', 'Premium support', 'Valid for 60 days']
          },
          {
            id: 'enterprise',
            name: 'Enterprise Pack',
            credits: 1000,
            price: 25000,
            currency: 'NGN',
            bonus: 200,
            features: ['1000 AI queries', '+200 bonus credits', '24/7 support', 'Valid for 90 days']
          }
        ];
      }
      const packages = await res.json();
      // Map packages to include features array and currency
      return packages.map((pkg: any) => ({
        ...pkg,
        currency: 'NGN',
        features: [
          `${pkg.credits} credits`,
          pkg.bonus > 0 ? `+${pkg.bonus} bonus credits` : null,
          pkg.description || 'Full platform access'
        ].filter(Boolean)
      }));
    }
  });

  const handlePurchase = (plan: CreditPlan) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to purchase credits",
        variant: "destructive"
      });
      setLocation('/auth/login');
      return;
    }

    // Navigate to payment page with plan details
    setLocation(`/app/payment?type=credit_purchase&planId=${plan.id}&amount=${plan.price}&credits=${plan.credits + (plan.bonus || 0)}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Coins className="h-7 w-7 text-amber-500" />
            Get More Credits
          </h2>
          <p className="text-slate-500 text-sm md:text-base mt-1">
            Purchase credits to access AI-powered features and services
          </p>
        </div>
      </div>

      {/* Credit Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {creditPlans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`relative ${plan.popular ? 'border-2 border-amber-500 shadow-lg' : 'border-2 border-slate-200'}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-amber-500 text-white">
                  <Zap className="h-3 w-3 mr-1" />
                  Most Popular
                </Badge>
              </div>
            )}
            
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <div className="mt-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{formatCurrency(plan.price)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    {plan.credits} Credits
                  </Badge>
                  {plan.bonus && (
                    <Badge className="bg-green-100 text-green-700 border-green-300">
                      +{plan.bonus} Bonus
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                onClick={() => handlePurchase(plan)}
                className={`w-full ${plan.popular ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
              >
                Purchase Now
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* How Credits Work */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              How Credits Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p><strong>SabiGuard AI:</strong> Each SabiGuard legal query costs 5 credits</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p><strong>Civic AI:</strong> Standard civic education queries cost 1 credit</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p><strong>SabiMove:</strong> Advanced route planning costs 3 credits</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p><strong>Job Search:</strong> AI job search and recommendations cost 2 credits</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p><strong>Daily Bonus:</strong> Log in daily to receive free credits!</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-green-700">
              <Languages className="h-5 w-5" />
              Earn Free Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Help us train our AI model in local Nigerian languages and earn credits for every contribution.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">+5 Credits</Badge>
                <span>For each verified translation</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">+2 Credits</Badge>
                <span>For each verification vote</span>
              </div>
            </div>
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 mt-2"
              onClick={() => setShowSabiModal(true)}
            >
              Start Contributing
            </Button>
          </CardContent>
        </Card>
      </div>

      <SabiContributorModal
        isOpen={showSabiModal}
        onClose={() => setShowSabiModal(false)}
      />
    </div>
  );
}
