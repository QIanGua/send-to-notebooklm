export type ActiveTab =
  | 'bulk-import'
  | 'notebooks'
  | 'podcasts'
  | 'chat'
  | 'slide'
  | 'infographic';

export type StatusTone = 'neutral' | 'success' | 'error';

export interface TabCandidate {
  id: number;
  title: string;
  url: string;
  hostname: string;
  windowId: number;
  isActive: boolean;
  isCurrentWindow: boolean;
}
