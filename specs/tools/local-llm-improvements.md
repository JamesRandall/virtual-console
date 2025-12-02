# Local LLM Improvements: llama.cpp with GBNF Grammar for Assembly Generation

## Problem Statement

When using a local model (Qwen via Ollama) for assembly code generation in the chat assistant, the model produces unreliable output—mixing 6502 and 68000 opcodes instead of generating valid vc-asm assembly for our custom CPU.

Ollama's `format` parameter only supports JSON schema constraints, not grammar-based constraints. This limits our ability to enforce syntactically correct assembly output.

## Solution

Switch from Ollama to **llama.cpp**, which natively supports **GBNF grammar-constrained generation**. llama.cpp runs efficiently on macOS with Metal acceleration on Apple Silicon, making it ideal for local development. This allows us to define a formal grammar for vc-asm that guarantees syntactically valid assembly output.

## Architecture

```
Chat Input → Agent Service
                ↓
        ┌───────┴───────┐
        │               │
   Normal Chat    Code Generation Tool
        │               │
   llama.cpp (no grammar)   llama.cpp + GBNF grammar
        │               │
   Free-form text      Valid vc-asm only
```

The key insight is that grammar constraints should only apply during code generation, not during normal conversation. This is achieved by:

1. Normal chat flows through llama.cpp without grammar constraints
2. When the model needs to generate assembly, it calls the `generate_assembly_code` tool
3. The tool makes a separate llama.cpp call with the GBNF grammar constraint
4. Only syntactically valid vc-asm can be produced

## Implementation Steps

### Step 1: Create GBNF Grammar for vc-asm

**New file**: `api/src/ai/grammars/vc-asm.gbnf`

Define the complete grammar based on the existing Monaco language specification in `client/src/application/editors/assembly/assemblerLanguageSpecification.ts`.

#### Grammar Elements

**Opcodes** (24):
```
NOP | LD | ST | MOV | ADD | SUB | AND | OR | XOR | SHL | SHR | CMP |
JMP | CALL | RET | RTI | PUSH | POP | INC | DEC | ROL | ROR | SEI | CLI
```

**Branch Instructions** (8):
```
BRZ | BRNZ | BRC | BRNC | BRN | BRNN | BRV | BRNV
```

**Registers**:
```
R0 | R1 | R2 | R3 | R4 | R5 | SP | PC
```

**Addressing Modes**:
- Immediate: `#value` (e.g., `#$FF`, `#42`, `#%10101010`)
- Register direct: `Rx`
- Absolute: `[$addr]`
- Zero page indirect: `[$zp]`
- Zero page indexed: `[$zp+Rx]`
- Register pair indirect: `[Rx:Ry]`
- Relative (branches): `label`

**Directives**:
```
.org | .byte | .db | .word | .dw | .string | .asciiz |
.define | .equ | .res | .dsb | .align | .include
```

**Number Formats**:
- Hexadecimal: `$FF` or `0xFF`
- Binary: `%10101010` or `0b10101010`
- Decimal: `42`

**Other Elements**:
- Labels: `identifier:`
- Comments: `; comment text`
- Strings: `"text with \"escapes\""`
- Character literals: `'A'`

#### Reference Materials

The grammar is derived from:
- **Monaco Language Spec**: `client/src/application/editors/assembly/assemblerLanguageSpecification.ts`
- **AI Cheatsheet**: `specs/ai-cheatsheet.json` (comprehensive CPU and assembler documentation)
- **Working Examples**: `src/examples/assembly/*.asm` (18 complete working programs)

#### Syntax Patterns from Working Examples

Based on analysis of the example files, the following patterns are used:

**Instruction Formats**:
```asm
; No operands
NOP
RET
RTI
SEI
CLI

; Single register
PUSH R0
POP R1
INC R2
DEC R3
ROL R4
ROR R5

; Register to register
MOV R0, R1
ADD R0, R1
SUB R0, R1
CMP R0, R1

; Immediate to register
LD R0, #42
LD R0, #$FF
LD R0, #%10101010
ADD R0, #1
AND R0, #$80
SHL R2, #4

; Memory operations
LD R0, [VIDEO_MODE]           ; Symbolic absolute
LD R0, [$0114]                ; Hex absolute
ST R0, [PALETTE_RAM + 1]      ; Expression in address
LD R5, [R3:R4]                ; Register pair indirect
ST R0, [R2:R3]                ; Register pair indirect

; Branches (relative to label)
BRZ .loop
BRNZ .continue
BRC .carry
JMP done
CALL draw_pixel
```

