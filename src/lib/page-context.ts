export type SourceKind = 'url' | 'pdf' | 'video';
export type ImportBehavior = 'web_url' | 'pdf_url' | 'video_source';

export interface SiteContext {
  id: string;
  displayName: string;
  pageType: string;
  sourceUrl: string;
  sourceKind: SourceKind;
  importBehavior: ImportBehavior;
  itemId?: string;
}

export interface PageContext {
  title: string;
  url: string;
  canonicalUrl: string;
  description: string;
  selectedText: string;
  byline: string;
  site: SiteContext | null;
  arxiv: {
    isArxiv: boolean;
    pageType: string;
    paperId: string;
    pdfUrl: string;
  } | null;
  youtube: {
    isYouTube: boolean;
    pageType: string;
    videoId: string;
    videoUrl: string;
  } | null;
}

export function cleanText(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Creates a minimal PageContext object with default values.
 * Safe to use in background scripts or anywhere without DOM access.
 */
export function createEmptyPageContext(url: string, title?: string): PageContext {
  return {
    title: title || '',
    url,
    canonicalUrl: url,
    description: '',
    selectedText: '',
    byline: '',
    site: null,
    arxiv: null,
    youtube: null,
  };
}

/**
 * Enriches a PageContext with site-specific metadata (arXiv, YouTube, etc.)
 * based on the provided SiteContext.
 */
export function enrichPageContextWithSite(page: PageContext, site: SiteContext | null): PageContext {
  return {
    ...page,
    site,
    arxiv: site?.id === 'arxiv'
      ? {
          isArxiv: true,
          pageType: site.pageType,
          paperId: site.itemId || '',
          pdfUrl: site.sourceKind === 'pdf' ? site.sourceUrl : '',
        }
      : null,
    youtube: site?.id === 'youtube'
      ? {
          isYouTube: true,
          pageType: site.pageType,
          videoId: site.itemId || '',
          videoUrl: site.sourceKind === 'video' ? site.sourceUrl : '',
        }
      : null,
  };
}

/**
 * Original helper for content scripts. Collects base data from DOM.
 */
export function collectBasePageContext(): Omit<PageContext, 'site' | 'arxiv' | 'youtube'> {
  const selection = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
  const canonicalLink = typeof document !== 'undefined' ? document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null : null;
  const descriptionMeta = typeof document !== 'undefined' ? document.querySelector(
    'meta[name="description"], meta[property="og:description"]',
  ) as HTMLMetaElement | null : null;
  const authorMeta = typeof document !== 'undefined' ? document.querySelector(
    'meta[name="author"], meta[property="article:author"]',
  ) as HTMLMetaElement | null : null;

  return {
    title: typeof document !== 'undefined' ? cleanText(document.title) : '',
    url: typeof location !== 'undefined' ? location.href : '',
    canonicalUrl: canonicalLink?.href || (typeof location !== 'undefined' ? location.href : ''),
    description: cleanText(descriptionMeta?.content),
    selectedText: cleanText(selection?.toString()),
    byline: cleanText(authorMeta?.content),
  };
}

/**
 * Combines DOM collection with site enrichment. Used by content scripts.
 */
export function buildPageContext(site: SiteContext | null): PageContext {
  const base = collectBasePageContext();
  const page = {
    ...base,
    site: null,
    arxiv: null,
    youtube: null,
  } as PageContext;
  
  return enrichPageContextWithSite(page, site);
}

export function getPreferredSourceUrl(page: Partial<PageContext> | null | undefined) {
  return page?.site?.sourceUrl || page?.canonicalUrl || page?.url || '';
}

export function isQuickImportPage(page: Partial<PageContext> | null | undefined) {
  return Boolean(page?.site?.sourceUrl);
}

export function getImportBehavior(page: Partial<PageContext> | null | undefined): ImportBehavior {
  return page?.site?.importBehavior || 'web_url';
}
