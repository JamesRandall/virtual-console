/**
 * Assembler for the Virtual Console CPU
 *
 * A two-pass assembler that translates assembly language source code
 * into machine code for the 8-bit virtual console CPU.
 */

// Import CPU constants
import {
  OP_NOP, OP_LD, OP_ST, OP_MOV, OP_ADD, OP_SUB, OP_AND, OP_OR, OP_XOR,
  OP_SHL, OP_SHR, OP_CMP, OP_JMP, OP_BR, OP_CALL, OP_EXT,
  EXT_RET, EXT_RTI, EXT_PUSH, EXT_POP, EXT_INC, EXT_DEC,
  EXT_ROL, EXT_ROR, EXT_SEI, EXT_CLI,
  MODE_IMMEDIATE, MODE_REGISTER, MODE_ABSOLUTE, MODE_ZERO_PAGE,
  MODE_ZERO_PAGE_INDEXED, MODE_REGISTER_PAIR,
  BR_Z, BR_NZ, BR_C, BR_NC, BR_N, BR_NN, BR_V, BR_NV
} from './cpu';

// Types and Interfaces

export interface AssemblerError {
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface MemorySegment {
  startAddress: number;
  data: Uint8Array;
}

export interface SourceMapEntry {
  address: number;
  line: number;
}

export type SymbolTable = Record<string, number>;

export interface AssembledArtifacts {
  segments: MemorySegment[];
  symbolTable: SymbolTable;
  sourceMap: SourceMapEntry[];
  errors: AssemblerError[];
}


// Parsed instruction/directive
interface ParsedLine {
  line: number;
  label?: string;
  type: 'instruction' | 'directive' | 'empty';
  opcode?: string;
  operands?: string[];
  directive?: string;
  directiveArgs?: string[];
}

// Opcode information
interface OpcodeInfo {
  opcode: number;
  modes: Set<number>;
  extended?: number;
}

// Opcode mapping
const OPCODES: Record<string, OpcodeInfo> = {
  'NOP': { opcode: OP_NOP, modes: new Set([MODE_REGISTER]) },
  'LD': { opcode: OP_LD, modes: new Set([MODE_IMMEDIATE, MODE_REGISTER, MODE_ABSOLUTE, MODE_ZERO_PAGE, MODE_ZERO_PAGE_INDEXED, MODE_REGISTER_PAIR]) },
  'ST': { opcode: OP_ST, modes: new Set([MODE_ABSOLUTE, MODE_ZERO_PAGE, MODE_ZERO_PAGE_INDEXED, MODE_REGISTER_PAIR]) },
  'MOV': { opcode: OP_MOV, modes: new Set([MODE_REGISTER]) },
  'ADD': { opcode: OP_ADD, modes: new Set([MODE_IMMEDIATE, MODE_REGISTER]) },
  'SUB': { opcode: OP_SUB, modes: new Set([MODE_IMMEDIATE, MODE_REGISTER]) },
  'AND': { opcode: OP_AND, modes: new Set([MODE_IMMEDIATE, MODE_REGISTER]) },
  'OR': { opcode: OP_OR, modes: new Set([MODE_IMMEDIATE, MODE_REGISTER]) },
  'XOR': { opcode: OP_XOR, modes: new Set([MODE_IMMEDIATE, MODE_REGISTER]) },
  'SHL': { opcode: OP_SHL, modes: new Set([MODE_IMMEDIATE, MODE_REGISTER]) },
  'SHR': { opcode: OP_SHR, modes: new Set([MODE_IMMEDIATE, MODE_REGISTER]) },
  'CMP': { opcode: OP_CMP, modes: new Set([MODE_IMMEDIATE, MODE_REGISTER]) },
  'JMP': { opcode: OP_JMP, modes: new Set([MODE_ABSOLUTE, MODE_ZERO_PAGE, MODE_REGISTER_PAIR]) },
  'BRZ': { opcode: OP_BR, modes: new Set([MODE_IMMEDIATE]) },
  'BRNZ': { opcode: OP_BR, modes: new Set([MODE_IMMEDIATE]) },
  'BRC': { opcode: OP_BR, modes: new Set([MODE_IMMEDIATE]) },
  'BRNC': { opcode: OP_BR, modes: new Set([MODE_IMMEDIATE]) },
  'BRN': { opcode: OP_BR, modes: new Set([MODE_IMMEDIATE]) },
  'BRNN': { opcode: OP_BR, modes: new Set([MODE_IMMEDIATE]) },
  'BRV': { opcode: OP_BR, modes: new Set([MODE_IMMEDIATE]) },
  'BRNV': { opcode: OP_BR, modes: new Set([MODE_IMMEDIATE]) },
  'CALL': { opcode: OP_CALL, modes: new Set([MODE_ABSOLUTE, MODE_REGISTER_PAIR]) },
  'RET': { opcode: OP_EXT, modes: new Set([MODE_REGISTER]), extended: EXT_RET },
  'RTI': { opcode: OP_EXT, modes: new Set([MODE_REGISTER]), extended: EXT_RTI },
  'PUSH': { opcode: OP_EXT, modes: new Set([MODE_REGISTER]), extended: EXT_PUSH },
  'POP': { opcode: OP_EXT, modes: new Set([MODE_REGISTER]), extended: EXT_POP },
  'INC': { opcode: OP_EXT, modes: new Set([MODE_REGISTER]), extended: EXT_INC },
  'DEC': { opcode: OP_EXT, modes: new Set([MODE_REGISTER]), extended: EXT_DEC },
  'ROL': { opcode: OP_EXT, modes: new Set([MODE_REGISTER]), extended: EXT_ROL },
  'ROR': { opcode: OP_EXT, modes: new Set([MODE_REGISTER]), extended: EXT_ROR },
  'SEI': { opcode: OP_EXT, modes: new Set([MODE_REGISTER]), extended: EXT_SEI },
  'CLI': { opcode: OP_EXT, modes: new Set([MODE_REGISTER]), extended: EXT_CLI },
};

// Expected operand counts for each opcode
const OPERAND_COUNTS: Record<string, { min: number; max: number }> = {
  'NOP': { min: 0, max: 0 },
  'LD': { min: 2, max: 2 },
  'ST': { min: 2, max: 2 },
  'MOV': { min: 2, max: 2 },
  'ADD': { min: 2, max: 2 },
  'SUB': { min: 2, max: 2 },
  'AND': { min: 2, max: 2 },
  'OR': { min: 2, max: 2 },
  'XOR': { min: 2, max: 2 },
  'SHL': { min: 1, max: 2 },
  'SHR': { min: 1, max: 2 },
  'CMP': { min: 2, max: 2 },
  'JMP': { min: 1, max: 1 },
  'BRZ': { min: 1, max: 1 },
  'BRNZ': { min: 1, max: 1 },
  'BRC': { min: 1, max: 1 },
  'BRNC': { min: 1, max: 1 },
  'BRN': { min: 1, max: 1 },
  'BRNN': { min: 1, max: 1 },
  'BRV': { min: 1, max: 1 },
  'BRNV': { min: 1, max: 1 },
  'CALL': { min: 1, max: 1 },
  'RET': { min: 0, max: 0 },
  'RTI': { min: 0, max: 0 },
  'PUSH': { min: 1, max: 1 },
  'POP': { min: 1, max: 1 },
  'INC': { min: 1, max: 1 },
  'DEC': { min: 1, max: 1 },
  'ROL': { min: 1, max: 1 },
  'ROR': { min: 1, max: 1 },
  'SEI': { min: 0, max: 0 },
  'CLI': { min: 0, max: 0 },
};

// Branch condition mapping
const BRANCH_CONDITIONS: Record<string, number> = {
  'BRZ': BR_Z,
  'BRNZ': BR_NZ,
  'BRC': BR_C,
  'BRNC': BR_NC,
  'BRN': BR_N,
  'BRNN': BR_NN,
  'BRV': BR_V,
  'BRNV': BR_NV,
};

// Helper Functions

/**
 * Parse a number from a string
 */
function parseNumber(str: string): number | null {
  str = str.trim();

  // Hexadecimal: $XX or 0xXX
  if (str.startsWith('$')) {
    const value = parseInt(str.substring(1), 16);
    return isNaN(value) ? null : value;
  }
  if (str.startsWith('0x') || str.startsWith('0X')) {
    const value = parseInt(str.substring(2), 16);
    return isNaN(value) ? null : value;
  }

  // Binary: %XXXXXXXX or 0bXXXXXXXX
  if (str.startsWith('%')) {
    const value = parseInt(str.substring(1), 2);
    return isNaN(value) ? null : value;
  }
  if (str.startsWith('0b') || str.startsWith('0B')) {
    const value = parseInt(str.substring(2), 2);
    return isNaN(value) ? null : value;
  }

  // Character literal: 'X'
  if (str.startsWith("'") && str.endsWith("'") && str.length >= 3) {
    return parseCharLiteral(str.substring(1, str.length - 1));
  }

  // Decimal
  const value = parseInt(str, 10);
  return isNaN(value) ? null : value;
}

/**
 * Parse a character literal with escape sequences
 */
function parseCharLiteral(str: string): number {
  if (str.length === 1) {
    return str.charCodeAt(0);
  }

  // Handle escape sequences
  if (str.startsWith('\\')) {
    switch (str[1]) {
      case 'n': return 0x0A;
      case 'r': return 0x0D;
      case 't': return 0x09;
      case '\\': return 0x5C;
      case '"': return 0x22;
      case "'": return 0x27;
      case '0': return 0x00;
      default: return str.charCodeAt(1);
    }
  }

  return str.charCodeAt(0);
}

/**
 * Parse a string literal with escape sequences
 */
function parseStringLiteral(str: string): number[] {
  const bytes: number[] = [];
  let i = 0;

  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      switch (str[i + 1]) {
        case 'n': bytes.push(0x0A); break;
        case 'r': bytes.push(0x0D); break;
        case 't': bytes.push(0x09); break;
        case '\\': bytes.push(0x5C); break;
        case '"': bytes.push(0x22); break;
        case "'": bytes.push(0x27); break;
        case '0': bytes.push(0x00); break;
        default: bytes.push(str.charCodeAt(i + 1));
      }
      i += 2;
    } else {
      bytes.push(str.charCodeAt(i));
      i++;
    }
  }

  return bytes;
}

