export async function handlePauseDebugger(): Promise<unknown> {
  const event = new CustomEvent('debugger-pause');
  window.dispatchEvent(event);

  return { success: true };
}
