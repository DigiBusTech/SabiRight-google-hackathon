import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";

interface SurveyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
}

export function SurveyDialog({ isOpen, onClose, feature }: SurveyDialogProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [hoveredRating, setHoveredRating] = useState(0);

  const submitSurvey = useMutation({
    mutationFn: async (data: { feature: string; rating: number; feedback: string }) => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to submit survey");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Thank you!", description: "Your feedback helps us improve SabiRight." });
      onClose();
      // Reset state
      setRating(0);
      setFeedback("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit feedback. Please try again.", variant: "destructive" });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle>How are we doing?</DialogTitle>
          <DialogDescription>
            We'd love to hear your thoughts on our <span className="font-semibold capitalize">{feature}</span> feature.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-center block">Your Rating</Label>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-1 transition-transform hover:scale-110 focus:outline-none"
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    className={`h-8 w-8 ${
                      (hoveredRating || rating) >= star
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-xs text-center text-slate-500">
              {rating === 1 && "Needs improvement"}
              {rating === 2 && "Okay"}
              {rating === 3 && "Good"}
              {rating === 4 && "Great"}
              {rating === 5 && "Excellent!"}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback">Optional Feedback</Label>
            <Textarea
              id="feedback"
              placeholder="What did you like? What can we improve?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Skip</Button>
          <Button 
            onClick={() => submitSurvey.mutate({ feature, rating, feedback })}
            disabled={rating === 0 || submitSurvey.isPending}
          >
            {submitSurvey.isPending ? "Submitting..." : "Submit Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