/**
 * Remove comments from a line
 */
function removeComment(line: string): string {
  const commentIndex = line.indexOf(';');
  if (commentIndex >= 0) {
    return line.substring(0, commentIndex);
  }
  return line;
}

/**
 * Parse register name to register number
 */
function parseRegister(reg: string): number | null {
  const upper = reg.toUpperCase();
  if (upper.startsWith('R') && upper.length === 2) {
    const num = parseInt(upper[1], 10);
    if (num >= 0 && num <= 5) {
      return num;
    }
  }
  return null;
}

/**
 * Evaluate an expression
 */
function evaluateExpression(expr: string, symbols: SymbolTable, currentAddress: number): number {
  // First, replace standalone $ (current address) but not $ followed by hex digit
  expr = expr.replace(/\$(?![0-9a-fA-F])/g, currentAddress.toString());

  // Convert all number literals to decimal to avoid identifier conflicts
  // Hex with $ prefix: $XX
  expr = expr.replace(/\$([0-9a-fA-F]+)/g, (_, hex) => {
    return parseInt(hex, 16).toString();
  });

  // Hex with 0x prefix: 0xXX
  expr = expr.replace(/0x([0-9a-fA-F]+)/gi, (_, hex) => {
    return parseInt(hex, 16).toString();
  });

  // Binary with % prefix: %XXXXXXXX
  expr = expr.replace(/%([01]+)/g, (_, bin) => {
    return parseInt(bin, 2).toString();
  });

  // Binary with 0b prefix: 0bXXXXXXXX
  expr = expr.replace(/0b([01]+)/gi, (_, bin) => {
    return parseInt(bin, 2).toString();
  });

  // Character literals: 'X'
  expr = expr.replace(/'((?:\\.|[^'])*)'/g, (_, char) => {
    return parseCharLiteral(char).toString();
  });

  // Now replace identifiers with their values
  expr = expr.replace(/[a-zA-Z_][a-zA-Z0-9_.]*/g, (match) => {
    if (match in symbols) {
      return symbols[match].toString();
    }
    throw new Error(`Undefined symbol: ${match}`);
  });

  // Handle unary < (low byte) and > (high byte) operators
  // These extract bytes from 16-bit addresses
  // Match < or > at start, after operators, or after opening parenthesis
  // We need to be careful not to match << or >> or comparison operators

  // Strategy: Replace unary < and > with expressions that extract the byte
  // Unary < or > appears at: start of string, after '(' or after operators
  // We look for < or > followed by a number or parenthesis, but not by < > = (which would be <<, >>, <=, >=)

  // First pass: mark unary operators with placeholders to avoid confusion with binary operators
  expr = expr.replace(/(^|[+\-*\/%&|^(,])\s*<\s*(?![<=])/g, '$1§LOW§');
  expr = expr.replace(/(^|[+\-*\/%&|^(,])\s*>\s*(?![>=])/g, '$1§HIGH§');

  // Now process the placeholders
  // §LOW§ or §HIGH§ followed by either:
  // - A number: \d+
  // - A parenthesized expression: \([^)]+\)
  expr = expr.replace(/§LOW§(\d+)/g, '(($1)&255)');
  expr = expr.replace(/§LOW§(\([^)]+\))/g, '(($1)&255)');
  expr = expr.replace(/§HIGH§(\d+)/g, '((($1)>>8)&255)');
  expr = expr.replace(/§HIGH§(\([^)]+\))/g, '((($1)>>8)&255)');

  try {
    // Evaluate the expression using a safe eval-like approach
    return evaluateMathExpression(expr);
  } catch (error) {
    throw new Error(`Expression evaluation failed: ${expr}`);
  }
}

