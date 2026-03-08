import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check, Zap } from "lucide-react";
import { Link } from "wouter";

export default function Pricing() {
  const plans = [
    {
      name: "Citizen Free",
      price: "0",
      desc: "Perfect for everyday civic awareness",
      features: [
        "10 Free Daily Credits",
        "Basic AI Legal Guidance",
        "Community Forum Access",
        "Real-time Traffic Alerts",
        "Public Marketplace View"
      ],
      button: "Get Started",
      popular: false
    },
    {
      name: "Sabi Pro",
      price: "2,500",
      period: "/month",
      desc: "Enhanced features for frequent users",
      features: [
        "500 Monthly Credits",
        "Priority AI Support",
        "Advanced Route Optimization",
        "Verified Pro Matching",
        "Job Board Early Access",
        "Ad-free Experience"
      ],
      button: "Go Pro Now",
      popular: true
    },
    {
      name: "Vendor Elite",
      price: "10,000",
      period: "/month",
      desc: "For professionals offering services",
      features: [
        "Unlimited Marketplace Listings",
        "Verified Professional Badge",
        "Featured Service Placement",
        "Client Lead Analytics",
        "Custom Business Profile",
        "Direct Messaging Access"
      ],
      button: "Join as Vendor",
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar />

      <header className="pt-36 pb-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-5xl lg:text-7xl font-black mb-6">Simple, <span className="text-primary">Transparent</span> Pricing</h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">Choose the plan that fits your needs. Empower your civic life today.</p>
          </motion.div>
        </div>
      </header>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`bg-white p-10 rounded-[2.5rem] shadow-xl border-2 ${plan.popular ? 'border-primary relative' : 'border-transparent'}`}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-2 rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Zap className="h-4 w-4 fill-white" /> Most Popular
                  </div>
                )}
                
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-8">{plan.desc}</p>
                
                <div className="mb-8">
                  <span className="text-4xl font-black">₦{plan.price}</span>
                  <span className="text-slate-500 font-medium">{plan.period}</span>
                </div>
                
                <ul className="space-y-4 mb-10">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm font-medium">
                      <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                        <Check className="h-3 w-3" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Link href="/app">
                  <Button className={`w-full h-14 rounded-2xl font-bold text-lg ${plan.popular ? 'shadow-xl shadow-primary/20' : ''}`} variant={plan.popular ? 'default' : 'outline'}>
                    {plan.button}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
