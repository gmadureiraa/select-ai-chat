// Migrated from supabase/functions/extract-branding/index.ts
import { authedPost } from '../_lib/handler.js';

export default authedPost(async ({ body }) => {
  const { url } = body;
  if (!url) throw new Error('URL is required');

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('Firecrawl not configured');

  let formattedUrl = String(url).trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }

  const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: formattedUrl, formats: ['branding'] }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `Firecrawl request failed: ${r.status}`);

  const branding = data.data?.branding || data.branding || {};
  const brandAssets = {
    logos: {
      primary: branding.logo || branding.images?.logo || null,
      favicon: branding.favicon || branding.images?.favicon || null,
      ogImage: branding.ogImage || branding.images?.ogImage || null,
    },
    colors: {
      primary: branding.colors?.primary || null,
      secondary: branding.colors?.secondary || null,
      accent: branding.colors?.accent || null,
      background: branding.colors?.background || null,
      textPrimary: branding.colors?.textPrimary || null,
      textSecondary: branding.colors?.textSecondary || null,
    },
    typography: {
      fonts: branding.fonts?.map((f: any) => f.family) || [],
      primary: branding.typography?.fontFamilies?.primary || branding.typography?.fontFamilies?.heading || null,
      secondary: branding.typography?.fontFamilies?.code || null,
    },
    buttons: branding.components?.buttonPrimary
      ? {
          primaryBg: branding.components.buttonPrimary.background || null,
          primaryText: branding.components.buttonPrimary.textColor || null,
          secondaryBg: branding.components?.buttonSecondary?.background || null,
          secondaryText: branding.components?.buttonSecondary?.textColor || null,
          borderRadius: branding.components.buttonPrimary.borderRadius || branding.spacing?.borderRadius || null,
        }
      : null,
    colorScheme: branding.colorScheme || 'light',
    importedFrom: formattedUrl,
    importedAt: new Date().toISOString(),
  };

  return { success: true, data: brandAssets, raw: branding };
});
