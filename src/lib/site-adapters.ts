import { buildPageContext, type PageContext, type SiteContext } from './page-context';

export interface SiteAdapter {
  id: string;
  displayName: string;
  contentScriptMatches: string[];
  supports(url: URL): boolean;
  collect(url: URL): SiteContext | null;
  canMount(page: PageContext): boolean;
  findMountAnchor(): HTMLElement | null;
  insertPosition: 'after' | 'last';
  initialMountDelayMs: number;
  remountDelayMs: number;
  hostStyle?: Partial<CSSStyleDeclaration>;
}

const YOUTUBE_ACTION_SELECTORS = [
  'ytd-watch-metadata #actions',
  'ytd-watch-metadata #top-level-buttons-computed',
  'ytd-watch-metadata #menu',
  '#top-row #actions',
  'ytd-menu-renderer #top-level-buttons-computed',
  '#actions.ytd-watch-metadata',
  'ytd-watch-metadata ytd-menu-renderer',
].join(', ');

export const siteAdapters: SiteAdapter[] = [
  {
    id: 'arxiv',
    displayName: 'arXiv',
    contentScriptMatches: ['*://arxiv.org/*'],
    supports(url) {
      return url.hostname === 'arxiv.org';
    },
    collect(url) {
      const absMatch = url.pathname.match(/^\/abs\/([^/?#]+)/);
      if (absMatch) {
        const paperId = absMatch[1];
        return {
          id: 'arxiv',
          displayName: 'arXiv',
          pageType: 'abs',
          itemId: paperId,
          sourceKind: 'pdf',
          sourceUrl: `https://arxiv.org/pdf/${paperId}.pdf`,
        };
      }

      const pdfMatch = url.pathname.match(/^\/pdf\/([^/?#]+?)(?:\.pdf)?$/);
      if (pdfMatch) {
        const paperId = pdfMatch[1];
        return {
          id: 'arxiv',
          displayName: 'arXiv',
          pageType: 'pdf',
          itemId: paperId,
          sourceKind: 'pdf',
          sourceUrl: `https://arxiv.org/pdf/${paperId}.pdf`,
        };
      }

      return {
        id: 'arxiv',
        displayName: 'arXiv',
        pageType: 'other',
        sourceKind: 'url',
        sourceUrl: '',
      };
    },
    canMount(page) {
      return page.site?.id === 'arxiv' && (page.site.pageType === 'abs' || page.site.pageType === 'pdf');
    },
    findMountAnchor() {
      return document.querySelector('a[href*="/pdf/"]');
    },
    insertPosition: 'after',
    initialMountDelayMs: 500,
    remountDelayMs: 250,
  },
  {
    id: 'youtube',
    displayName: 'YouTube',
    contentScriptMatches: ['*://*.youtube.com/*', '*://youtu.be/*'],
    supports(url) {
      return ['youtu.be', 'youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname);
    },
    collect(url) {
      if (url.hostname === 'youtu.be') {
        const videoId = url.pathname.replace(/^\/+/, '').split('/')[0];
        return videoId
          ? {
              id: 'youtube',
              displayName: 'YouTube',
              pageType: 'video',
              itemId: videoId,
              sourceKind: 'video',
              sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
            }
          : null;
      }

      if (url.pathname === '/watch') {
        const videoId = url.searchParams.get('v');
        return videoId
          ? {
              id: 'youtube',
              displayName: 'YouTube',
              pageType: 'video',
              itemId: videoId,
              sourceKind: 'video',
              sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
            }
          : null;
      }

      return {
        id: 'youtube',
        displayName: 'YouTube',
        pageType: 'other',
        sourceKind: 'url',
        sourceUrl: '',
      };
    },
    canMount(page) {
      return page.site?.id === 'youtube' && page.site.pageType === 'video';
    },
    findMountAnchor() {
      return document.querySelector(YOUTUBE_ACTION_SELECTORS);
    },
    insertPosition: 'last',
    initialMountDelayMs: 500,
    remountDelayMs: 300,
    hostStyle: {
      display: 'flex',
      alignItems: 'center',
      marginLeft: '8px',
    },
  },
];

export const contentScriptMatches = Array.from(
  new Set(siteAdapters.flatMap((adapter) => adapter.contentScriptMatches)),
);

export function getSiteAdapter(url = new URL(location.href)) {
  return siteAdapters.find((adapter) => adapter.supports(url)) || null;
}

export function collectPageContext() {
  const adapter = getSiteAdapter(new URL(location.href));
  return buildPageContext(adapter?.collect(new URL(location.href)) || null);
}
