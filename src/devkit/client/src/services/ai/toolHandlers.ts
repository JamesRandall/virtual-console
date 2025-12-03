import {
  handleReadSourceCode,
  handleUpdateSourceCode,
  handleReadCpuState,
  handleReadMemory,
  handleSetBreakpoint,
  handleStepDebugger,
  handleRunDebugger,
  handlePauseDebugger,
  handleResetConsole,
  handleAssembleCode,
  handleCaptureScreen,
  handleListProjectFiles,
  handleReadProjectFile,
} from './handlers/index.ts';

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

    case 'capture_screen':
      return await handleCaptureScreen();

    case 'list_project_files':
      return await handleListProjectFiles(parameters);

    case 'read_project_file':
      return await handleReadProjectFile(parameters);

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