**Directive Formats**:
```asm
.org $0B80
.org $8000

.define VIDEO_MODE $0101
.define CTRL_UP $80
.define SQUARE_SIZE 8

; Expression in immediate using > and < operators
LD R0, #(vblank_handler >> 8)
LD R0, #(vblank_handler & $FF)
LD R0, #>sprite_data
LD R1, #<sprite_data
```

**Label Formats**:
```asm
main:                    ; Global label
.loop:                   ; Local label (scoped to previous global)
.check_down:             ; Local label
vblank_handler:          ; Global label
```

#### GBNF Grammar

```gbnf
# Root: a program is zero or more lines
root ::= line*

# A line can be empty, have just a comment, or have content
line ::= ws* line-content? comment? eol

line-content ::= label-def ws* statement?
               | statement

# Label definition (identifier followed by colon)
label-def ::= identifier ":"

# Statement is either an instruction or a directive
statement ::= instruction | directive

# Instructions
instruction ::= opcode-noarg
              | opcode-single ws+ operand
              | opcode-double ws+ operand ws* "," ws* operand
              | branch-op ws+ branch-target

# Opcodes grouped by operand count
opcode-noarg ::= "NOP"i | "RET"i | "RTI"i | "SEI"i | "CLI"i

opcode-single ::= "PUSH"i | "POP"i | "INC"i | "DEC"i | "ROL"i | "ROR"i
                | "JMP"i | "CALL"i

opcode-double ::= "LD"i | "ST"i | "MOV"i | "ADD"i | "SUB"i | "AND"i
                | "OR"i | "XOR"i | "SHL"i | "SHR"i | "CMP"i

branch-op ::= "BRZ"i | "BRNZ"i | "BRC"i | "BRNC"i | "BRN"i | "BRNN"i
            | "BRV"i | "BRNV"i

branch-target ::= identifier | local-label

# Operands
operand ::= immediate | register | memory-ref | identifier

# Immediate values: #value or #expression
immediate ::= "#" immediate-value

immediate-value ::= paren-expr | unary-expr | number | identifier

paren-expr ::= "(" ws* expression ws* ")"

unary-expr ::= (">" | "<") (identifier | paren-expr)

expression ::= expr-term (ws* expr-op ws* expr-term)*

expr-term ::= number | identifier | paren-expr

expr-op ::= "+" | "-" | "*" | "/" | "&" | "|" | "^" | ">>" | "<<"

# Registers
register ::= "R"i [0-5] | "SP"i | "PC"i

# Memory references: [address] or [Rx:Ry]
memory-ref ::= "[" ws* memory-inner ws* "]"

memory-inner ::= reg-pair | address-expr

reg-pair ::= register ":" register

address-expr ::= addr-base (ws* "+" ws* (register | number))?

addr-base ::= number | identifier

# Numbers in various formats
number ::= hex-dollar | hex-0x | binary-percent | binary-0b | decimal

hex-dollar ::= "$" [0-9a-fA-F]+
hex-0x ::= "0" [xX] [0-9a-fA-F]+
binary-percent ::= "%" [01]+
binary-0b ::= "0" [bB] [01]+
decimal ::= [0-9]+

# Directives
directive ::= dir-org | dir-define | dir-data | dir-string | dir-res | dir-align

dir-org ::= ".org"i ws+ number

dir-define ::= (".define"i | ".equ"i) ws+ identifier ws+ expression

dir-data ::= (".byte"i | ".db"i | ".word"i | ".dw"i) ws+ data-list

data-list ::= data-item (ws* "," ws* data-item)*

data-item ::= number | identifier | char-literal | expression

dir-string ::= (".string"i | ".asciiz"i) ws+ string-literal

dir-res ::= (".res"i | ".dsb"i) ws+ number

dir-align ::= ".align"i ws+ number

# Identifiers and labels
identifier ::= [a-zA-Z_] [a-zA-Z0-9_]*
local-label ::= "." [a-zA-Z_] [a-zA-Z0-9_]*

# Literals
char-literal ::= "'" char-content "'"
char-content ::= [^'\\] | escape-seq

string-literal ::= "\"" string-content* "\""
string-content ::= [^"\\] | escape-seq

escape-seq ::= "\\" [nrt\\"'0]

# Comments start with semicolon
comment ::= ws* ";" [^\r\n]*

# Whitespace and line endings
ws ::= [ \t]+
eol ::= "\r"? "\n" | "\r"
```

#### Grammar Validation

