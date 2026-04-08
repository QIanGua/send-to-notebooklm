export type ActiveTab =
  | 'bulk-import'
  | 'notebooks'
  | 'chat'
  | 'slide'
  | 'infographic'
  | 'report'
  | 'video'
  | 'settings';

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
