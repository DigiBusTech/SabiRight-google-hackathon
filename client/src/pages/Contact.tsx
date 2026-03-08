import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Mail, MessageSquare, MapPin, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Contact() {
  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const getSetting = (key: string) => settings.find((s: any) => s.key === key)?.value;
  const contactContent = getSetting('contact_content');
  
  const email = getSetting('contact_email') || "support@sabiright.com";
  const phone = getSetting('footer_phone') || "+234 (0) 123 456 789";
  const address = getSetting('footer_address') || "Lagos, Nigeria";

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar />

      <main className="pt-36 pb-24">
        {contactContent ? (
          <div className="max-w-7xl mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="prose prose-slate lg:prose-xl max-w-none bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100"
              dangerouslySetInnerHTML={{ __html: contactContent }}
            />
          </div>
        ) : (
          <>
            <header className="bg-white text-center pb-20">
              <div className="max-w-7xl mx-auto px-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h1 className="text-5xl lg:text-7xl font-black mb-6">Get in <span className="text-primary">Touch</span></h1>
                  <p className="text-xl text-slate-600 max-w-2xl mx-auto">Have questions or need support? Our team is here to help you navigate your civic journey.</p>
                </motion.div>
              </div>
            </header>

            <section className="py-24">
              <div className="max-w-7xl mx-auto px-6">
                <div className="grid lg:grid-cols-2 gap-16">
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                  >
                    <h2 className="text-3xl font-black mb-8">Send us a Message</h2>
                    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                      <div className="grid sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
                          <Input placeholder="Your Name" className="h-14 rounded-2xl bg-white border-slate-200" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                          <Input type="email" placeholder="email@example.com" className="h-14 rounded-2xl bg-white border-slate-200" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Subject</label>
                        <Input placeholder="How can we help?" className="h-14 rounded-2xl bg-white border-slate-200" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Message</label>
                        <Textarea placeholder="Tell us more about your inquiry..." className="min-h-[150px] rounded-2xl bg-white border-slate-200 p-4" />
                      </div>
                      <Button className="w-full h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20">
                        Send Message
                      </Button>
                    </form>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="space-y-12"
                  >
                    <h2 className="text-3xl font-black mb-8">Contact Information</h2>
                    <div className="grid gap-8">
                      {[
                        { icon: Mail, title: "Email Support", value: email, desc: "Response within 24 hours" },
                        { icon: MessageSquare, title: "Live Chat", value: "Available in-app", desc: "24/7 AI-powered assistance" },
                        { icon: MapPin, title: "Office Location", value: address, desc: "Civic Innovation Hub" },
                        { icon: Phone, title: "Phone Line", value: phone, desc: "Mon-Fri, 9am - 5pm" }
                      ].map((item, i) => (
                        <div key={i} className="flex gap-6 items-start">
                          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <item.icon className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold mb-1">{item.title}</h4>
                            <p className="text-slate-900 font-medium">{item.value}</p>
                            <p className="text-sm text-slate-500">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
