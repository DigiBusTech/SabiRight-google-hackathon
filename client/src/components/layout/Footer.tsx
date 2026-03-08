import { ShieldCheck, Twitter, Instagram, Linkedin, Facebook, Youtube, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function Footer() {
  const { data: settingsList = [] } = useQuery<any[]>({
    queryKey: ['/api/settings'],
  });

  // Convert settings list to a more usable object
  const settings: Record<string, any> = {};
  settingsList.forEach(s => {
    settings[s.key] = s.value;
  });

  const siteTitle = settings.site_title || "SabiRight";
  const siteLogo = settings.site_logo || "/assets/sabiright-icon.png";
  const footerText = settings.footer_text || `© ${new Date().getFullYear()} ${siteTitle}. All Rights Reserved.`;
  const footerDescription = settings.seo_description || "Empowering Nigerian citizens with AI-driven civic education and support.";

  const socialIcons = [
    { key: 'social_facebook', icon: Facebook, label: 'Facebook' },
    { key: 'social_twitter', icon: Twitter, label: 'Twitter' },
    { key: 'social_instagram', icon: Instagram, label: 'Instagram' },
    { key: 'social_linkedin', icon: Linkedin, label: 'LinkedIn' },
    { key: 'social_youtube', icon: Youtube, label: 'YouTube' },
    { key: 'social_whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  ];

  return (
    <footer className="bg-slate-900 text-slate-400 py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-16 text-left">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <img 
                src={siteLogo} 
                alt={siteTitle} 
                className="h-8 w-8 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/assets/sabiright-icon.png";
                }}
              />
              <span className="text-white font-bold text-xl tracking-tight">{siteTitle}</span>
            </div>
            <p className="mb-8 text-sm max-w-sm italic leading-relaxed">
              {footerDescription}
            </p>
            <div className="flex flex-wrap gap-4">
              {socialIcons.map((social) => {
                const href = settings[social.key];
                if (!href || href === '#' || href === '') return null;
                
                return (
                  <a 
                    key={social.key}
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all transform hover:scale-110"
                    title={social.label}
                  >
                    <social.icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 uppercase text-xs tracking-widest">Platform</h4>
            <ul className="space-y-4 text-sm">
              <li><a href="/about" className="hover:text-white transition">About Us</a></li>
              <li><a href="/pricing" className="hover:text-white transition">Pricing Plans</a></li>
              <li><a href="/app/forum" className="hover:text-white transition">Community Forum</a></li>
              <li><a href="/contact" className="hover:text-white transition">Contact Support</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 uppercase text-xs tracking-widest">Legal</h4>
            <ul className="space-y-4 text-sm">
              <li><a href="/privacy" className="hover:text-white transition">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-white transition">Terms of Service</a></li>
              <li><a href="/cookies" className="hover:text-white transition">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <p className="text-xs opacity-50 uppercase tracking-widest">
            {footerText}
          </p>
          <p className="text-[10px] opacity-30">
            Based on Nigerian Constitution & Police Act 2020.
          </p>
        </div>
      </div>
    </footer>
  );
}
