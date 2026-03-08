import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { motion } from "framer-motion";

interface LegalPageProps {
  type: 'privacy_policy' | 'terms_of_service' | 'cookie_policy';
  title: string;
}

export default function LegalPage({ type, title }: LegalPageProps) {
  const { data: settings = {} } = useQuery<any>({
    queryKey: ['/api/settings/public'],
    queryFn: async () => {
      const res = await fetch('/api/settings/public');
      if (!res.ok) return {};
      return res.json();
    }
  });

  const content = settings[type] || 
    `<p>Our ${title} is currently being updated. Please check back soon.</p>`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-8">{title}</h1>
            
            <div 
              className="prose prose-slate dark:prose-invert max-w-none 
                prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white
                prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-p:leading-relaxed
                prose-li:text-slate-600 dark:prose-li:text-slate-400"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
