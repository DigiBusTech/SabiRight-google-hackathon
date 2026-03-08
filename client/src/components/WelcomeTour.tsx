import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { X, ChevronRight, ChevronLeft, Info } from 'lucide-react';

interface Step {
  title: string;
  content: string;
  target?: string;
}

const steps: Step[] = [
  {
    title: "Welcome to SabiRight!",
    content: "Your AI-powered civic super-app. Let's take a quick tour of your new dashboard.",
  },
  {
    title: "Quick Stats",
    content: "Keep track of your credits, email verification status, and personalized matches at a glance.",
    target: "stats-overview"
  },
  {
    title: "Your Location",
    content: "Set your city to get relevant local updates, jobs, and events tailored to your area.",
    target: "location-card"
  },
  {
    title: "SabiGuard AI",
    content: "Get 'Legal First Aid', verify your rights, and get guidance on Nigerian laws in real-time.",
    target: "civic-card"
  },
  {
    title: "SabiMove Traffic",
    content: "Real-time traffic updates and checkpoint alerts to help you navigate safely.",
    target: "traffic-card"
  },
  {
    title: "Quick Access",
    content: "Quickly navigate to Jobs, Marketplace, Events, and more community features.",
    target: "quick-actions"
  },
  {
    title: "Credits Management",
    content: "Manage your AI credits to keep accessing premium civic features and guidance.",
    target: "credits-card"
  }
];

export default function WelcomeTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isOpen && steps[currentStep].target) {
      const element = document.getElementById(steps[currentStep].target!);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const rect = element.getBoundingClientRect();
        setHighlightStyle({
          position: 'fixed',
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          borderRadius: '12px',
          zIndex: 90,
          pointerEvents: 'none',
          transition: 'all 0.3s ease'
        });
      } else {
        setHighlightStyle({});
      }
    } else {
      setHighlightStyle({});
    }
  }, [currentStep, isOpen]);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('hasSeenTour', 'true');
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden pointer-events-none">
        <div style={highlightStyle} />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-md pointer-events-auto relative z-[100]"
        >
          <Card className="border-2 border-primary/20 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Info className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg">{steps[currentStep].title}</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-slate-600 leading-relaxed">
                {steps[currentStep].content}
              </p>
              
              <div className="mt-6 flex justify-center gap-1.5">
                {steps.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-slate-200'}`}
                  />
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t bg-slate-50/50 rounded-b-xl py-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrev} 
                disabled={currentStep === 0}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button 
                size="sm" 
                onClick={handleNext}
                className="gap-1"
              >
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'} <ChevronRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
