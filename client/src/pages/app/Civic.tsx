import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Sparkles, User, ShieldCheck, Mic, AlertCircle, Plus, MessageSquare, History, Trash2, Phone, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { runGemini } from "@/lib/gemini";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CreditDisplay } from "@/components/CreditDisplay";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { SurveyDialog } from "@/components/SurveyDialog";
import { SabiContributorModal } from "@/components/SabiContributorModal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";

interface Message {
  role: "user" | "ai";
  text?: string;
  content?: string;
  sources?: { title?: string; uri?: string }[];
  timestamp?: string;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
}

export default function CivicGuard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  // Storage usage calculation
  const { data: storageInfo, refetch: refetchStorage } = useQuery({
    queryKey: [`storage-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const res = await fetch(`/api/profile/${user.uid}`);
      if (!res.ok) return null;
      const profileData = await res.json();
      return {
        used: profileData.chatStorageUsed || 0,
        limit: profileData.chatStorageLimit || 512 * 1024 // default 512KB
      };
    },
    enabled: !!user?.uid,
  });

  const storageLimit = storageInfo?.limit || profile?.chatStorageLimit || 524288;
  const storageUsed = storageInfo?.used || profile?.chatStorageUsed || 0;
  const storagePercent = Math.min(100, Math.round((storageUsed / storageLimit) * 100));
  const storageFormatted = (storageUsed / 1024).toFixed(1) + ' KB';
  const limitFormatted = (storageLimit / 1024).toFixed(0) + ' KB';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [showSurveyDialog, setShowSurveyDialog] = useState(false);
  const [showSabiModal, setShowSabiModal] = useState(false);
  const [surveyTriggered, setSurveyTriggered] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [chatList, setChatList] = useState<ChatSession[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lead recording mutation
  const recordLeadMutation = useMutation({
    mutationFn: async ({ lawyerId, lawyerName }: { lawyerId: string, lawyerName: string }) => {
      if (!user) throw new Error("Authentication required");
      const token = await user.getIdToken();
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: user.uid, lawyerId, lawyerName, source: 'civic_chat' })
      });
      if (!res.ok) throw new Error('Failed to record lead');
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: "Lead Recorded", description: `We've sent your contact details to ${variables.lawyerName}. They will reach out to you shortly.` });
    }
  });

  // Case file submission mutation
  const submitCaseFileMutation = useMutation({
    mutationFn: async ({ file, lawyerId }: { file: File, lawyerId?: string }) => {
      if (!user) throw new Error("Authentication required");
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.uid);
      if (lawyerId) formData.append('lawyerId', lawyerId);
      formData.append('chatId', currentChatId || '');

      const token = await user.getIdToken();
      const res = await fetch('/api/case-files', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      if (!res.ok) throw new Error('Failed to submit case file');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Case File Submitted", description: "Your case file has been pre-vetted and is being processed." });
      // Add a message to chat about the file
      setMessages(prev => [...prev, { 
        role: "user", 
        text: `📎 Submitted case file: ${data.fileName}` 
      }]);
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      submitCaseFileMutation.mutate({ file });
    }
  };

  // Fetch chat sessions
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery<ChatSession[]>({
    queryKey: ['sabiguard-chats', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      const token = await user.getIdToken();
      const res = await fetch(`/api/sabiguard/chats?userId=${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.uid,
  });

  // Fetch messages for current chat
  const { data: chatMessages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ['sabiguard-messages', currentChatId],
    queryFn: async () => {
      if (!user || !currentChatId) return [];
      const token = await user.getIdToken();
      const res = await fetch(`/api/sabiguard/chats/${currentChatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentChatId && !!user,
  });

  // Update messages when chatMessages changes
  useEffect(() => {
    if (chatMessages && chatMessages.length > 0) {
      setMessages(chatMessages);
    } else if (currentChatId === null) {
      setMessages((prev) => prev.length > 0 ? [] : prev);
    }
  }, [chatMessages, currentChatId]);

  // Create new chat mutation
  const createChatMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!user) throw new Error("Authentication required");
      const token = await user.getIdToken();
      const res = await fetch('/api/sabiguard/chats', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: user.uid, title })
      });
      if (!res.ok) throw new Error('Failed to create chat');
      return res.json();
    },
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: ['sabiguard-chats', user?.uid] });
      setCurrentChatId(newChat.id);
      setMessages([]);
    }
  });

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      if (!user) throw new Error("Authentication required");
      const token = await user.getIdToken();
      const res = await fetch(`/api/sabiguard/chats/${chatId}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete chat');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sabiguard-chats', user?.uid] });
      if (currentChatId) {
        setCurrentChatId(null);
        setMessages([]);
      }
    }
  });

  // Add message mutation
  const addMessageMutation = useMutation({
    mutationFn: async ({ chatId, role, text }: { chatId: string, role: 'user' | 'ai', text: string }) => {
      if (!user) throw new Error("Authentication required");
      const token = await user.getIdToken();
      const res = await fetch(`/api/sabiguard/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role, text, userId: user.uid })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save message');
      }
      return res.json();
    }
  });

  // Get user geolocation
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn("Location access declined or unavailable. Emergency features may be limited.");
        }
      );
    }
  }, []);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-NG';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        // Automatically send after a short delay to allow the user to see what was captured
        setTimeout(() => {
          if (transcript.trim()) {
            // We use a ref-based approach or a trigger to call handleSend
            document.getElementById('send-message-btn')?.click();
          }
        }, 500);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Speech Error",
          description: "Could not recognize speech. Please try again.",
          variant: "destructive"
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        toast({
          title: "Not Supported",
          description: "Speech recognition is not supported in your browser.",
          variant: "destructive"
        });
        return;
      }
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-NG';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Fetch user profile for city
  const { data: userProfile } = useQuery({
    queryKey: [`profile-${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const res = await fetch(`/api/profile/${user.uid}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.uid,
  });

    // Fetch credits
    const { data: credits, refetch: refetchCredits } = useQuery({
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
          console.error('Error fetching credits in Civic:', err);
          throw err;
        }
      },
      enabled: !!user?.uid,
      refetchInterval: 30000,
      retry: 2,
    });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Check credits
    const availableCredits = credits?.totalCredits || 0;
    if (availableCredits < 1) {
      toast({ 
        title: "No Credits", 
        description: "You've used all your daily credits. Upgrade your plan for unlimited access.",
        variant: "destructive"
      });
      return;
    }

    const userText = input;
    setInput("");
    setIsTyping(true);
    
    let chatId = currentChatId;
    
    // Create a new chat if none exists
    if (!chatId) {
      try {
        const newChat = await createChatMutation.mutateAsync(userText.slice(0, 30) + "...");
        chatId = newChat.id;
        setCurrentChatId(chatId);
      } catch (err: any) {
        toast({ title: "Error", description: "Could not create chat session", variant: "destructive" });
        setIsTyping(false);
        return;
      }
    }

    // Check if chatId is still null (shouldn't happen but for type safety)
    if (!chatId) {
      setIsTyping(false);
      return;
    }

    setMessages(prev => [...prev, { role: "user", text: userText }]);

    try {
      const token = user ? await user.getIdToken() : "";
      const response = await fetch('/api/ai/civic/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user?.uid,
          message: userText,
          city: userProfile?.city || "Nigeria",
          isUrgent,
          lat: userCoords?.lat,
          lng: userCoords?.lng,
          chatId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle 429 specifically
        if (response.status === 429) {
          throw new Error("AI service quota exceeded. Please try again in a few minutes or upgrade your plan.");
        }
        
        throw new Error(errorData.error || "Failed to get AI response");
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, { role: "ai", text: data.response, sources: [] }]);
      
      // Speak the AI response
      speakText(data.response);
      
      // Credit deduction and message saving are now handled on the server
      refetchCredits();
      queryClient.invalidateQueries({ queryKey: ['sabiguard-messages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['sabiguard-chats', user?.uid] });

      // Show survey after first AI response in session
      if (!surveyTriggered) {
        setSurveyTriggered(true);
        setTimeout(() => {
          setShowSurveyDialog(true);
        }, 3000); // Wait 3 seconds for user to read initial response
      } else {
        // Show Sabi contributor modal on subsequent responses occasionally
        if (Math.random() > 0.7) {
          setTimeout(() => {
            setShowSabiModal(true);
          }, 5000);
        }
      }
    } catch (error: any) {
      console.error("Civic Chat Error:", error);
      setMessages(prev => [...prev, { 
        role: "ai", 
        text: `⚠️ ${error.message || "Something went wrong. Please try again."}` 
      }]);
      
      toast({
        title: "Chat Error",
        description: error.message || "Failed to get AI response",
        variant: "destructive"
      });
    } finally {
      setIsTyping(false);
    }
  };

  // Define SidebarContent to be reused between desktop and mobile sheet
  const SidebarContent = () => (
    <div className="space-y-6 h-full flex flex-col">
      {/* Chat History Section */}
      <div className="bg-white border rounded-3xl p-4 flex flex-col gap-4 flex-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <History className="h-4 w-4" /> History
          </h3>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full"
            onClick={() => {
              setCurrentChatId(null);
              setMessages([]);
              setIsHistoryOpen(false);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-1 py-2">
              {isLoadingSessions ? (
                <div className="text-center py-4">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce inline-block"></span>
                </div>
              ) : (sessions || []).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No previous chats</p>
              ) : (
                (sessions || []).map((session) => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setCurrentChatId(session.id);
                      setIsHistoryOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 group",
                      currentChatId === session.id 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{session.title}</span>
                    <Trash2 
                      className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity" 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this chat?')) {
                          deleteChatMutation.mutate(session.id);
                        }
                      }}
                    />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Storage Usage - Sidebar Bottom */}
          <div className="p-4 border-t bg-slate-50/50 rounded-b-3xl mt-auto">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cloud Storage</span>
                {storagePercent > 80 && <AlertCircle className="h-3 w-3 text-amber-500" />}
              </div>
              <span className="text-[10px] font-bold text-slate-700">{storagePercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mb-2">
              <div 
                className={cn(
                  "h-full transition-all duration-500",
                  storagePercent > 90 ? "bg-red-500" : storagePercent > 70 ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-slate-400 font-medium">
                {storageFormatted} of {limitFormatted} used
              </p>
              {storagePercent > 90 && (
                <button 
                  onClick={() => toast({ title: "Storage Full", description: "Delete old chats to free up space." })}
                  className="text-[9px] font-bold text-primary hover:underline"
                >
                  Manage
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:grid md:grid-cols-4 gap-6">
      {/* Sidebar Info - Desktop */}
      <div className="hidden md:flex md:col-span-1 flex-col gap-6 overflow-y-auto pr-2">
        <SidebarContent />
        
        <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <h3 className="font-bold text-lg mb-2 relative z-10">How it works</h3>
          <p className="text-sm text-slate-400 mb-4 relative z-10">
            This AI is restricted to verified legal sources. It will not answer questions outside of Nigerian Law.
          </p>
          <div className="space-y-2 text-xs font-medium text-slate-300 relative z-10">
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"></div> 1999 Constitution</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Police Act 2020</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Landlord & Tenant Law</div>
          </div>
        </div>

        <div className="bg-white border rounded-3xl p-6 shrink-0">
           <h3 className="font-bold text-sm mb-4">Common Questions</h3>
           <div className="grid grid-cols-1 gap-2">
             {["Bail is Free", "Tenancy Notice Period", "Checkpoint Rights", "Employer Contracts"].map((tag) => (
               <Button key={tag} variant="outline" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => setInput(tag)}>
                 {tag}
               </Button>
             ))}
           </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="md:col-span-3 flex flex-col bg-white rounded-3xl border shadow-sm overflow-hidden h-full">
        <CreditDisplay compact={true} className="md:hidden border-b rounded-none" />
        {(!credits || credits.availableCredits <= 2) && (
          <div className="bg-yellow-50 border-b border-yellow-100 p-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <div className="text-sm flex-1">
              <p className="font-semibold text-yellow-900">
                {!credits || credits.availableCredits === 0 
                  ? "No credits available" 
                  : `${credits.availableCredits} credit${credits.availableCredits !== 1 ? 's' : ''} remaining`}
              </p>
              <p className="text-xs text-yellow-700">Each query uses 1 credit. <a href="/app/plans" className="underline font-bold">Upgrade your plan</a> for more.</p>
            </div>
          </div>
        )}
        <div className={cn("p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between transition-colors gap-3", isUrgent ? "bg-red-50 border-red-100" : "bg-slate-50")}>
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", isUrgent ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary")}>
                 <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-sm">SabiGuard AI Agent</h2>
                <p className="text-[10px] sm:text-xs text-slate-500">{isUrgent ? "🚨 Urgent Assistance Mode" : "Law-based Guidance"}</p>
              </div>
            </div>
            
            {/* Mobile Storage Indicator */}
            <div className="flex flex-col items-end md:hidden">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cloud</span>
                <span className={cn("text-[9px] font-bold", storagePercent > 80 ? "text-amber-600" : "text-slate-600")}>
                  {storagePercent}%
                </span>
              </div>
              <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    storagePercent > 90 ? "bg-red-500" : storagePercent > 70 ? "bg-amber-500" : "bg-primary"
                  )}
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setMessages([]);
                setCurrentChatId(null);
              }}
              className="md:hidden text-[11px] h-8 font-bold flex-1"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> New Chat
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsUrgent(!isUrgent)}
              className={cn("text-[11px] h-8 font-bold flex-1 sm:flex-none", isUrgent ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-200" : "")}
            >
              {isUrgent ? "Disable Urgent Mode" : "Enable Urgent Mode"}
            </Button>
            
            <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden flex items-center gap-2 h-8 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 flex-1">
                  <History className="h-4 w-4" />
                  <span className="text-[11px] font-bold">History</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 border-l-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Chat History</SheetTitle>
                  <SheetDescription>View your previous legal aid conversations</SheetDescription>
                </SheetHeader>
                <div className="h-full flex flex-col bg-slate-50/30">
                  <div className="flex-1 overflow-hidden p-4">
                    <SidebarContent />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-6">
            {messages.length === 0 && (
                <div className="text-center text-slate-400 mt-20">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="text-sm">Ask a legal question below.</p>
                    <p className="text-xs mt-2 text-slate-300">"What are my rights at a checkpoint?"</p>
                </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-4 max-w-[90%]", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}>
                <Avatar className={cn("h-8 w-8 mt-1", msg.role === "ai" ? "bg-primary text-white" : "bg-slate-200")}>
                  {msg.role === "ai" ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </Avatar>
                
                <div className={cn("space-y-2", msg.role === "user" ? "items-end" : "items-start w-full")}>
                  <div className={cn(
                      "p-4 rounded-2xl text-sm leading-relaxed shadow-sm prose prose-sm max-w-none",
                      msg.role === "user" 
                        ? "bg-primary text-white rounded-tr-none" 
                        : "bg-slate-50 border rounded-tl-none"
                    )}>
                      <ReactMarkdown>{msg.text || msg.content || ""}</ReactMarkdown>
                      
                      {msg.role === "ai" && (msg.text || msg.content || "").toLowerCase().includes("contact lawyer") && (
                        <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
                          <Button 
                            size="sm" 
                            className="text-[11px] h-8 font-bold gap-2"
                            onClick={() => {
                              // Extract lawyer name from AI response if possible, or use a generic one
                              const text = (msg.text || msg.content || "");
                              const lawyerMatch = text.match(/\*\*([^*]+)\*\*/); // Look for bolded text
                              const lawyerName = lawyerMatch ? lawyerMatch[1] : "Legal Expert";
                              recordLeadMutation.mutate({ lawyerId: "proximity_search", lawyerName });
                            }}
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Contact Lawyer
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-[11px] h-8 font-bold gap-2"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Submit Case File
                          </Button>
                        </div>
                      )}
                    </div>
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {msg.sources.map((source, idx) => (
                        <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full flex items-center gap-1 hover:underline">
                          <ShieldCheck className="h-3 w-3" /> {source.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isTyping && (
               <div className="flex gap-4 max-w-[80%]">
                 <Avatar className="h-8 w-8 bg-primary text-white"><ShieldCheck className="h-4 w-4" /></Avatar>
                 <div className="bg-slate-50 border p-4 rounded-2xl rounded-tl-none flex gap-1">
                   <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                   <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                   <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                 </div>
               </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-white">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-3"
          >
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isUrgent ? "Describe emergency situation..." : "Ask about your rights..."}
              className={cn("flex-1 rounded-xl h-12 border-slate-200 focus-visible:ring-primary", isUrgent ? "bg-red-50 placeholder:text-red-300" : "bg-slate-50")}
            />
            <Button 
              type="button" 
              size="icon" 
              variant="outline" 
              onClick={toggleListening}
              className={cn(
                "h-12 w-12 rounded-xl transition-all relative overflow-hidden", 
                isListening ? "bg-red-500 text-white border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "text-slate-400 hover:text-slate-600"
              )}
            >
                <Mic className={cn("h-5 w-5 z-10", isListening ? "fill-current animate-pulse" : "")} />
                {isListening && (
                  <span className="absolute inset-0 bg-red-400 animate-ping opacity-20"></span>
                )}
            </Button>
            <Button 
              type="submit" 
              id="send-message-btn"
              size="icon" 
              className={cn("h-12 w-12 rounded-xl shadow-lg", isUrgent ? "bg-red-600 hover:bg-red-700" : "")}
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>

      <SurveyDialog 
        isOpen={showSurveyDialog} 
        onClose={() => setShowSurveyDialog(false)} 
        feature="civic-guard"
      />

      <SabiContributorModal
        isOpen={showSabiModal}
        onClose={() => setShowSabiModal(false)}
      />
    </div>
  );
}
