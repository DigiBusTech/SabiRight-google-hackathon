import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

interface EmailVerificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  actionName?: string;
}

export function EmailVerificationPopup({ isOpen, onClose, actionName = "submit this form" }: EmailVerificationPopupProps) {
  const [, setLocation] = useLocation();

  const handleGoToVerification = () => {
    onClose();
    setLocation("/app/verify-email");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl md:rounded-3xl border-none shadow-2xl">
        <DialogHeader className="pt-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl font-bold text-slate-900">
            Email Verification Required
          </DialogTitle>
          <DialogDescription className="text-center text-slate-500 pt-2">
            To maintain a safe and trusted community, you need to verify your email before you can {actionName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-slate-700">Prevent spam and maintain high-quality discussions</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-slate-700">Ensure all event organizers and posters are real citizens</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-slate-700">Unlock full access to the Marketplace and SabiWork</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full sm:flex-1 rounded-xl font-bold text-slate-500"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGoToVerification}
            className="w-full sm:flex-1 bg-primary hover:bg-primary/90 rounded-xl font-bold shadow-lg shadow-primary/20"
          >
            Verify Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
