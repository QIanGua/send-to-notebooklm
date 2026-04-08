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
    initialMountDelayMs: 200,
    remountDelayMs: 100,
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
    initialMountDelayMs: 200,
    remountDelayMs: 150,
    hostStyle: {
      display: 'flex',
      alignItems: 'center',
      marginLeft: '8px',
    },
  },
  {
    id: 'pdf',
    displayName: 'PDF',
    contentScriptMatches: ['*://*/*.pdf', '*://*/*.pdf?*', '*://*/*.PDF', '*://*/*.PDF?*'],
    supports(url) {
      return url.pathname.toLowerCase().endsWith('.pdf');
    },
    collect(url) {
      const fileName = url.pathname.split('/').pop() || 'document.pdf';
      return {
        id: 'pdf',
        displayName: 'PDF Document',
        pageType: 'pdf',
        itemId: fileName,
        sourceKind: 'pdf',
        sourceUrl: url.toString(),
      };
    },
    canMount() {
      // Typically we don't mount on generic PDF pages because they are rendered by the browser's internal viewer
      // where content scripts have limited access. The Popup is the primary way to send these.
      return false;
    },
    findMountAnchor() {
      return null;
    },
    insertPosition: 'after',
    initialMountDelayMs: 200,
    remountDelayMs: 150,
  },
  {
    id: 'bilibili',
    displayName: 'B站',
    contentScriptMatches: [
      '*://*.bilibili.com/video/*',
      '*://*.bilibili.com/bangumi/play/*',
      '*://space.bilibili.com/*/lists/*',
    ],
    supports(url) {
      return url.hostname.includes('bilibili.com');
    },
    collect(url) {
      const videoMatch = url.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
      if (videoMatch) {
        return {
          id: 'bilibili',
          displayName: 'B站',
          pageType: 'video',
          itemId: videoMatch[1],
          sourceKind: 'video',
          sourceUrl: `https://www.bilibili.com/video/${videoMatch[1]}`,
        };
      }
      
      if (url.pathname.includes('/bangumi/play/')) {
        return {
          id: 'bilibili',
          displayName: 'B站 番剧',
          pageType: 'video',
          itemId: url.pathname.split('/').pop() || 'bangumi',
          sourceKind: 'video',
          sourceUrl: url.toString(),
        };
      }

      const listMatch = url.pathname.match(/\/(\d+)\/lists\/(\d+)/);
      if (listMatch) {
        return {
          id: 'bilibili',
          displayName: 'B站 合集',
          pageType: 'playlist',
          itemId: listMatch[2],
          sourceKind: 'video',
          sourceUrl: url.toString(),
        };
      }

      return {
        id: 'bilibili',
        displayName: 'B站',
        pageType: 'other',
        sourceKind: 'url',
        sourceUrl: '',
      };
    },
    canMount(page) {
      return page.site?.id === 'bilibili' && (page.site.pageType === 'video' || page.site.pageType === 'playlist');
    },
    findMountAnchor() {
      return (
        document.querySelector('#arc_toolbar_report .toolbar-left') ||
        document.querySelector('.video-toolbar-left') ||
        document.querySelector('.toolbar-left') ||
        document.querySelector('.video-toolbar .ops') ||
        document.querySelector('.video-info-detail-list') ||
        document.querySelector('.list-video-info') ||
        document.querySelector('.breadcrumb')
      );
    },
    insertPosition: 'after',
    initialMountDelayMs: 400,
    remountDelayMs: 200,
    hostStyle: {
      display: 'inline-flex',
      alignItems: 'center',
      marginLeft: '8px',
      verticalAlign: 'middle',
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
