export async function handleResetConsole(): Promise<unknown> {
  console.log('🔄 Resetting console - PC will be set to 0');
  const event = new CustomEvent('debugger-reset');
  window.dispatchEvent(event);

  return { success: true, message: 'Console reset - PC set to 0, all registers cleared' };
}