The grammar should be validated against all files in `src/examples/assembly/`:
- `drawPixel.asm` - Basic pixel plotting with subroutines
- `controllerMovingSquare.asm` - VBlank interrupts and controller input
- `drawLines.asm` - Bresenham algorithm with signed arithmetic
- `vblank-minimal.asm` - Simplest interrupt handler
- `pong.asm` - Complete game (~29KB, comprehensive test)
- `gameOfLife.asm` - Complex algorithms
- And 12 more examples...

---

### Step 2: Create llama.cpp Provider

**New file**: `api/src/ai/providers/llamacpp.ts`

Implement the `AIProvider` interface for llama.cpp:

```typescript
import type { AIProvider, StreamChatParams, StreamEvent } from './interface.js';

export class LlamaCppProvider implements AIProvider {
  private baseUrl: string;
  private grammarPath: string;

  constructor(baseUrl: string, grammarPath: string) {
    this.baseUrl = baseUrl;
    this.grammarPath = grammarPath;
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<StreamEvent> {
    // Use llama.cpp server's /v1/chat/completions endpoint (OpenAI-compatible)
    // Stream responses without grammar constraints
    // Map events to common StreamEvent format
  }

  async generateWithGrammar(prompt: string, context?: string): Promise<string> {
    // Load GBNF grammar from file
    // Call llama.cpp with grammar parameter
    // Return grammar-constrained assembly code
  }
}
```

#### llama.cpp API Usage

llama.cpp server exposes an OpenAI-compatible API. For grammar-constrained generation, use the `/completion` endpoint:

```typescript
const response = await fetch(`${this.baseUrl}/completion`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: prompt,
    n_predict: 2048,
    grammar: grammarString,  // GBNF grammar string
    temperature: 0.7,
    stop: ["\n\n\n"]  // Stop on multiple newlines
  })
});
```

For chat completions without grammar (normal conversation):

```typescript
const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: messages,
    max_tokens: 2048,
    stream: true
  })
});
```

---

### Step 3: Update Provider Interface

**Modify**: `api/src/ai/providers/interface.ts`

Add optional method for grammar-constrained generation:

```typescript
export interface AIProvider {
  streamChat(params: StreamChatParams): AsyncIterable<StreamEvent>;

  // Optional: grammar-constrained generation for code
  generateWithGrammar?(prompt: string, grammar: string): Promise<string>;
}
```

---

### Step 4: Update Provider Factory

**Modify**: `api/src/ai/providers/factory.ts`

```typescript
import { LlamaCppProvider } from './llamacpp.js';

export type ProviderType = 'anthropic' | 'bedrock' | 'llamacpp';

export interface ProviderConfig {
  type: ProviderType;
  // ... existing config ...
  // llama.cpp config
  llamacppHost?: string;
  llamacppGrammarPath?: string;
}

export function createAIProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    // ... existing cases ...

    case 'llamacpp':
      if (!config.llamacppHost) {
        throw new Error('llama.cpp host is required');
      }
      return new LlamaCppProvider(
        config.llamacppHost,
        config.llamacppGrammarPath || './grammars/vc-asm.gbnf'
      );
  }
}
```

---

### Step 5: Update Configuration

**Modify**: `api/src/config.ts`

```typescript
export const config = {
  // ... existing config ...

  // llama.cpp configuration
  llamacppHost: process.env.LLAMACPP_HOST || 'http://localhost:8080',
  llamacppGrammarPath: process.env.LLAMACPP_GRAMMAR_PATH || './src/ai/grammars/vc-asm.gbnf',
};
```

---

### Step 6: Add Code Generation Tool

**Modify**: `api/src/tools/index.ts`

Add a new server-side tool for grammar-constrained code generation:

```typescript
{
  name: "generate_assembly_code",
  description: "Generate vc-asm assembly code for the virtual console. Use this tool whenever you need to write new assembly code or make significant modifications to existing code. The output will be syntactically valid vc-asm.",
  input_schema: {
    type: "object",
    properties: {
      task: {
        type: "string",
        description: "Description of what the assembly code should accomplish"
      },
      context: {
        type: "string",
        description: "Existing code, memory layout constraints, or other relevant context"
      },
      existing_code: {
        type: "string",
        description: "Current code to modify or extend (if applicable)"
      }
    },
    required: ["task"]
  }
}
```

Add to server-side tool handlers:

