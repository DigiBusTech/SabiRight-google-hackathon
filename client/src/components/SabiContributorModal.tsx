import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { legalDictionary } from "@/lib/legalDictionary";
import { auth } from "@/lib/firebase";
import { Check, X, Languages, Coins } from "lucide-react";

interface SabiContributorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SabiContributorModal({ isOpen, onClose }: SabiContributorModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"translate" | "verify">("translate");
  const [randomWord, setRandomWord] = useState(legalDictionary[0]);
  const [language, setLanguage] = useState("");
  const [translation, setTranslation] = useState("");
  
  // Get a random translation for verification
  const { data: verificationData, refetch: refetchVerification } = useQuery({
    queryKey: ["/api/crowd-translations/verification"],
    enabled: isOpen && mode === "verify",
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/crowd-translations/verification", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch verification task");
      return res.json();
    }
  });

  useEffect(() => {
    if (isOpen) {
      // 30% chance to show verification if possible, 70% chance for new translation
      const isVerify = Math.random() < 0.3;
      if (isVerify) {
        setMode("verify");
      } else {
        setMode("translate");
        const randomIndex = Math.floor(Math.random() * legalDictionary.length);
        setRandomWord(legalDictionary[randomIndex]);
      }
    }
  }, [isOpen]);

  const submitTranslation = useMutation({
    mutationFn: async (data: any) => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/crowd-translations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to submit translation");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Translation submitted. You earned 5 credits!",
      });
      onClose();
    }
  });

  const voteTranslation = useMutation({
    mutationFn: async ({ id, vote }: { id: string, vote: boolean }) => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/crowd-translations/${id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ vote })
      });
      if (!res.ok) throw new Error("Failed to vote");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Thank you!",
        description: "Verification submitted. You earned 2 credits!",
      });
      onClose();
    }
  });

  const handleSubmit = () => {
    if (!language || !translation) {
      toast({
        title: "Missing info",
        description: "Please select a language and type your translation.",
        variant: "destructive"
      });
      return;
    }

    submitTranslation.mutate({
      termId: randomWord.id,
      english: randomWord.term,
      translation,
      language
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            Sabi Contributor
          </DialogTitle>
          <DialogDescription>
            Help us train our AI in local languages and earn credits!
          </DialogDescription>
        </DialogHeader>

        {mode === "translate" ? (
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">English Term</Label>
              <div className="p-3 bg-muted rounded-md font-bold text-lg">
                {randomWord.term}
              </div>
              <p className="text-xs text-muted-foreground italic">
                {randomWord.context}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Select Language</Label>
              <Select onValueChange={setLanguage} value={language}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ibibio">Ibibio</SelectItem>
                  <SelectItem value="annang">Annang</SelectItem>
                  <SelectItem value="igbo">Igbo</SelectItem>
                  <SelectItem value="yoruba">Yoruba</SelectItem>
                  <SelectItem value="hausa">Hausa</SelectItem>
                  <SelectItem value="pidgin">Nigerian Pidgin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="translation">Type the translation here...</Label>
              <Input 
                id="translation" 
                placeholder="Translation..." 
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {verificationData ? (
              <div className="space-y-4 text-center">
                <p className="text-lg">
                  Does <span className="font-bold text-primary">"{verificationData.translation}"</span> mean 
                  <span className="font-bold"> "{verificationData.english}" </span> 
                  in <span className="capitalize font-bold">{verificationData.language}</span>?
                </p>
                <div className="flex justify-center gap-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={() => voteTranslation.mutate({ id: verificationData.id, vote: true })}
                  >
                    <Check className="h-4 w-4 text-green-500" /> Yes
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={() => voteTranslation.mutate({ id: verificationData.id, vote: false })}
                  >
                    <X className="h-4 w-4 text-red-500" /> No
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No verification tasks available right now.</p>
                <Button variant="link" onClick={() => setMode("translate")}>
                  Switch to translation instead
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {mode === "translate" && (
            <Button onClick={handleSubmit} className="w-full gap-2" disabled={submitTranslation.isPending}>
              <Coins className="h-4 w-4" /> Submit & Earn Credits
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
