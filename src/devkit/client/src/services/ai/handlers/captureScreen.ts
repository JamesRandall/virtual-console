export async function handleCaptureScreen(): Promise<unknown> {
  console.log('📸 Requesting canvas capture...');

  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      const response = customEvent.detail as any;
      clearTimeout(timeout);

      if (response.success && response.image) {
        console.log('📸 Canvas captured:', response.width, 'x', response.height, 'image data length:', response.image.length);
      }

      resolve(customEvent.detail);
      window.removeEventListener('canvas-capture-response', handler);
    };

    // Add listener BEFORE dispatching the event
    window.addEventListener('canvas-capture-response', handler);

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      window.removeEventListener('canvas-capture-response', handler);
      resolve({ success: false, error: 'Timeout capturing canvas' });
    }, 5000);

    // Now dispatch the event
    const event = new CustomEvent('capture-canvas');
    window.dispatchEvent(event);
  });
}