```typescript
const serverSideTools = ['get_example', 'generate_assembly_code'];

export function isServerSideTool(name: string): boolean {
  return serverSideTools.includes(name);
}

export async function executeServerSideTool(
  name: string,
  input: Record<string, unknown>,
  provider?: AIProvider
): Promise<unknown> {
  switch (name) {
    case 'get_example':
      return handleGetExample(input);

    case 'generate_assembly_code':
      return handleGenerateAssemblyCode(input, provider);

    default:
      throw new Error(`Unknown server-side tool: ${name}`);
  }
}

async function handleGenerateAssemblyCode(
  input: Record<string, unknown>,
  provider?: AIProvider
): Promise<{ code: string }> {
  if (!provider?.generateWithGrammar) {
    throw new Error('Provider does not support grammar-constrained generation');
  }

  const task = input.task as string;
  const context = input.context as string | undefined;
  const existingCode = input.existing_code as string | undefined;

  // Build prompt for code generation
  const prompt = buildCodeGenerationPrompt(task, context, existingCode);

  // Load grammar
  const grammar = await fs.readFile(config.vllmGrammarPath, 'utf-8');

  // Generate with grammar constraint
  const code = await provider.generateWithGrammar(prompt, grammar);

  return { code };
}
```

---

### Step 7: Update Agent Service

**Modify**: `api/src/ai/agentService.ts`

Pass the provider to server-side tool execution when needed:

```typescript
if (isServerSideTool(tool.name)) {
  // Pass provider for tools that need it (like generate_assembly_code)
  result = await executeServerSideTool(tool.name, tool.input, provider);
} else {
  result = await executeToolRequest(socket, tool.id, tool.name, tool.input);
}
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `api/src/ai/grammars/vc-asm.gbnf` | **New** | GBNF grammar for vc-asm assembly |
| `api/src/ai/providers/llamacpp.ts` | **New** | llama.cpp provider with grammar support |
| `api/src/ai/providers/interface.ts` | Modify | Add `generateWithGrammar()` method |
| `api/src/ai/providers/factory.ts` | Modify | Add llama.cpp provider type |
| `api/src/config.ts` | Modify | Add llama.cpp configuration options |
| `api/src/tools/index.ts` | Modify | Add `generate_assembly_code` tool |
| `api/src/ai/agentService.ts` | Modify | Pass provider to server-side tools |

---

## llama.cpp Setup Requirements

### Installation on macOS

Install via Homebrew:

```bash
brew install llama.cpp
```

Or build from source for latest features:

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make LLAMA_METAL=1  # Enable Metal acceleration for Apple Silicon
```

### Download a Model

Download a GGUF model file. Recommended models for code generation:

```bash
# Qwen 2.5 Coder (7B, quantized)
# Download from Hugging Face: https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF

# Or use huggingface-cli
pip install huggingface-hub
huggingface-cli download Qwen/Qwen2.5-Coder-7B-Instruct-GGUF \
  qwen2.5-coder-7b-instruct-q4_k_m.gguf \
  --local-dir ./models
```

Alternative models:
- `CodeLlama-7B-Instruct` - Good for code generation
- `Qwen2.5-Coder-14B-Instruct` - Better quality, requires more RAM
- `DeepSeek-Coder-6.7B-Instruct` - Excellent for code tasks

### Running llama.cpp Server

Start the server with the model:

```bash
llama-server \
  --model ./models/qwen2.5-coder-7b-instruct-q4_k_m.gguf \
  --port 8080 \
  --ctx-size 8192 \
  --n-gpu-layers 99  # Use Metal for all layers on Apple Silicon
```

For chat-style interactions with better defaults:

```bash
llama-server \
  --model ./models/qwen2.5-coder-7b-instruct-q4_k_m.gguf \
  --port 8080 \
  --ctx-size 8192 \
  --n-gpu-layers 99 \
  --chat-template chatml
```

### Environment Variables

```bash
LLAMACPP_HOST=http://localhost:8080
LLAMACPP_GRAMMAR_PATH=./src/ai/grammars/vc-asm.gbnf
AI_PROVIDER=llamacpp
```

### Verifying the Server

Test the server is running:

```bash
curl http://localhost:8080/health
```

Test a simple completion:

```bash
curl http://localhost:8080/completion \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Write a hello world program:", "n_predict": 100}'
```

---

## Testing Strategy

1. **Grammar Testing**: Test the GBNF grammar against all example assembly files in `/src/examples/assembly/` to ensure they parse correctly. llama.cpp includes a grammar testing tool:
   ```bash
   # Test grammar parsing
   llama-grammar-parser ./src/ai/grammars/vc-asm.gbnf
   ```

