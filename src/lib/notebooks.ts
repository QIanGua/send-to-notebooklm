import { browser } from 'wxt/browser';

export interface NotebookSummary {
  id: string;
  name: string;
  sources: number;
  emoji: string;
}

export async function fetchNotebooks(): Promise<NotebookSummary[]> {
  const response = (await browser.runtime.sendMessage({
    type: 'fetch-notebooks',
  })) as {
    ok?: boolean;
    notebooks?: NotebookSummary[];
    error?: string;
  };

  if (!response?.ok) {
    throw new Error(response?.error || 'Could not fetch notebooks.');
  }

  return response.notebooks || [];
}

export async function createNotebook(): Promise<string> {
  const response = (await browser.runtime.sendMessage({
    type: 'create-notebook',
  })) as {
    ok?: boolean;
    notebookId?: string;
    error?: string;
  };

  if (!response?.ok || !response.notebookId) {
    throw new Error(response?.error || 'Could not create notebook.');
  }

  return response.notebookId;
}
