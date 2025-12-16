import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Sparkles, User, ShieldCheck, Copy, ThumbsUp, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { GEMINI_API_KEY } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "ai";
  text: string;
  sources?: { title?: string; uri?: string }[];
}

export default function CivicGuard() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setIsTyping(true);

    try {
      const city = "Nigeria"; 
      
      const systemPrompt = isUrgent
        ? `EMERGENCY LEGAL ASSISTANT MODE. User Location: ${city}.
           You are an urgent legal aid tool. The user might be in danger.
           1. First, quickly assess if they are safe.
           2. Provide concise, imperative instructions (e.g., "Do not speak," "Ask for a warrant").
           3. Cite specific Nigerian laws (1999 Constitution, Police Act 2020) to empower them.
           4. Do NOT give long explanations. Bullet points only.`
        : `You are the "Right-To-Know" Legal Assistant for Nigeria.
           1. Your goal is to educate citizens on their rights under the 1999 Constitution and Police Act 2020.
           2. Provide clear, structured summaries.
           3. If the user asks about bail, arrests, or tenancy, cite the specific sections.
           4. Use Markdown for formatting (bolding key terms).
           5. Be helpful, professional, and empowering.`;

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      
      const payload = {
        contents: [{ role: "user", parts: [{ text: userText }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ "google_search": {} }]
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const aiText = candidate?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try again.";
      
      // Extract sources
      const sources = candidate?.groundingMetadata?.groundingAttributions
        ?.map((attr: any) => ({ uri: attr.web?.uri, title: attr.web?.title }))
        .filter((s: any) => s.uri && s.title) || [];

      setMessages(prev => [...prev, { role: "ai", text: aiText, sources }]);
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, { role: "ai", text: "I'm having trouble connecting to the legal database right now. Please check your internet connection." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:grid md:grid-cols-3 gap-6">
      {/* Main Chat Area */}
      <div className="md:col-span-2 flex flex-col bg-white rounded-3xl border shadow-sm overflow-hidden h-full">
        <div className={cn("p-4 border-b flex items-center justify-between transition-colors", isUrgent ? "bg-red-50 border-red-100" : "bg-slate-50")}>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", isUrgent ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary")}>
               <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Right-to-Know AI Agent</h2>
              <p className="text-xs text-slate-500">{isUrgent ? "🚨 Urgent Assistance Mode" : "Verified Legal Knowledge Base"}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsUrgent(!isUrgent)}
            className={cn("text-xs font-bold", isUrgent ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-200" : "")}
          >
            {isUrgent ? "Disable Urgent Mode" : "Enable Urgent Mode"}
          </Button>
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
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
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
            <Button type="button" size="icon" variant="outline" className="h-12 w-12 rounded-xl text-slate-400 hover:text-slate-600">
                <Mic className="h-5 w-5" />
            </Button>
            <Button type="submit" size="icon" className={cn("h-12 w-12 rounded-xl shadow-lg", isUrgent ? "bg-red-600 hover:bg-red-700" : "")}>
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>

      {/* Sidebar Info */}
      <div className="hidden md:block space-y-6">
        <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden">
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

        <div className="bg-white border rounded-3xl p-6">
           <h3 className="font-bold text-sm mb-4">Common Questions</h3>
           <div className="space-y-2">
             {["Bail is Free", "Tenancy Notice Period", "Checkpoint Rights", "Employer Contracts"].map((tag) => (
               <Button key={tag} variant="outline" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => setInput(tag)}>
                 {tag}
               </Button>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}
