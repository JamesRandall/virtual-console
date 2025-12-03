import { useDevkitStore } from '../../../stores/devkitStore.ts';

export async function handleReadSourceCode(): Promise<unknown> {
  // First, try to get content directly from the store (most reliable)
  const store = useDevkitStore.getState();
  const activeFile = store.openFiles.find(f => f.path === store.activeFilePath);

  if (activeFile && activeFile.content) {
    console.log('read_source_code: Got content from store for', activeFile.path);
    return {
      code: activeFile.content,
      filePath: activeFile.path,
    };
  }

  // Fallback: try the event-based approach for cursor position info
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log('Received editor content response:', customEvent.detail);
      clearTimeout(timeout);
      resolve(customEvent.detail);
      window.removeEventListener('editor-content-response', handler);
    };

    window.addEventListener('editor-content-response', handler);

    const timeout = setTimeout(() => {
      window.removeEventListener('editor-content-response', handler);
      resolve({ code: '', error: 'No active file open' });
    }, 5000);

    const event = new CustomEvent('get-editor-content');
    window.dispatchEvent(event);
  });
}
