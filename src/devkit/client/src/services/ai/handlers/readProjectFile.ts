import { useDevkitStore } from '../../../stores/devkitStore.ts';
import { readFile } from '../../fileSystemService.ts';

export async function handleReadProjectFile(parameters: Record<string, unknown>): Promise<unknown> {
  const projectHandle = useDevkitStore.getState().currentProjectHandle;

  if (!projectHandle) {
    return { error: 'No project is currently open' };
  }

  const path = parameters.path as string;

  if (!path) {
    return { error: 'File path is required' };
  }

  try {
    const content = await readFile(projectHandle, path);

    return {
      path,
      content,
      lines: content.split('\n').length
    };
  } catch (error) {
    return {
      error: `Failed to read file '${path}': ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
