export async function handleStepDebugger(): Promise<unknown> {
  const event = new CustomEvent('debugger-step');
  window.dispatchEvent(event);

  return { success: true };
}
