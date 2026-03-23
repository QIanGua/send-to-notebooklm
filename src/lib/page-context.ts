export type SourceKind = 'url' | 'pdf' | 'video';

export interface SiteContext {
  id: string;
  displayName: string;
  pageType: string;
  sourceUrl: string;
  sourceKind: SourceKind;
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

export function collectBasePageContext(): Omit<PageContext, 'site' | 'arxiv' | 'youtube'> {
  const selection = window.getSelection?.();
  const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  const descriptionMeta = document.querySelector(
    'meta[name="description"], meta[property="og:description"]',
  ) as HTMLMetaElement | null;
  const authorMeta = document.querySelector(
    'meta[name="author"], meta[property="article:author"]',
  ) as HTMLMetaElement | null;

  return {
    title: cleanText(document.title),
    url: location.href,
    canonicalUrl: canonicalLink?.href || location.href,
    description: cleanText(descriptionMeta?.content),
    selectedText: cleanText(selection?.toString()),
    byline: cleanText(authorMeta?.content),
  };
}

export function buildPageContext(site: SiteContext | null): PageContext {
  return {
    ...collectBasePageContext(),
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

export function getPreferredSourceUrl(page: Partial<PageContext> | null | undefined) {
  return page?.site?.sourceUrl || page?.canonicalUrl || page?.url || '';
}

export function isQuickImportPage(page: Partial<PageContext> | null | undefined) {
  return Boolean(page?.site?.sourceUrl);
}
