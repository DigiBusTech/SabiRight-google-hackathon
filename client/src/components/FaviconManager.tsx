import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';

export function FaviconManager() {
  const { theme } = useTheme();
  
  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getSetting = (key: string) => settings.find((s: any) => s.key === key)?.value;

  useEffect(() => {
    const lightFavicon = getSetting('favicon_light') || '/favicon.ico';
    const darkFavicon = getSetting('favicon_dark') || '/favicon.ico'; // Default fallback

    const faviconUrl = theme === 'dark' ? darkFavicon : lightFavicon;

    // Update standard favicon
    const link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (link) {
      link.href = faviconUrl;
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = faviconUrl;
      document.head.appendChild(newLink);
    }

    // Also update apple-touch-icon if needed, or other variations
  }, [theme, settings]);

  return null;
}
