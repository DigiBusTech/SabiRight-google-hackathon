import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { motion } from "framer-motion";
import { Shield, Target, Users, Award } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function About() {
  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const getSetting = (key: string) => settings.find((s: any) => s.key === key)?.value;
  const aboutContent = getSetting('about_content');

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8 }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar />

      <main className="pt-36 pb-24">
        <div className="max-w-7xl mx-auto px-6">
          {aboutContent ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="prose prose-slate lg:prose-xl max-w-none bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100"
              dangerouslySetInnerHTML={{ __html: aboutContent }}
            />
          ) : (
            <>
              <header className="text-center mb-24">
                <motion.div {...fadeInUp}>
                  <h1 className="text-5xl lg:text-7xl font-black mb-6">
                    Our Mission to <span className="text-primary">Empower</span> Citizens
                  </h1>
                  <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                    SabiRight is more than just an app; it's a movement to bridge the gap between citizens and their rights through technology and education.
                  </p>
                </motion.div>
              </header>

              <div className="grid md:grid-cols-2 gap-16 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                >
                  <h2 className="text-4xl font-black mb-8">Why SabiRight?</h2>
                  <div className="space-y-6 text-lg text-slate-600 leading-relaxed">
                    <p>
                      In Nigeria, navigating everyday civic situations can often be stressful due to misinformation and a lack of accessible legal knowledge. SabiRight was born out of a desire to change this narrative.
                    </p>
                    <p>
                      We provide instant, law-based guidance powered by AI, ensuring that every citizen has a "Legal First Aid" kit in their pocket. Our platform is strictly based on the 1999 Constitution and the Nigerian Police Act 2020.
                    </p>
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="bg-primary/5 rounded-[3rem] p-12 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
                  <div className="grid grid-cols-2 gap-8 relative z-10">
                    {[
                      { icon: Shield, label: "Trust", value: "Verified Data" },
                      { icon: Target, label: "Focus", value: "Citizen Rights" },
                      { icon: Users, label: "Community", value: "10k+ Strong" },
                      { icon: Award, label: "Impact", value: "Civic Peace" }
                    ].map((item, i) => (
                      <div key={i} className="text-center">
                        <item.icon className="h-10 w-10 text-primary mx-auto mb-4" />
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-1">{item.label}</p>
                        <p className="text-xl font-black text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
