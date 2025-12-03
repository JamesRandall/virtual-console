export async function handleAssembleCode(): Promise<unknown> {
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      clearTimeout(timeout);
      resolve(customEvent.detail);
      window.removeEventListener('editor-assemble-response', handler);
    };

    // Add listener BEFORE dispatching the event
    window.addEventListener('editor-assemble-response', handler);

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      window.removeEventListener('editor-assemble-response', handler);
      resolve({ success: false, error: 'Timeout assembling code' });
    }, 10000);

    // Now dispatch the event
    const event = new CustomEvent('editor-assemble');
    window.dispatchEvent(event);
  });
}