/**
 * Evaluate a mathematical expression (supports +, -, *, /, %, &, |, ^, <<, >>)
 */
function evaluateMathExpression(expr: string): number {
  expr = expr.trim();

  // Handle parentheses recursively
  while (expr.includes('(')) {
    expr = expr.replace(/\(([^()]+)\)/g, (_, inner) => {
      return evaluateMathExpression(inner).toString();
    });
  }

  // Handle unary operators
  expr = expr.replace(/~(\d+)/g, (_, num) => (~parseInt(num, 10) & 0xFFFF).toString());
  expr = expr.replace(/!(\d+)/g, (_, num) => (parseInt(num, 10) === 0 ? '1' : '0'));

  // Logical OR (||)
  if (expr.includes('||')) {
    const parts = expr.split('||');
    return parts.reduce((acc, part) => {
      const val = evaluateMathExpression(part.trim());
      return (acc !== 0 || val !== 0) ? 1 : 0;
    }, 0);
  }

  // Logical AND (&&)
  if (expr.includes('&&')) {
    const parts = expr.split('&&');
    return parts.reduce((acc, part) => {
      const val = evaluateMathExpression(part.trim());
      return (acc !== 0 && val !== 0) ? 1 : 0;
    }, 1);
  }

  // Bitwise OR (|)
  if (expr.includes('|') && !expr.includes('||')) {
    const parts = expr.split('|');
    return parts.reduce((acc, part) => (acc | evaluateMathExpression(part.trim())) & 0xFFFF, 0);
  }

  // Bitwise XOR (^)
  if (expr.includes('^')) {
    const parts = expr.split('^');
    return parts.reduce((acc, part) => (acc ^ evaluateMathExpression(part.trim())) & 0xFFFF, 0);
  }

  // Bitwise AND (&)
  if (expr.includes('&') && !expr.includes('&&')) {
    const parts = expr.split('&');
    return parts.reduce((acc, part) => (acc & evaluateMathExpression(part.trim())) & 0xFFFF, 0xFFFF);
  }

  // Comparison operators (check multi-char operators first, then shift, then single-char)
  if (expr.includes('==')) {
    const [left, right] = expr.split('==');
    return evaluateMathExpression(left.trim()) === evaluateMathExpression(right.trim()) ? 1 : 0;
  }
  if (expr.includes('!=')) {
    const [left, right] = expr.split('!=');
    return evaluateMathExpression(left.trim()) !== evaluateMathExpression(right.trim()) ? 1 : 0;
  }
  if (expr.includes('<=')) {
    const [left, right] = expr.split('<=');
    return evaluateMathExpression(left.trim()) <= evaluateMathExpression(right.trim()) ? 1 : 0;
  }
  if (expr.includes('>=')) {
    const [left, right] = expr.split('>=');
    return evaluateMathExpression(left.trim()) >= evaluateMathExpression(right.trim()) ? 1 : 0;
  }

  // Shift operators (must check before < and > to avoid matching >> and << incorrectly)
  if (expr.includes('<<')) {
    const [left, right] = expr.split('<<');
    return (evaluateMathExpression(left.trim()) << evaluateMathExpression(right.trim())) & 0xFFFF;
  }
  if (expr.includes('>>')) {
    const [left, right] = expr.split('>>');
    return (evaluateMathExpression(left.trim()) >> evaluateMathExpression(right.trim())) & 0xFFFF;
  }

  // Single-char comparison operators (checked after shift to avoid confusion with << and >>)
  if (expr.includes('<')) {
    const [left, right] = expr.split('<');
    return evaluateMathExpression(left.trim()) < evaluateMathExpression(right.trim()) ? 1 : 0;
  }
  if (expr.includes('>')) {
    const [left, right] = expr.split('>');
    return evaluateMathExpression(left.trim()) > evaluateMathExpression(right.trim()) ? 1 : 0;
  }

  // Addition and subtraction
  const addMatch = expr.match(/^(.+?)([+\-])(.+)$/);
  if (addMatch) {
    const [, left, op, right] = addMatch;
    const leftVal = evaluateMathExpression(left.trim());
    const rightVal = evaluateMathExpression(right.trim());
    return op === '+'
      ? (leftVal + rightVal) & 0xFFFF
      : (leftVal - rightVal) & 0xFFFF;
  }

  // Multiplication, division, modulo
  const mulMatch = expr.match(/^(.+?)([*\/%])(.+)$/);
  if (mulMatch) {
    const [, left, op, right] = mulMatch;
    const leftVal = evaluateMathExpression(left.trim());
    const rightVal = evaluateMathExpression(right.trim());
    if (op === '*') return (leftVal * rightVal) & 0xFFFF;
    if (op === '/') {
      if (rightVal === 0) throw new Error('Division by zero');
      return Math.floor(leftVal / rightVal) & 0xFFFF;
    }
    if (op === '%') {
      if (rightVal === 0) throw new Error('Division by zero');
      return (leftVal % rightVal) & 0xFFFF;
    }
  }

  // Parse as number
  const num = parseNumber(expr);
  if (num === null) {
    throw new Error(`Invalid number: ${expr}`);
  }
  return num & 0xFFFF;
}

