import { useDevkitStore } from '../../../stores/devkitStore.ts';

export async function handleRunDebugger(): Promise<unknown> {
  const cpuSnapshot = useDevkitStore.getState().cpuSnapshot;
  console.log('🏃 Running debugger, PC before run:', cpuSnapshot.programCounter.toString(16));

  const event = new CustomEvent('debugger-run');
  window.dispatchEvent(event);

  return { success: true, programCounter: cpuSnapshot.programCounter };
}
