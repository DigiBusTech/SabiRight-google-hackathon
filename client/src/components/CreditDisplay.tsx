import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CreditDisplayProps {
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CreditDisplay({ compact = false, onClick, className }: CreditDisplayProps) {
  const { user } = useAuth();

  const { data: credits, isLoading, error, refetch } = useQuery({
    queryKey: [`credits-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      try {
        const res = await fetch(`/api/credits/${user.uid}/available`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch credits');
        }
        return res.json();
      } catch (err: any) {
        console.error('Error fetching credits:', err);
        throw err;
      }
    },
    enabled: !!user?.uid,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-slate-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (error || !credits) {
    if (compact) return null;
    return (
      <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4" />
          <p className="text-xs font-bold uppercase">Credit Update Failed</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          className="w-full text-xs py-1 h-7 border-red-200 hover:bg-red-100 text-red-700"
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  const available = credits.totalCredits || 0;
  const total = (credits.totalCredits || 0) + (credits.usedCredits || 0);

  const percentageUsed = total > 0 
    ? Math.round((credits.usedCredits / total) * 100)
    : 0;

  const isLow = available <= 2;

  if (compact) {
    return (
      <div 
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold cursor-pointer",
          isLow 
            ? 'bg-red-50 border-red-200 text-red-700' 
            : 'bg-blue-50 border-blue-200 text-blue-700',
          className
        )}
        onClick={onClick}
      >
        <Zap className={cn("h-4 w-4", isLow ? 'text-red-500' : 'text-blue-500')} />
        {available}
      </div>
    );
  }

  return (
    <div className={cn("bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-100 rounded-lg p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full ${isLow ? 'bg-red-100' : 'bg-blue-100'} flex items-center justify-center`}>
            <Zap className={`h-5 w-5 ${isLow ? 'text-red-600' : 'text-blue-600'}`} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase">Daily Credits</p>
            <p className="text-lg font-bold text-slate-900">
              {available} Available
            </p>
          </div>
        </div>
        {isLow && (
          <Badge className="bg-red-100 text-red-700 border-red-200">Low</Badge>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded h-2 overflow-hidden mb-3 border border-blue-100">
        <div 
          className={`h-full transition-all ${
            isLow ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${percentageUsed}%` }}
        />
      </div>

      <p className="text-xs text-slate-600 mb-3">
        {percentageUsed}% of daily credits used • Resets in 24 hours
      </p>

      {isLow && (
        <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
          Upgrade Plan
        </Button>
      )}
    </div>
  );
}