/**
 * Parse a line of assembly code
 */
function parseLine(line: string, lineNumber: number): ParsedLine {
  // Remove comments and trim
  line = removeComment(line).trim();

  // Empty line
  if (line.length === 0) {
    return { line: lineNumber, type: 'empty' };
  }

  let label: string | undefined;

  // Check for label (but not colons inside brackets like [R2:R3])
  let colonIndex = -1;
  let bracketDepth = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '[') bracketDepth++;
    else if (line[i] === ']') bracketDepth--;
    else if (line[i] === ':' && bracketDepth === 0) {
      colonIndex = i;
      break;
    }
  }

  if (colonIndex > 0) {
    label = line.substring(0, colonIndex).trim();
    line = line.substring(colonIndex + 1).trim();
  }

  // Check for directive
  if (line.startsWith('.')) {
    const parts = line.split(/\s+/);
    const directive = parts[0].substring(1).toUpperCase();
    const args = line.substring(parts[0].length).trim();

    return {
      line: lineNumber,
      label,
      type: 'directive',
      directive,
      directiveArgs: args.length > 0 ? [args] : [],
    };
  }

  // Parse instruction
  if (line.length > 0) {
    const parts = line.split(/\s+/);
    const opcode = parts[0].toUpperCase();
    const operandsStr = line.substring(parts[0].length).trim();
    const operands = operandsStr.length > 0
      ? operandsStr.split(',').map(op => op.trim())
      : [];

    return {
      line: lineNumber,
      label,
      type: 'instruction',
      opcode,
      operands,
    };
  }

  // Label only
  if (label) {
    return {
      line: lineNumber,
      label,
      type: 'empty',
    };
  }

  return { line: lineNumber, type: 'empty' };
}

