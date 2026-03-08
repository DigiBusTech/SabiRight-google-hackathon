import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

export function SEO({ 
  title, 
  description, 
  keywords, 
  image, 
  url,
  type = 'website' 
}: SEOProps) {
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

  // Defaults from Admin Settings
  const siteTitle = getSetting('site_title') || 'SabiRight';
  const defaultTitle = getSetting('seo_title') || `${siteTitle} - AI Civic Super-App`;
  const defaultDescription = getSetting('seo_description') || 'SabiRight is an AI-powered Civic Super-App for emerging markets. Legal First Aid, Smart Traffic routing, AI-powered Jobs, and a Verified Marketplace.';
  const defaultKeywords = getSetting('seo_keywords') || 'civic tech, legal aid, traffic, jobs, marketplace, nigeria, ai';
  const defaultImage = getSetting('og_image') || '/assets/sabiright-logo.png';

  // Computed values
  const pageTitle = title ? `${title} | ${siteTitle}` : defaultTitle;
  const pageDescription = description || defaultDescription;
  const pageKeywords = keywords || defaultKeywords;
  const pageImage = image || defaultImage;
  const pageUrl = url || window.location.href;

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta name="keywords" content={pageKeywords} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:image" content={pageImage} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={pageUrl} />
      <meta property="twitter:title" content={pageTitle} />
      <meta property="twitter:description" content={pageDescription} />
      <meta property="twitter:image" content={pageImage} />
    </Helmet>
  );
}
