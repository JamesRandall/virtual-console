import { useDevkitStore } from '../../../stores/devkitStore.ts';

export async function handleSetBreakpoint(parameters: Record<string, unknown>): Promise<unknown> {
  const { line, enabled, file } = parameters as { line: number; enabled: boolean; file?: string };

  const store = useDevkitStore.getState();
  // Default to main.asm if no file specified
  const filePath = file || 'src/main.asm';
  const fileBreakpoints = store.breakpointsByFile.get(filePath) || new Set<number>();
  const hasBreakpoint = fileBreakpoints.has(line);

  if (enabled && !hasBreakpoint) {
    store.toggleBreakpoint(filePath, line);
    return { success: true, message: `Breakpoint set at ${filePath}:${line}` };
  } else if (!enabled && hasBreakpoint) {
    store.toggleBreakpoint(filePath, line);
    return { success: true, message: `Breakpoint cleared at ${filePath}:${line}` };
  }

  return { success: true, message: 'No change needed' };
}