2. **Unit Tests**: Test the llama.cpp provider in isolation with mock responses

3. **Integration Tests**:
   - Test chat flow without code generation (should work normally)
   - Test code generation tool invocation
   - Verify generated code assembles without syntax errors

4. **Manual Testing**: Use the chat interface to request assembly code and verify output quality

5. **Grammar Constraint Testing**: Test that the grammar correctly constrains output:
   ```bash
   curl http://localhost:8080/completion \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "Write assembly to load value 42 into R0:",
       "n_predict": 50,
       "grammar": "'"$(cat ./src/ai/grammars/vc-asm.gbnf)"'"
     }'
   ```

---

## Fallback Strategy

If llama.cpp grammar-constrained generation fails or is unavailable:

1. Fall back to unconstrained generation with strong system prompt
2. Post-validate generated code using the assembler
3. If validation fails, return error to model with specific syntax issues
4. Allow model to retry with corrected code

---

## Future Improvements

1. **Semantic Validation**: After grammar validation, run the assembler to catch semantic errors (undefined labels, invalid addressing modes for specific opcodes, etc.)

2. **Incremental Generation**: For large code blocks, generate section by section

3. **Code Completion**: Use grammar-constrained generation for autocomplete in the editor

4. **Model Fine-tuning**: Fine-tune Qwen on vc-asm examples for better code quality (grammar ensures syntax, but fine-tuning improves semantics)

---

## Reference: AI Cheatsheet

The system prompt for code generation should include key information from `specs/ai-cheatsheet.json`. Critical sections include:

### CPU Quick Reference
- **Registers**: R0-R5 (8-bit GP), SP (16-bit stack), PC (16-bit program counter)
- **Register Pairs**: R0:R1, R2:R3, R4:R5 (high:low for 16-bit addressing)
- **Flags**: C (Carry), Z (Zero), I (Interrupt), V (Overflow), N (Negative)

### Addressing Modes
| Mode | Syntax | Example |
|------|--------|---------|
| Immediate | `#value` | `LD R0, #42` |
| Register | `Rx` | `ADD R0, R1` |
| Absolute | `[$addr]` | `LD R0, [$1234]` |
| Zero Page | `[$zp]` | `LD R0, [$80]` |
| ZP Indexed | `[$zp+Rx]` | `LD R0, [$80+R1]` |
| Reg Pair Indirect | `[Rx:Ry]` | `LD R0, [R2:R3]` |
| Relative | `label` | `BRZ loop` |

### Key Memory Addresses
- `$0100` - Bank register
- `$0101` - Video mode
- `$0114` - INT_STATUS (W1C)
- `$0115` - INT_ENABLE
- `$0132-$0133` - VBlank vector (hi/lo)
- `$0136` - Controller 1 buttons
- `$0200-$05FF` - Palette RAM
- `$0700-$0AFF` - Sprite attribute table
- `$B000-$FFFF` - Framebuffer (Mode 0)

### Common Patterns to Include in Prompts

**16-bit pointer setup**:
```asm
LD R2, #>address    ; High byte
LD R3, #<address    ; Low byte
LD R0, [R2:R3]      ; Use pointer
```

**VBlank interrupt setup**:
```asm
LD R0, #(handler >> 8)
ST R0, [$0132]
LD R0, #(handler & $FF)
ST R0, [$0133]
LD R0, #$01
ST R0, [$0115]      ; Enable VBlank
SEI                 ; Enable interrupts
```

**Signed comparison warning**:
CMP is unsigned. For signed comparisons, check sign bit first or reformulate as addition/subtraction.

---

## Appendix: Example Assembly Files

| File | Lines | Description |
|------|-------|-------------|
| `pong.asm` | ~900 | Complete game with AI opponent |
| `gameOfLife.asm` | ~400 | Conway's Game of Life |
| `drawLines.asm` | ~450 | Bresenham line algorithm |
| `controllerMovingSquare.asm` | ~400 | Controller input + VBlank |
| `animatedStarfieldWithVblank.asm` | ~350 | Animation with interrupts |
| `drawDigits.asm` | ~300 | Number display with lookup tables |
| `drawPixel.asm` | ~170 | Basic 4bpp pixel plotting |
| `vblank-minimal.asm` | ~50 | Simplest interrupt example |

These examples should be used for:
1. Grammar validation (must parse all files)
2. Few-shot prompting (include relevant examples in code generation prompts)
3. Training data (if fine-tuning the model)
