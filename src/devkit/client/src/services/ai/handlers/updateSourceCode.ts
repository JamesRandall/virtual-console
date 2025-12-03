export async function handleUpdateSourceCode(parameters: Record<string, unknown>): Promise<unknown> {
  const { code, cursorLine, cursorColumn } = parameters as {
    code: string;
    cursorLine?: number;
    cursorColumn?: number;
  };

  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      clearTimeout(timeout);
      resolve(customEvent.detail);
      window.removeEventListener('editor-content-updated', handler);
    };

    // Add listener BEFORE dispatching the event
    window.addEventListener('editor-content-updated', handler);

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      window.removeEventListener('editor-content-updated', handler);
      resolve({ success: false, error: 'Timeout updating editor content' });
    }, 5000);

    // Now dispatch the event
    const event = new CustomEvent('set-editor-content', {
      detail: { code, cursorLine, cursorColumn }
    });
    window.dispatchEvent(event);
  });
}
