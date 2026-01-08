import { supabase } from '@/integrations/supabase/client';

type FirecrawlResponse<T = any> = {
  success: boolean;
  error?: string;
  data?: T;
};

type ScrapeOptions = {
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot' | 'branding' | 'summary')[];
  onlyMainContent?: boolean;
  waitFor?: number;
  location?: { country?: string; languages?: string[] };
};

type ScrapeResult = {
  markdown: string;
  html: string;
  links: string[];
  images: string[];
  metadata: {
    title: string;
    description: string;
    ogImage: string;
    sourceURL: string;
    statusCode: number;
  };
};

export const firecrawlApi = {
  /**
   * Scrape a single URL with Firecrawl
   * Returns markdown, HTML, links, and extracted images
   */
  async scrape(url: string, options?: ScrapeOptions): Promise<FirecrawlResponse<ScrapeResult>> {
    const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },
};