/**
 * Determine addressing mode from operand
 */
function determineAddressingMode(operand: string): { mode: number; reg?: number; indexReg?: number; value?: string } {
  operand = operand.trim();

  // Immediate: #value
  if (operand.startsWith('#')) {
    return { mode: MODE_IMMEDIATE, value: operand.substring(1) };
  }

  // Register pair indirect: [R0:R1]
  if (operand.startsWith('[') && operand.endsWith(']') && operand.includes(':')) {
    const inner = operand.substring(1, operand.length - 1);
    const [reg1Str, reg2Str] = inner.split(':').map(s => s.trim());
    const reg1 = parseRegister(reg1Str);
    const reg2 = parseRegister(reg2Str);

    if (reg1 !== null && reg2 !== null) {
      return { mode: MODE_REGISTER_PAIR, reg: reg1 };
    }
  }

  // Zero page indexed: [$80+R0]
  if (operand.startsWith('[') && operand.endsWith(']') && operand.includes('+')) {
    const inner = operand.substring(1, operand.length - 1);
    const [addrStr, regStr] = inner.split('+').map(s => s.trim());
    const reg = parseRegister(regStr);

    if (reg !== null) {
      return { mode: MODE_ZERO_PAGE_INDEXED, value: addrStr, indexReg: reg };
    }
  }

  // Absolute or zero page: [$1234] or [label]
  if (operand.startsWith('[') && operand.endsWith(']')) {
    const inner = operand.substring(1, operand.length - 1).trim();

    // Try to parse as number to determine if it's zero page or absolute
    const num = parseNumber(inner);
    if (num !== null) {
      if (num >= 0 && num <= 0xFF) {
        return { mode: MODE_ZERO_PAGE, value: inner };
      } else {
        return { mode: MODE_ABSOLUTE, value: inner };
      }
    }

    // It's a label - assume absolute for now, will be resolved later
    return { mode: MODE_ABSOLUTE, value: inner };
  }

  // Register: R0
  const reg = parseRegister(operand);
  if (reg !== null) {
    return { mode: MODE_REGISTER, reg };
  }

  // Bare labels/numbers default to absolute addressing (for JMP, CALL, etc.)
  // Branch instructions will handle this separately
  return { mode: MODE_ABSOLUTE, value: operand };
}

/**
 * Calculate instruction size
 */
function calculateInstructionSize(opcode: string, operands: string[]): number {
  const opcodeInfo = OPCODES[opcode];
  if (!opcodeInfo) {
    return 0;
  }

  // Extended instructions
  if (opcodeInfo.extended !== undefined) {
    if (opcode === 'RET' || opcode === 'RTI' || opcode === 'SEI' || opcode === 'CLI') {
      return 2; // Opcode + sub-opcode
    }
    return 3; // Opcode + sub-opcode + register byte
  }

  // NOP
  if (opcode === 'NOP') {
    return 2;
  }

  // Branch instructions
  if (opcode.startsWith('BR')) {
    return 3; // Opcode byte + register byte + offset byte
  }

  // Determine mode from first operand
  if (operands.length === 0) {
    return 2; // Default
  }

  const firstOperand = operands[operands.length - 1]; // Last operand is usually the source
  const { mode } = determineAddressingMode(firstOperand);

  switch (mode) {
    case MODE_IMMEDIATE:
      return 3; // Opcode + register + immediate
    case MODE_REGISTER:
      return 2; // Opcode + register
    case MODE_ABSOLUTE:
      return 4; // Opcode + register + addr_low + addr_high
    case MODE_ZERO_PAGE:
      return 3; // Opcode + register + zp_addr
    case MODE_ZERO_PAGE_INDEXED:
      return 3; // Opcode + register + zp_addr
    case MODE_REGISTER_PAIR:
      return 2; // Opcode + register
    default:
      return 2;
  }
}

/**
 * Encode an instruction to machine code
 */
