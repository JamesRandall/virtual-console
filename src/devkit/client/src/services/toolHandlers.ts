import { useDevkitStore } from '../stores/devkitStore.js';

// Get editor content and state
export async function handleToolRequest(tool: string, parameters: Record<string, unknown>): Promise<unknown> {
  switch (tool) {
    case 'read_source_code':
      return await handleReadSourceCode();

    case 'update_source_code':
      return await handleUpdateSourceCode(parameters);

    case 'read_cpu_state':
      return await handleReadCpuState();

    case 'read_memory':
      return await handleReadMemory(parameters);

    case 'set_breakpoint':
      return await handleSetBreakpoint(parameters);

    case 'step_debugger':
      return await handleStepDebugger();

    case 'run_debugger':
      return await handleRunDebugger();

    case 'pause_debugger':
      return await handlePauseDebugger();

    case 'reset_console':
      return await handleResetConsole();

    case 'assemble_code':
      return await handleAssembleCode();

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

async function handleReadSourceCode(): Promise<unknown> {
  // Get current editor content from the global editor instance
  // We'll need to expose this through a custom event or global state
  const event = new CustomEvent('get-editor-content');
  window.dispatchEvent(event);

  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      resolve(customEvent.detail);
      window.removeEventListener('editor-content-response', handler);
    };

    window.addEventListener('editor-content-response', handler);

    // Timeout after 5 seconds
    setTimeout(() => {
      window.removeEventListener('editor-content-response', handler);
      resolve({ code: '', error: 'Timeout reading editor content' });
    }, 5000);
  });
}

async function handleUpdateSourceCode(parameters: Record<string, unknown>): Promise<unknown> {
  const { code, cursorLine, cursorColumn } = parameters as {
    code: string;
    cursorLine?: number;
    cursorColumn?: number;
  };

  const event = new CustomEvent('set-editor-content', {
    detail: { code, cursorLine, cursorColumn }
  });
  window.dispatchEvent(event);

  return { success: true };
}

async function handleReadCpuState(): Promise<unknown> {
  const snapshot = useDevkitStore.getState().cpuSnapshot;

  return {
    registers: Array.from(snapshot.registers),
    stackPointer: snapshot.stackPointer,
    programCounter: snapshot.programCounter,
    statusRegister: snapshot.statusRegister,
    cycleCount: snapshot.cycleCount,
  };
}

async function handleReadMemory(parameters: Record<string, unknown>): Promise<unknown> {
  const { address, length } = parameters as { address: number; length: number };

  if (address < 0 || address > 0xFFFF) {
    throw new Error('Address out of range (0x0000-0xFFFF)');
  }

  if (length < 1 || length > 1024) {
    throw new Error('Length out of range (1-1024)');
  }

  const memorySnapshot = useDevkitStore.getState().memorySnapshot;
  const data: number[] = [];

  for (let i = 0; i < length && address + i < memorySnapshot.length; i++) {
    data.push(memorySnapshot[address + i]);
  }

  return {
    address,
    length: data.length,
    data,
  };
}

async function handleSetBreakpoint(parameters: Record<string, unknown>): Promise<unknown> {
  const { line, enabled } = parameters as { line: number; enabled: boolean };

  const store = useDevkitStore.getState();
  const hasBreakpoint = store.breakpointLines.has(line);

  if (enabled && !hasBreakpoint) {
    store.toggleBreakpoint(line);
    return { success: true, message: `Breakpoint set at line ${line}` };
  } else if (!enabled && hasBreakpoint) {
    store.toggleBreakpoint(line);
    return { success: true, message: `Breakpoint cleared at line ${line}` };
  }

  return { success: true, message: 'No change needed' };
}

async function handleStepDebugger(): Promise<unknown> {
  const event = new CustomEvent('debugger-step');
  window.dispatchEvent(event);

  return { success: true };
}

async function handleRunDebugger(): Promise<unknown> {
  const event = new CustomEvent('debugger-run');
  window.dispatchEvent(event);

  return { success: true };
}

async function handlePauseDebugger(): Promise<unknown> {
  const event = new CustomEvent('debugger-pause');
  window.dispatchEvent(event);

  return { success: true };
}

async function handleResetConsole(): Promise<unknown> {
  const event = new CustomEvent('debugger-reset');
  window.dispatchEvent(event);

  return { success: true };
}

async function handleAssembleCode(): Promise<unknown> {
  const event = new CustomEvent('editor-assemble');
  window.dispatchEvent(event);

  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      resolve(customEvent.detail);
      window.removeEventListener('editor-assemble-response', handler);
    };

    window.addEventListener('editor-assemble-response', handler);

    // Timeout after 10 seconds
    setTimeout(() => {
      window.removeEventListener('editor-assemble-response', handler);
      resolve({ success: false, error: 'Timeout assembling code' });
    }, 10000);
  });
}
