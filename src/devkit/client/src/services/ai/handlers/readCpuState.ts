import { useDevkitStore } from '../../../stores/devkitStore.ts';

export async function handleReadCpuState(): Promise<unknown> {
  const snapshot = useDevkitStore.getState().cpuSnapshot;

  return {
    registers: Array.from(snapshot.registers),
    stackPointer: snapshot.stackPointer,
    programCounter: snapshot.programCounter,
    statusRegister: snapshot.statusRegister,
    cycleCount: snapshot.cycleCount,
  };
}