function encodeInstruction(
  parsed: ParsedLine,
  symbols: SymbolTable,
  currentAddress: number,
  errors: AssemblerError[]
): Uint8Array {
  if (parsed.type !== 'instruction' || !parsed.opcode) {
    return new Uint8Array(0);
  }

  const opcode = parsed.opcode;
  const operands = parsed.operands || [];
  const opcodeInfo = OPCODES[opcode];

  if (!opcodeInfo) {
    errors.push({
      line: parsed.line,
      message: `Unknown opcode: ${opcode}`,
      severity: 'error',
    });
    return new Uint8Array(0);
  }

  // Validate operand count
  const expectedCounts = OPERAND_COUNTS[opcode];
  if (expectedCounts) {
    const operandCount = operands.length;
    if (operandCount < expectedCounts.min || operandCount > expectedCounts.max) {
      const expectedMsg = expectedCounts.min === expectedCounts.max
        ? `${expectedCounts.min}`
        : `${expectedCounts.min}-${expectedCounts.max}`;
      errors.push({
        line: parsed.line,
        message: `Invalid operand count for ${opcode}: expected ${expectedMsg}, got ${operandCount}`,
        severity: 'error',
      });
      return new Uint8Array(0);
    }
  }

  try {
    // Handle NOP specially
    if (opcode === 'NOP') {
      const byte1 = (OP_NOP << 4) | (MODE_REGISTER << 1);
      return new Uint8Array([byte1, 0x00]);
    }

    // Handle RET and RTI (no operands)
    if (opcode === 'RET') {
      const byte1 = (OP_EXT << 4) | (MODE_REGISTER << 1);
      return new Uint8Array([byte1, EXT_RET]);
    }

    if (opcode === 'RTI') {
      const byte1 = (OP_EXT << 4) | (MODE_REGISTER << 1);
      return new Uint8Array([byte1, EXT_RTI]);
    }

    if (opcode === 'SEI') {
      const byte1 = (OP_EXT << 4) | (MODE_REGISTER << 1);
      return new Uint8Array([byte1, EXT_SEI]);
    }

    if (opcode === 'CLI') {
      const byte1 = (OP_EXT << 4) | (MODE_REGISTER << 1);
      return new Uint8Array([byte1, EXT_CLI]);
    }

    // Handle branch instructions
    if (opcode.startsWith('BR')) {
      const condition = BRANCH_CONDITIONS[opcode];
      const targetExpr = operands[0];
      const targetAddr = evaluateExpression(targetExpr, symbols, currentAddress);
      const offset = targetAddr - (currentAddress + 3); // +3 because instruction is 3 bytes

      if (offset < -128 || offset > 127) {
        errors.push({
          line: parsed.line,
          message: `Branch target out of range (offset: ${offset}, max: ±127)`,
          severity: 'error',
          suggestion: `Use JMP instead of ${opcode}`,
        });
        return new Uint8Array(3);
      }

      const byte1 = (OP_BR << 4) | (MODE_IMMEDIATE << 1);
      const byte2 = (condition << 5);
      const byte3 = offset & 0xFF;

      return new Uint8Array([byte1, byte2, byte3]);
    }

    // Handle extended instructions with register operand
    if (opcodeInfo.extended !== undefined) {
      const destReg = parseRegister(operands[0]);
      if (destReg === null) {
        errors.push({
          line: parsed.line,
          message: `Invalid register: ${operands[0]}`,
          severity: 'error',
        });
        return new Uint8Array(3);
      }

      const byte1 = (OP_EXT << 4) | (MODE_REGISTER << 1);
      const byte2 = opcodeInfo.extended;
      const byte3 = (destReg << 5);

      return new Uint8Array([byte1, byte2, byte3]);
    }

    // Handle regular instructions
    const destOperand = operands[0];
    const srcOperand = operands.length > 1 ? operands[1] : undefined;

    // Parse destination register
    let destReg = 0;
    if (opcode !== 'JMP' && opcode !== 'CALL') {
      const reg = parseRegister(destOperand);
      if (reg === null) {
        errors.push({
          line: parsed.line,
          message: `Invalid destination register: ${destOperand}`,
          severity: 'error',
        });
        return new Uint8Array(0);
      }
      destReg = reg;
    }

    // Determine addressing mode from source operand (or dest for JMP/CALL)
    const modeOperand = (opcode === 'JMP' || opcode === 'CALL') ? destOperand : (srcOperand || destOperand);
    const { mode, reg: srcReg, indexReg, value } = determineAddressingMode(modeOperand);

    // Validate register pair
    if (mode === MODE_REGISTER_PAIR && srcReg !== undefined) {
      const expectedPair = srcReg + 1;
      const secondReg = parseRegister(modeOperand.substring(1, modeOperand.length - 1).split(':')[1].trim());

      if (secondReg !== expectedPair) {
        errors.push({
          line: parsed.line,
          message: `Invalid register pair: ${modeOperand}. Expected R${srcReg}:R${expectedPair}`,
          severity: 'error',
        });
        return new Uint8Array(0);
      }
    }

    // Build instruction bytes
    const byte1 = (opcodeInfo.opcode << 4) | (mode << 1);
    const srcRegValue = srcReg !== undefined ? srcReg : (indexReg !== undefined ? indexReg : 0);
    const byte2 = (destReg << 5) | (srcRegValue << 2);

    const bytes: number[] = [byte1, byte2];

    // Add additional bytes based on mode
    if (mode === MODE_IMMEDIATE && value !== undefined) {
      const imm = evaluateExpression(value, symbols, currentAddress);
      bytes.push(imm & 0xFF);
    } else if (mode === MODE_ABSOLUTE && value !== undefined) {
      const addr = evaluateExpression(value, symbols, currentAddress);
      bytes.push(addr & 0xFF); // Low byte
      bytes.push((addr >> 8) & 0xFF); // High byte
    } else if (mode === MODE_ZERO_PAGE && value !== undefined) {
      const addr = evaluateExpression(value, symbols, currentAddress);
      if (addr > 0xFF) {
        errors.push({
          line: parsed.line,
          message: `Zero page address out of range: $${addr.toString(16)}`,
          severity: 'error',
        });
      }
      bytes.push(addr & 0xFF);
    } else if (mode === MODE_ZERO_PAGE_INDEXED && value !== undefined) {
      const addr = evaluateExpression(value, symbols, currentAddress);
      if (addr > 0xFF) {
        errors.push({
          line: parsed.line,
          message: `Zero page address out of range: $${addr.toString(16)}`,
          severity: 'error',
        });
      }
      bytes.push(addr & 0xFF);
    }

    return new Uint8Array(bytes);
  } catch (error) {
    errors.push({
      line: parsed.line,
      message: error instanceof Error ? error.message : String(error),
      severity: 'error',
    });
    return new Uint8Array(0);
  }
}

