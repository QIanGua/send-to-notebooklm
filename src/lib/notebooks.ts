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

export async function createNotebook(urls?: string[]): Promise<{ notebookId: string; notebookUrl?: string }> {
  const type = urls && urls.length > 0 ? 'create-notebook-and-send' : 'create-notebook';
  const response = (await browser.runtime.sendMessage({
    type,
    urls,
  })) as {
    ok?: boolean;
    notebookId?: string;
    notebookUrl?: string;
    error?: string;
  };

  if (!response?.ok || !response.notebookId) {
    throw new Error(response?.error || 'Could not create notebook.');
  }

  return {
    notebookId: response.notebookId,
    notebookUrl: response.notebookUrl,
  };
}
