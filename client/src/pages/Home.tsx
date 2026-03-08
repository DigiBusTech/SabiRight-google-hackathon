import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, MapPin, Search, MessageSquare, Briefcase, Users, Scale, AlertTriangle, ChevronDown, User, Star, Code } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getYouTubeEmbedUrl } from "@/lib/utils";

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [email, setEmail] = useState("");

  const { data: faqs = [] } = useQuery<any[]>({
    queryKey: ['/api/faqs'],
  });

  const { data: testimonialsData = [] } = useQuery<any[]>({
    queryKey: ['/api/testimonials'],
  });

  const { data: settings = {} } = useQuery<any>({
    queryKey: ['/api/settings/public'],
    queryFn: async () => {
      const res = await fetch('/api/settings/public');
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 0, // Always fetch fresh settings
    refetchOnWindowFocus: true
  });

  const getSetting = (key: string) => settings[key];
  const videoDemoUrl = getYouTubeEmbedUrl(getSetting('video_demo_url'));
  const heroTitle = getSetting('hero_title') || "The Future of Civic Engagement is AI-Powered.";
  const heroSubtitle = getSetting('hero_subtitle') || "SabiRight is Nigeria's first unified platform for lawful civic education, real-time alerts, and expert matching. Know your rights, navigate safely, and connect with pros.";
  const advantagesTitle = getSetting('platform_advantages_title') || "Powerful Dashboard for Every Citizen";

  const activeFaqs = faqs.filter(f => f.isActive).sort((a, b) => (a.order || 0) - (b.order || 0));
  
  // Default testimonials if none are in the database
  const defaultTestimonials = [
    {
      id: 'default-1',
      name: 'Chidi O.',
      role: 'Business Owner',
      content: 'SabiRight helped me understand my rights during a police stop in Lagos. The AI guidance was calm and accurate.',
      rating: 5,
      isActive: true
    },
    {
      id: 'default-2',
      name: 'Amaka E.',
      role: 'Law Student',
      content: 'The Legal First Aid feature is revolutionary. It breaks down complex Nigerian laws into simple, actionable steps.',
      rating: 5,
      isActive: true
    },
    {
      id: 'default-3',
      name: 'Tunde W.',
      role: 'Daily Commuter',
      content: 'I use SabiRight every day for traffic alerts. It has saved me hours of frustration on the road.',
      rating: 4,
      isActive: true
    }
  ];

  const activeTestimonials = testimonialsData.length > 0 
    ? testimonialsData.filter(t => t.isActive)
    : defaultTestimonials;

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: [0.5, 0, 0, 1] }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const hoverScale: any = {
    hover: { 
      scale: 1.05, 
      translateY: -5,
      transition: { duration: 0.3, ease: "easeOut" }
    },
    tap: { scale: 0.95 }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      <Navbar />

      {/* Hero Section */}
      <header className="relative pt-36 pb-20 overflow-hidden">
        {/* Blobs */}
        <div className="blob bg-blue-200 w-[400px] h-[400px] top-[-10%] -left-20 animate-float" />
        <div className="blob bg-purple-200 w-[400px] h-[400px] bottom-0 -right-20 animate-float" style={{ animationDelay: "2s" }} />

        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border shadow-sm text-primary text-sm font-bold mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live in Lagos, Abuja & PH
            </div>
            
            <motion.h1 
              variants={fadeInUp}
              className="text-5xl lg:text-7xl font-black leading-[1.1] mb-6"
            >
              {heroTitle}
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-lg text-slate-600 max-w-lg mb-10 italic"
            >
              {heroSubtitle}
            </motion.p>
            
            <div className="flex flex-wrap gap-4">
              <Link href="/app">
                <motion.div
                  whileHover="hover"
                  whileTap="tap"
                  variants={hoverScale}
                >
                  <Button className="h-14 px-8 rounded-2xl text-lg font-bold shadow-xl">
                    Launch App <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative flex justify-center lg:justify-end"
          >
            <div className="phone-mockup w-[300px] aspect-[9/19.5]">
              <div className="h-full flex flex-col bg-slate-50 overflow-y-auto no-scrollbar">
                {/* Mockup Header */}
                <div className="bg-white p-4 pt-8 border-b flex justify-between items-center sticky top-0 z-20">
                  <div className="flex items-center gap-2">
                    <img src="/assets/sabiright-icon.png" alt="SabiRight" className="w-6 h-6 rounded" />
                    <span className="font-bold text-xs">SabiRight</span>
                  </div>
                  <div className="flex gap-3 text-slate-400">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                  </div>
                </div>

                {/* Mockup Content */}
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Good Morning</p>
                    <p className="text-lg font-bold">Uyouko</p>
                  </div>
                  
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-red-100">
                    <p className="text-[10px] font-bold text-red-600 uppercase flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Traffic Alert · Lagos
                    </p>
                    <p className="text-xs font-bold mt-1">Major Route Traffic Update</p>
                    <p className="text-[10px] text-slate-500">Route calculation suggests +45min delay.</p>
                  </div>

                  <div className="animate-pulse-glow bg-white p-3 border rounded-xl flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Shield className="h-3 w-3" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium italic">Ask Right-To-Know AI...</p>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-2">
                      <span>Verified Near You</span><span className="text-primary">View All</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                      <div className="min-w-[130px] bg-white p-3 rounded-xl shadow-sm border">
                        <Scale className="h-4 w-4 text-primary mb-1" />
                        <p className="text-[10px] font-bold mt-1">Barr. Nnamdi</p>
                        <p className="text-[9px] text-slate-400">0.4km away · 5min</p>
                      </div>
                      <div className="min-w-[130px] bg-white p-3 rounded-xl shadow-sm border">
                        <MapPin className="h-4 w-4 text-orange-500 mb-1" />
                        <p className="text-[10px] font-bold mt-1">FixIt Pro</p>
                        <p className="text-[9px] text-slate-400">1.2km away · 12min</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Partners Section */}
      <section className="py-16 bg-white dark:bg-slate-900 border-y border-slate-100 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm font-black text-primary/40 uppercase tracking-[0.2em] mb-12">Empowered by Multi-Model AI Intelligence</p>
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-20 opacity-80 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex flex-col items-center gap-3 group">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-slate-700 transition-colors">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Google_Gemini_logo.svg/2560px-Google_Gemini_logo.svg.png" alt="Google Gemini" className="h-6 object-contain" />
              </div>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider">GEMINI 1.5 PRO</span>
            </div>
            <div className="flex flex-col items-center gap-3 group">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-slate-100 dark:group-hover:bg-slate-700 transition-colors">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/2560px-OpenAI_Logo.svg.png" alt="OpenAI" className="h-6 object-contain dark:invert" />
              </div>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider">GPT-4O OMNI</span>
            </div>
            <div className="flex flex-col items-center gap-3 group">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-orange-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-orange-100 dark:group-hover:bg-slate-700 transition-colors">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Anthropic_logo.svg/2560px-Anthropic_logo.svg.png" alt="Anthropic" className="h-6 object-contain dark:invert" />
              </div>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider">CLAUDE 3.5 SONNET</span>
            </div>
            <div className="flex flex-col items-center gap-3 group">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-indigo-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-slate-700 transition-colors">
                <img src="https://upload.wikimedia.org/wikipedia/commons/1/18/Meta_Platforms_Inc._logo.svg" alt="Meta Llama" className="h-6 object-contain dark:invert" />
              </div>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider">LLAMA 3.1 405B</span>
            </div>
            <div className="flex flex-col items-center gap-3 group">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-red-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-slate-700 transition-colors">
                <img src="https://mintlify.s3.us-west-1.amazonaws.com/groq/logo/light.svg" alt="Groq" className="h-6 object-contain dark:invert" />
              </div>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider">GROQ LPU™ SPEED</span>
            </div>
            <div className="flex flex-col items-center gap-3 group">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-purple-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-slate-700 transition-colors">
                <Code className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider">BUILT WITH TRAE</span>
            </div>
          </div>
        </div>
      </section>

      {/* Video Section - Explicitly Added per User Request */}
      {videoDemoUrl && (
        <section className="py-24 bg-slate-900 text-white overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
             <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold mb-8 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Watch How It Works
              </div>
              <h2 className="text-3xl md:text-5xl font-black mb-12">See SabiRight in Action</h2>
              
              <div className="max-w-4xl mx-auto aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/20">
                  <iframe 
                    src={videoDemoUrl} 
                    className="w-full h-full" 
                    title="SabiRight Demo"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  />
              </div>
          </div>
        </section>
      )}

      {/* Problem Section */}
      <section id="problem" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-4xl font-extrabold mb-6 leading-tight">
              Knowledge is Peace.<br/>
              <span className="text-primary uppercase">Empowering Citizens.</span>
            </h2>
            <p className="text-slate-600 text-lg mb-8 text-justify">
              SabiRight works like first aid — offering immediate, law-based guidance and then connecting users to verified professionals nearby. Everything is strictly based on Nigerian law, including the Police Act, to reduce conflict, misinformation, and citizen-officer tension.
            </p>
            <div className="space-y-4 font-bold text-slate-700">
              <p className="flex items-center gap-3"><span className="text-green-500">✔</span> Curated AI Job Matching Board</p>
              <p className="flex items-center gap-3"><span className="text-green-500">✔</span> Lawful Civic Education & Support</p>
              <p className="flex items-center gap-3"><span className="text-green-500">✔</span> Community Forum</p>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden"
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary opacity-20 rounded-full blur-3xl"></div>
            <h3 className="text-2xl font-bold mb-8 text-blue-400">The Unified Solution</h3>
            <div className="space-y-8 relative z-10">
              <div className="flex gap-5">
                <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center text-green-400 shrink-0">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold">Lawful Civic Guidance</p>
                  <p className="text-sm text-slate-400">Based strictly on the 1999 Constitution and Police Act.</p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 shrink-0">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold">Community & Civic Guidance</p>
                  <p className="text-sm text-slate-400">Real-life Google Maps route data matching for experts.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Platform Advantages Graphic Section */}
      <section className="py-24 bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4">{advantagesTitle}</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">Manage your civic life, track alerts, and access legal first aid all in one place.</p>
          </div>
          
          <div className="relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                 {/* Central Graphic */}
                 <div className="relative aspect-square max-w-lg mx-auto">
                    {/* Background Circles */}
                    <div className="absolute inset-0 bg-primary/5 rounded-full animate-pulse-slow"></div>
                    <div className="absolute inset-8 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-slate-100 z-10">
                        <img src="/assets/sabiright-icon.png" alt="SabiRight Core" className="w-32 h-32 object-contain opacity-20" />
                    </div>

                    {/* Orbiting Features */}
                    <div className="absolute inset-0 animate-spin-slow z-20">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-2xl shadow-xl border border-blue-100 w-48 text-center">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Scale className="w-5 h-5" />
                            </div>
                            <p className="font-bold text-xs text-slate-800">Legal First Aid</p>
                            <p className="text-[10px] text-slate-400">AI Constitution Guide</p>
                        </div>
                    </div>

                    <div className="absolute inset-0 animate-spin-slow animation-delay-2000 z-20" style={{ animationDirection: 'reverse' }}>
                         <div className="absolute bottom-10 left-0 bg-white p-4 rounded-2xl shadow-xl border border-green-100 w-48 text-center">
                            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <p className="font-bold text-xs text-slate-800">Traffic Alerts</p>
                            <p className="text-[10px] text-slate-400">Live Checkpoints</p>
                        </div>
                    </div>

                     <div className="absolute inset-0 z-20">
                         <div className="absolute bottom-10 right-0 bg-white p-4 rounded-2xl shadow-xl border border-purple-100 w-48 text-center">
                            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Search className="w-5 h-5" />
                            </div>
                            <p className="font-bold text-xs text-slate-800">Verified Pros</p>
                            <p className="text-[10px] text-slate-400">Find Lawyers & Fixers</p>
                        </div>
                    </div>
                 </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                {[
                  { title: "Real-time Traffic & Checkpoints", desc: "Get instant updates on your route and stay informed about checkpoint hotspots.", color: "border-primary" },
                  { title: "Legal First Aid AI", desc: "Chat with SabiDoctor AI to understand your rights in any situation.", color: "border-green-500" },
                  { title: "Verified Professionals", desc: "Connect with lawyers, fixers, and other pros verified by the community.", color: "border-purple-500" }
                ].map((feature, i) => (
                  <div key={i} className={`bg-white p-6 rounded-2xl border-l-4 ${feature.color} shadow-sm hover:shadow-md transition-shadow`}>
                    <h4 className="text-xl font-bold mb-2">{feature.title}</h4>
                    <p className="text-slate-600">{feature.desc}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Agent Section */}
      <section id="ai-agent" className="py-24 bg-slate-950 text-white relative">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div
             initial="initial"
             whileInView="animate"
             viewport={{ once: true }}
             variants={fadeInUp}
          >
            <h2 className="text-4xl md:text-6xl font-black mb-8">
              <span className="text-gradient">SabiDoctor</span> AI
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-16 italic">
              Facing a complex situation? Get instant, law-based first aid guidance on exactly how to handle it calmly and lawfully. Your pocket educator for civic rights.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8 text-left">
            {[
              { icon: Scale, color: "text-brand-500", title: "Neural Knowledge Base", desc: "Retrieval-Augmented Generation (R.A.G.) citing specific sections of the 1999 Constitution and the Nigerian Police Force (NPF) Act." },
              { icon: MessageSquare, color: "text-green-400", title: "Multi-Lingual OS", desc: "Complex bureaucratic laws instantly explained in English, Pidgin, Hausa, Yoruba, or Igbo for maximum clarity." },
              { icon: Shield, color: "text-purple-400", title: "Immediate Guard", desc: "No 'hallucinations.' Our AI only uses a strictly vetted library of Federal Laws and State Bylaws." }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 p-8 rounded-3xl border border-white/10 hover:border-primary transition-colors"
              >
                <item.icon className={`h-8 w-8 ${item.color} mb-6`} />
                <h4 className="text-xl font-bold mb-4">{item.title}</h4>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-extrabold mb-16 leading-tight">The SabiRight Ecosystem</h2>
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-4 gap-6"
          >
            {[
              { icon: Scale, color: "bg-primary", borderColor: "border-primary", title: "SabiGuard", desc: "Legal First Aid & Expert Advice powered by AI. Know your rights instantly.", badge: "Sabi Doctor" },
              { icon: MapPin, color: "bg-green-600", borderColor: "border-green-600", title: "SabiMove", desc: "Smart Traffic, Cloaked Routes & Checkpoint alerts. Navigate safely.", badge: "Sabi Navigator" },
              { icon: Search, color: "bg-purple-600", borderColor: "border-purple-600", title: "SabiMarket", desc: "Proximity-based Verified Professionals marketplace. Find trusted pros.", badge: "Find Pros" },
              { icon: Users, color: "bg-pink-600", borderColor: "border-pink-600", title: "SabiSquare", desc: "Community Forum and Civic knowledge hub.", badge: "The Hub" }
            ].map((pillar, i) => (
              <motion.div 
                key={i}
                variants={fadeInUp}
                whileHover={{ y: -10, transition: { duration: 0.3 } }}
                className={`bg-slate-50 p-8 rounded-[2rem] border-t-8 ${pillar.borderColor} relative shadow-sm hover:shadow-xl transition-all duration-300`}
              >
                <div className={`w-14 h-14 ${pillar.color} text-white rounded-2xl flex items-center justify-center mb-5 mx-auto shadow-lg`}>
                  <pillar.icon className="h-7 w-7" />
                </div>
                <h4 className="text-xl font-bold mb-3">{pillar.title}</h4>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">{pillar.desc}</p>
                <span className="px-3 py-1 rounded-full bg-slate-200 text-[9px] font-black uppercase text-slate-500 tracking-widest">{pillar.badge}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>



      {/* How It Works Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-extrabold text-center mb-16">How SabiRight Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Sign Up Free", desc: "Create your account in seconds using email or Google. No payment required to get started." },
              { step: "02", title: "Get Verified", desc: "Complete email verification to unlock premium features and build trust in the marketplace." },
              { step: "03", title: "Use Your Credits", desc: "Every account gets free daily credits. Use them for AI legal help, job searches, and more." },
              { step: "04", title: "Connect & Grow", desc: "Find verified professionals, post jobs, join forums, and become part of a civic-minded community." }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-5xl font-black text-primary/20 mb-4">{item.step}</div>
                <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                <p className="text-slate-600 text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {(activeFaqs.length > 0 ? activeFaqs : [
              { question: "How accurate is the AI Legal Guard?", answer: "SabiGuard uses Retrieval-Augmented Generation (RAG) to cite specific sections of the 1999 Constitution and NPF Act 2020. It provides accurate legal information but is not a substitute for professional legal advice in complex matters." },
              { question: "Is the platform free to use?", answer: "Yes! Core features including civic alerts, basic AI legal queries, and community forums are completely free. Premium features like unlimited AI queries, job matching, and priority marketplace placement use Credits which you can earn or purchase." },
              { question: "What are Credits and how do I get them?", answer: "Credits are your in-app currency for premium features. New users get 10 free credits daily. You can earn more by completing your profile, verifying your email, referring friends, or purchasing credit packs." },
              { question: "How does SabiMove help with traffic?", answer: "SabiMove provides real-time traffic updates, checkpoint alerts, and AI-powered route optimization. Our 'Cloaked Routes' feature helps you navigate around known checkpoint hotspots while staying completely legal." }
            ]).map((faq, i) => (
              <div key={faq.id || i} className="bg-white border rounded-2xl overflow-hidden">
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-6 text-left font-bold flex justify-between items-center hover:bg-slate-50 transition"
                >
                  <span>{faq.question || faq.q}</span>
                  <ChevronDown className={`transform transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="p-6 pt-0 text-slate-600 border-t text-sm bg-slate-50/50 animate-in slide-in-from-top-2 fade-in duration-300">
                    {faq.answer || faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {activeTestimonials.length > 0 && (
        <section className="py-24 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-4xl font-extrabold text-center mb-16">Citizen Success Stories</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {activeTestimonials.slice(0, 6).map((t, i) => (
                <motion.div 
                  key={t.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-slate-50 p-8 rounded-3xl border relative"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(t.rating || 5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-700 italic mb-8 leading-relaxed">"{t.content}"</p>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-white border flex items-center justify-center overflow-hidden">
                      {t.avatar ? (
                        <img src={t.avatar} alt={t.name} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-6 w-6 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.role}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter Section */}
      <section className="py-24 bg-slate-950 text-white relative overflow-hidden">
        <div className="blob bg-primary/20 w-[300px] h-[300px] -top-20 -left-20 animate-pulse" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-black mb-6">
              Stay Informed with <span className="text-gradient">SabiRight</span>
            </h2>
            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
              Subscribe to our newsletter for the latest civic alerts, legal updates, and community news delivered straight to your inbox.
            </p>
            
            <form onSubmit={(e) => e.preventDefault()} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="h-14 rounded-2xl bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:bg-white/20 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button className="h-14 px-8 rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform shrink-0">
                  Subscribe Now
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                We respect your privacy. Unsubscribe at any time.
              </p>
            </form>
            
            <div className="mt-16 pt-16 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <p className="text-3xl font-black text-white">10k+</p>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">Active Users</p>
              </div>
              <div>
                <p className="text-3xl font-black text-white">500+</p>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">Verified Pros</p>
              </div>
              <div>
                <p className="text-3xl font-black text-white">24/7</p>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">AI Support</p>
              </div>
              <div>
                <p className="text-3xl font-black text-white">100%</p>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">Law-Based</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