/**
 * Pass 1: Collect symbols and calculate addresses
 */
function pass1(lines: ParsedLine[], errors: AssemblerError[]): SymbolTable {
  const symbols: SymbolTable = {};
  let currentAddress = 0;
  let currentLabel = '';

  for (const line of lines) {
    // Handle labels
    if (line.label) {
      // Check for local labels
      if (line.label.startsWith('.')) {
        if (!currentLabel) {
          errors.push({
            line: line.line,
            message: `Local label ${line.label} has no parent label`,
            severity: 'error',
          });
        } else {
          const fullLabel = `${currentLabel}${line.label}`;
          if (fullLabel in symbols) {
            errors.push({
              line: line.line,
              message: `Duplicate label: ${fullLabel}`,
              severity: 'error',
            });
          } else {
            symbols[fullLabel] = currentAddress;
          }
        }
      } else {
        // Non-local label
        currentLabel = line.label;
        if (line.label in symbols) {
          errors.push({
            line: line.line,
            message: `Duplicate label: ${line.label}`,
            severity: 'error',
          });
        } else {
          symbols[line.label] = currentAddress;
        }
      }
    }

    // Handle directives
    if (line.type === 'directive' && line.directive) {
      const directive = line.directive;
      const args = line.directiveArgs || [];

      if (directive === 'ORG') {
        if (args.length > 0) {
          try {
            currentAddress = evaluateExpression(args[0], symbols, currentAddress);
          } catch (error) {
            errors.push({
              line: line.line,
              message: `Invalid .org address: ${args[0]}`,
              severity: 'error',
            });
          }
        }
      } else if (directive === 'DEFINE' || directive === 'EQU') {
        const parts = args[0].split(/\s+/);
        if (parts.length >= 2) {
          const name = parts[0];
          const valueExpr = parts.slice(1).join(' ');
          try {
            symbols[name] = evaluateExpression(valueExpr, symbols, currentAddress);
          } catch (error) {
            errors.push({
              line: line.line,
              message: `Cannot evaluate constant: ${valueExpr}`,
              severity: 'error',
            });
          }
        }
      } else if (directive === 'BYTE' || directive === 'DB') {
        const values = args[0].split(',');
        currentAddress += values.length;
      } else if (directive === 'WORD' || directive === 'DW') {
        const values = args[0].split(',');
        currentAddress += values.length * 2;
      } else if (directive === 'STRING' || directive === 'ASCIIZ') {
        if (args.length > 0) {
          const strMatch = args[0].match(/^"(.*)"$/);
          if (strMatch) {
            const bytes = parseStringLiteral(strMatch[1]);
            currentAddress += bytes.length + 1; // +1 for null terminator
          }
        }
      } else if (directive === 'RES' || directive === 'DSB') {
        if (args.length > 0) {
          try {
            const count = evaluateExpression(args[0], symbols, currentAddress);
            currentAddress += count;
          } catch (error) {
            errors.push({
              line: line.line,
              message: `Cannot evaluate .res count: ${args[0]}`,
              severity: 'error',
            });
          }
        }
      } else if (directive === 'ALIGN') {
        if (args.length > 0) {
          try {
            const boundary = evaluateExpression(args[0], symbols, currentAddress);
            const remainder = currentAddress % boundary;
            if (remainder !== 0) {
              currentAddress += boundary - remainder;
            }
          } catch (error) {
            errors.push({
              line: line.line,
              message: `Cannot evaluate .align boundary: ${args[0]}`,
              severity: 'error',
            });
          }
        }
      }
    }

    // Handle instructions
    if (line.type === 'instruction' && line.opcode) {
      const size = calculateInstructionSize(line.opcode, line.operands || []);
      currentAddress += size;
    }
  }

  return symbols;
}

/**
 * Pass 2: Generate machine code
 */
