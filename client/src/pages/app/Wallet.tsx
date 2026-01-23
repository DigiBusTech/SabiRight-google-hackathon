import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Wallet as WalletIcon, Plus, ArrowDownLeft, ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];

interface Transaction {
  id: number;
  type: string;
  amount: string;
  description: string | null;
  createdAt: string;
}

interface WalletData {
  id: number;
  userId: string;
  balance: string;
  currency: string;
}

export default function Wallet() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [topUpAmount, setTopUpAmount] = useState("");

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  const { data: wallet, isLoading: walletLoading, error: walletError, refetch: refetchWallet } = useQuery<WalletData>({
    queryKey: [`wallet-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/wallet/${user.uid}`, { headers });
      if (res.status === 404) {
        throw { status: 404 };
      }
      if (!res.ok) throw new Error("Failed to fetch wallet");
      return res.json();
    },
    enabled: !!user?.uid,
    retry: false,
  });

  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery<Transaction[]>({
    queryKey: [`wallet-transactions-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/wallet/${user.uid}/transactions`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.uid && !!wallet,
  });

  const { data: pendingPayments = [], refetch: refetchPendingPayments } = useQuery({
    queryKey: [`pending-payments-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return [];
      const res = await fetch(`/api/payments?userId=${user.uid}`);
      if (!res.ok) return [];
      const allPayments = await res.json();
      return allPayments.filter((p: any) => p.status === 'pending');
    },
    enabled: !!user?.uid,
  });

  const createWalletMutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/wallet/${user.uid}/create`, { method: "POST", headers });
      if (!res.ok) throw new Error("Failed to create wallet");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Wallet Created", description: "Your wallet has been created successfully." });
      refetchWallet();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create wallet", variant: "destructive" });
    },
  });

  const [, setLocation] = useLocation();

  const topUpMutation = useMutation({
    mutationFn: async (amount: number) => {
      // Navigate to payment page instead of directly initiating
      setLocation(`/app/payment?type=wallet_topup&amount=${amount}`);
      return { success: true };
    },
    onSuccess: () => {
      setTopUpAmount("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (walletError && (walletError as any)?.status === 404 && user?.uid) {
      createWalletMutation.mutate();
    }
  }, [walletError, user?.uid]);

  const handleTopUp = () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    topUpMutation.mutate(amount);
  };

  const handleQuickAmount = (amount: number) => {
    setTopUpAmount(amount.toString());
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "deposit":
      case "escrow_release":
        return "text-green-600";
      case "escrow_fund":
      case "withdrawal":
        return "text-red-600";
      default:
        return "text-slate-600";
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
      case "escrow_release":
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case "escrow_fund":
      case "withdrawal":
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      default:
        return <RefreshCw className="h-4 w-4 text-slate-600" />;
    }
  };

  const getTransactionBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "deposit":
      case "escrow_release":
        return "default";
      case "escrow_fund":
      case "withdrawal":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (walletLoading || createWalletMutation.isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="wallet-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-wallet-title">My Wallet</h2>
          <p className="text-slate-500 text-sm md:text-base mt-1">Manage your wallet balance and transactions.</p>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-primary to-primary/80 text-white border-0 shadow-lg overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <WalletIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium">Available Balance</p>
              <p className="text-3xl md:text-4xl font-bold" data-testid="text-wallet-balance">
                {wallet ? formatCurrency(wallet.balance) : "₦0.00"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
              {wallet?.currency || "NGN"}
            </Badge>
            <span>•</span>
            <span>Wallet ID: {wallet?.id || "---"}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Top Up Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAmount(amount)}
                className={`${topUpAmount === amount.toString() ? "border-primary bg-primary/5" : ""}`}
                data-testid={`button-quick-amount-${amount}`}
              >
                ₦{amount.toLocaleString()}
              </Button>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₦</span>
              <Input
                type="number"
                placeholder="Enter amount"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="pl-8"
                data-testid="input-topup-amount"
              />
            </div>
            <Button 
              onClick={handleTopUp} 
              disabled={topUpMutation.isPending || !topUpAmount}
              className="font-bold"
              data-testid="button-topup"
            >
              {topUpMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Top Up Wallet"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {pendingPayments.length > 0 && (
        <Card className="border-2 border-yellow-200 bg-yellow-50/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              Pending Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingPayments.map((payment: any) => (
                <div key={payment.id} className="p-4 bg-white rounded-lg border border-yellow-200">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-sm">{payment.type.replace('_', ' ').toUpperCase()}</p>
                      <p className="text-xs text-slate-500">{payment.description}</p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      Pending Approval
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <p className="text-xs text-slate-500">
                      Ref: {payment.metadata?.reference || payment.id}
                    </p>
                    <p className="font-bold text-lg">{payment.currency} {payment.amount}</p>
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs font-medium text-blue-900 mb-1">📋 Payment Instructions:</p>
                    <p className="text-xs text-blue-800">
                      Transfer <strong>{payment.currency} {payment.amount}</strong> to:<br />
                      <strong>Bank:</strong> GTBank<br />
                      <strong>Account:</strong> 0123456789<br />
                      <strong>Name:</strong> SabiRight Technologies<br />
                      <strong>Reference:</strong> {payment.metadata?.reference || payment.id}
                    </p>
                    <p className="text-xs text-blue-700 mt-2">
                      ⏳ Your payment will be credited after admin verification.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-2 border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold">Transaction History</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetchTransactions()}
              data-testid="button-refresh-transactions"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-8" data-testid="transactions-loading">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500" data-testid="text-no-transactions">
              <WalletIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No transactions yet</p>
              <p className="text-sm">Your transaction history will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="transactions-list">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50 hover:bg-slate-100/50 transition-colors"
                  data-testid={`transaction-item-${tx.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white border flex items-center justify-center">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm capitalize">{tx.type.replace("_", " ")}</p>
                        <Badge variant={getTransactionBadgeVariant(tx.type)} className="text-[10px] px-1.5">
                          {tx.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {tx.description || "No description"} • {formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold ${getTransactionColor(tx.type)}`} data-testid={`text-transaction-amount-${tx.id}`}>
                    {tx.type === "deposit" || tx.type === "escrow_release" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
