import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AIProvider } from '../../ai/providers/interface.js';
import { loadHardwareCheatsheet } from '../../ai/systemPrompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Handle generate_assembly_code tool - uses grammar-constrained generation
 */
export async function handleGenerateAssemblyCode(
  parameters: Record<string, unknown>,
  provider?: AIProvider
): Promise<{ code: string } | { error: string }> {
  // Check if provider supports grammar-constrained generation
  if (!provider?.generateWithGrammar) {
    return {
      error: 'Grammar-constrained generation is not available. This feature requires the llama.cpp provider.'
    };
  }

  const task = parameters.task as string;
  const context = parameters.context as string | undefined;
  const existingCode = parameters.existing_code as string | undefined;

  if (!task) {
    return { error: 'Task description is required' };
  }

  // Load the GBNF grammar
  let grammar: string;
  try {
    const grammarPath = join(__dirname, '..', '..', 'ai', 'grammars', 'vc-asm.gbnf');
    grammar = readFileSync(grammarPath, 'utf-8');
  } catch (error) {
    return {
      error: `Failed to load grammar file: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  // Build the code generation prompt
  const prompt = buildCodeGenerationPrompt(task, context, existingCode);

  try {
    const code = await provider.generateWithGrammar(prompt, grammar);
    return { code };
  } catch (error) {
    return {
      error: `Code generation failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Build a prompt for grammar-constrained code generation.
 * This includes the FULL hardware specification for accurate code generation.
 */
function buildCodeGenerationPrompt(
  task: string,
  context?: string,
  existingCode?: string
): string {
  // Load the full hardware cheatsheet
  const hardwareSpec = loadHardwareCheatsheet();

  let prompt = `You are a vc-asm assembly code generator for a custom 8-bit virtual console.

## Complete Hardware Specification

${hardwareSpec}

## Task
${task}
`;

  if (context) {
    prompt += `\n## Context\n${context}\n`;
  }

  if (existingCode) {
    prompt += `\n## Existing Code to Modify/Extend\n\`\`\`asm\n${existingCode}\n\`\`\`\n`;
  }

  prompt += `\n## Output
Generate only valid vc-asm assembly code. Include comments to explain the code.

`;

  return prompt;
}