function pass2(
  lines: ParsedLine[],
  symbols: SymbolTable,
  errors: AssemblerError[]
): { segments: MemorySegment[]; sourceMap: SourceMapEntry[] } {
  const segments: MemorySegment[] = [];
  const sourceMap: SourceMapEntry[] = [];

  let currentAddress = 0;
  let segmentStart = 0;
  let segmentBytes: number[] = [];
  let currentParentLabel = ''; // Track current parent label for local label expansion

  const finishSegment = () => {
    if (segmentBytes.length > 0) {
      segments.push({
        startAddress: segmentStart,
        data: new Uint8Array(segmentBytes),
      });
      segmentBytes = [];
    }
  };

  // Helper function to expand local labels
  const expandLocalLabel = (label: string): string => {
    if (label.startsWith('.') && currentParentLabel) {
      return currentParentLabel + label;
    }
    return label;
  };

  for (const line of lines) {
    // Track parent labels
    if (line.label) {
      if (!line.label.startsWith('.')) {
        currentParentLabel = line.label;
      }
    }

    // Handle directives
    if (line.type === 'directive' && line.directive) {
      const directive = line.directive;
      const args = line.directiveArgs || [];

      if (directive === 'ORG') {
        if (args.length > 0) {
          finishSegment();
          try {
            currentAddress = evaluateExpression(args[0], symbols, currentAddress);
            segmentStart = currentAddress;
          } catch (error) {
            // Error already reported in pass 1
          }
        }
      } else if (directive === 'BYTE' || directive === 'DB') {
        const values = args[0].split(',').map(v => v.trim());
        for (const val of values) {
          try {
            const byte = evaluateExpression(val, symbols, currentAddress);
            segmentBytes.push(byte & 0xFF);
            currentAddress++;
          } catch (error) {
            errors.push({
              line: line.line,
              message: `Cannot evaluate byte value: ${val}`,
              severity: 'error',
            });
            segmentBytes.push(0);
            currentAddress++;
          }
        }
      } else if (directive === 'WORD' || directive === 'DW') {
        const values = args[0].split(',').map(v => v.trim());
        for (const val of values) {
          try {
            const word = evaluateExpression(val, symbols, currentAddress);
            segmentBytes.push(word & 0xFF); // Low byte
            segmentBytes.push((word >> 8) & 0xFF); // High byte
            currentAddress += 2;
          } catch (error) {
            errors.push({
              line: line.line,
              message: `Cannot evaluate word value: ${val}`,
              severity: 'error',
            });
            segmentBytes.push(0, 0);
            currentAddress += 2;
          }
        }
      } else if (directive === 'STRING' || directive === 'ASCIIZ') {
        if (args.length > 0) {
          const strMatch = args[0].match(/^"(.*)"$/);
          if (strMatch) {
            const bytes = parseStringLiteral(strMatch[1]);
            segmentBytes.push(...bytes, 0); // Add null terminator
            currentAddress += bytes.length + 1;
          }
        }
      } else if (directive === 'RES' || directive === 'DSB') {
        if (args.length > 0) {
          try {
            const count = evaluateExpression(args[0], symbols, currentAddress);
            for (let i = 0; i < count; i++) {
              segmentBytes.push(0);
            }
            currentAddress += count;
          } catch (error) {
            // Error already reported in pass 1
          }
        }
      } else if (directive === 'ALIGN') {
        if (args.length > 0) {
          try {
            const boundary = evaluateExpression(args[0], symbols, currentAddress);
            const remainder = currentAddress % boundary;
            if (remainder !== 0) {
              const padding = boundary - remainder;
              for (let i = 0; i < padding; i++) {
                segmentBytes.push(0);
              }
              currentAddress += padding;
            }
          } catch (error) {
            // Error already reported in pass 1
          }
        }
      }
    }

    // Handle instructions
    if (line.type === 'instruction' && line.opcode) {
      sourceMap.push({ address: currentAddress, line: line.line });

      // Expand local labels in operands
      const expandedLine: ParsedLine = {
        ...line,
        operands: line.operands?.map(op => {
          // Check if operand is or contains a local label reference
          if (op.startsWith('.')) {
            return expandLocalLabel(op);
          }
          return op;
        })
      };

      const bytes = encodeInstruction(expandedLine, symbols, currentAddress, errors);
      segmentBytes.push(...bytes);
      currentAddress += bytes.length;
    }
  }

  finishSegment();

  return { segments, sourceMap };
}

/**
 * Main assembler function
 */
export function assemble(assemblyCode: string): AssembledArtifacts {
  const errors: AssemblerError[] = [];
  const lines: ParsedLine[] = [];

  // Parse all lines
  const sourceLines = assemblyCode.split('\n');
  for (let i = 0; i < sourceLines.length; i++) {
    const parsed = parseLine(sourceLines[i], i + 1);
    lines.push(parsed);
  }

  // Pass 1: Collect symbols
  const symbols = pass1(lines, errors);

  // Pass 2: Generate code
  const { segments, sourceMap } = pass2(lines, symbols, errors);

  return {
    segments,
    symbolTable: symbols,
    sourceMap,
    errors,
  };
}
