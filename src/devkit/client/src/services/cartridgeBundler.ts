/**
 * Cartridge Bundler Service
 *
 * Builds a cartridge ROM file from the project's assets and assembled code.
 * The cartridge is organized in 32KB banks:
 * - Bank 0: metadata.bin - Contains load addresses for code segments
 * - Bank 1: code.bin - The assembled program code
 * - Bank 2+: Asset banks (gbin, pbin, tbin files)
 */

import { assembleMultiFile, type AssembledArtifacts, type MemorySegment } from '../../../../console/src/assembler';
import { readFile, readBinaryFile, writeBinaryFile, readAllSourceFiles } from './fileSystemService';
import type { OpenFile } from '../stores/devkitStore';

// Constants
const BANK_SIZE = 32 * 1024; // 32KB per bank

/**
 * Metadata structure for bank 0
 * Contains information about how to load code segments into memory
 */
interface CodeSegmentMetadata {
  startAddress: number;  // 16-bit address where segment should be loaded
  length: number;        // Length of the segment in bytes
  offsetInBank: number;  // Offset within code.bin where data starts
}

/**
 * Cartridge configuration from cartridge.json
 */
interface CartridgeConfig {
  banks?: string[];
  [key: string]: unknown;
}

/**
 * Build result
 */
export interface BuildResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  romSize?: number;
  bankCount?: number;
}

/**
 * Create an empty 32KB bank
 */
function createEmptyBank(): Uint8Array {
  return new Uint8Array(BANK_SIZE);
}

/**
 * Build metadata.bin (Bank 0)
 *
 * Format:
 * - Bytes 0-1: Magic number (0x56, 0x43 = "VC")
 * - Byte 2: Version (0x01)
 * - Byte 3: Number of code segments
 * - For each segment:
 *   - Bytes 0-1: Start address (big-endian)
 *   - Bytes 2-3: Length (big-endian)
 *   - Bytes 4-5: Offset in code.bin (big-endian)
 */
function buildMetadataBank(segments: MemorySegment[]): Uint8Array {
  const bank = createEmptyBank();

  // Magic number "VC"
  bank[0] = 0x56; // 'V'
  bank[1] = 0x43; // 'C'

  // Version
  bank[2] = 0x01;

  // Number of segments
  bank[3] = Math.min(segments.length, 255);

  // Write segment metadata
  let offset = 4;
  let codeOffset = 0;

  for (let i = 0; i < Math.min(segments.length, 255); i++) {
    const segment = segments[i];

    // Start address (big-endian)
    bank[offset] = (segment.startAddress >> 8) & 0xFF;
    bank[offset + 1] = segment.startAddress & 0xFF;

    // Length (big-endian)
    bank[offset + 2] = (segment.data.length >> 8) & 0xFF;
    bank[offset + 3] = segment.data.length & 0xFF;

    // Offset in code.bin (big-endian)
    bank[offset + 4] = (codeOffset >> 8) & 0xFF;
    bank[offset + 5] = codeOffset & 0xFF;

    offset += 6;
    codeOffset += segment.data.length;
  }

  return bank;
}

/**
 * Build code.bin (Bank 1)
 *
 * Contains all assembled code segments packed sequentially.
 * The metadata bank contains information about where each segment
 * should be loaded in memory.
 */
function buildCodeBank(segments: MemorySegment[]): Uint8Array {
  const bank = createEmptyBank();

  let offset = 0;
  for (const segment of segments) {
    if (offset + segment.data.length > BANK_SIZE) {
      console.warn(`Code bank overflow! Segment at $${segment.startAddress.toString(16)} truncated.`);
      const remaining = BANK_SIZE - offset;
      bank.set(segment.data.slice(0, remaining), offset);
      break;
    }
    bank.set(segment.data, offset);
    offset += segment.data.length;
  }

  return bank;
}

/**
 * Load an asset file and pad it to bank size
 */
async function loadAssetBank(
  projectHandle: FileSystemDirectoryHandle,
  assetPath: string
): Promise<Uint8Array> {
  const bank = createEmptyBank();

  try {
    const data = await readBinaryFile(projectHandle, assetPath);
    const copyLength = Math.min(data.length, BANK_SIZE);
    bank.set(data.slice(0, copyLength), 0);
  } catch (error) {
    console.error(`Failed to load asset: ${assetPath}`, error);
  }

  return bank;
}

/**
 * Build the cartridge ROM
 *
 * @param projectHandle - The project directory handle
 * @param openFiles - Currently open files (may have unsaved changes)
 * @returns Build result with success status and any errors
 */
export async function buildCartridge(
  projectHandle: FileSystemDirectoryHandle,
  openFiles: OpenFile[]
): Promise<BuildResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Read cartridge.json to get bank configuration
    let cartridgeConfig: CartridgeConfig;
    try {
      const cartridgeJson = await readFile(projectHandle, 'cartridge.json');
      cartridgeConfig = JSON.parse(cartridgeJson);
    } catch {
      errors.push('Failed to read cartridge.json. Please configure your cartridge first.');
      return { success: false, errors, warnings };
    }

    // 2. Assemble the code
    const diskSourceFiles = await readAllSourceFiles(projectHandle);

    // Merge with open files (which may have unsaved changes)
    const sourceFiles = new Map(diskSourceFiles);
    for (const openFile of openFiles) {
      if (openFile.path.endsWith('.asm')) {
        sourceFiles.set(openFile.path, openFile.content);
      }
    }

    // Check that main.asm exists
    if (!sourceFiles.has('src/main.asm')) {
      errors.push('main.asm not found. Please ensure main.asm exists in the src folder.');
      return { success: false, errors, warnings };
    }

    // Assemble
    const assemblyResult: AssembledArtifacts = assembleMultiFile({
      sourceFiles,
      entryPoint: 'src/main.asm',
    });

    // Check for assembly errors
    if (assemblyResult.errors.length > 0) {
      for (const err of assemblyResult.errors) {
        const fileInfo = err.file ? `${err.file}:` : '';
        errors.push(`${fileInfo}${err.line}: ${err.message}`);
      }
      return { success: false, errors, warnings };
    }

    // 3. Build the ROM banks
    const banks: Uint8Array[] = [];

    // Bank 0: Metadata
    const metadataBank = buildMetadataBank(assemblyResult.segments);
    banks.push(metadataBank);

    // Bank 1: Code
    const codeBank = buildCodeBank(assemblyResult.segments);
    banks.push(codeBank);

    // Calculate total code size
    const totalCodeSize = assemblyResult.segments.reduce((sum, seg) => sum + seg.data.length, 0);
    if (totalCodeSize > BANK_SIZE) {
      warnings.push(`Code size (${totalCodeSize} bytes) exceeds single bank size (${BANK_SIZE} bytes). Code may be truncated.`);
    }

    // Banks 2+: Assets from cartridge.json
    const configBanks = cartridgeConfig.banks || [];

    // Skip first two entries if they are metadata.bin and code.bin
    let startIndex = 0;
    if (configBanks[0] === 'metadata.bin') startIndex++;
    if (configBanks[1] === 'code.bin') startIndex++;

    for (let i = startIndex; i < configBanks.length; i++) {
      const assetPath = configBanks[i];

      // Skip the fixed banks
      if (assetPath === 'metadata.bin' || assetPath === 'code.bin') {
        continue;
      }

      try {
        const assetBank = await loadAssetBank(projectHandle, assetPath);
        banks.push(assetBank);
      } catch {
        warnings.push(`Failed to load asset: ${assetPath}`);
        // Add empty bank as placeholder to maintain bank indices
        banks.push(createEmptyBank());
      }
    }

    // 4. Concatenate all banks into final ROM
    const romSize = banks.length * BANK_SIZE;
    const rom = new Uint8Array(romSize);

    for (let i = 0; i < banks.length; i++) {
      rom.set(banks[i], i * BANK_SIZE);
    }

    // 5. Write the ROM file
    await writeBinaryFile(projectHandle, 'cartridge.rom', rom);

    return {
      success: true,
      errors,
      warnings,
      romSize,
      bankCount: banks.length,
    };
  } catch (error) {
    errors.push(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, errors, warnings };
  }
}

/**
 * Parse a cartridge ROM and extract metadata
 *
 * @param rom - The ROM data
 * @returns Parsed metadata or null if invalid
 */
export function parseCartridgeMetadata(rom: Uint8Array): CodeSegmentMetadata[] | null {
  if (rom.length < BANK_SIZE) {
    return null;
  }

  // Check magic number
  if (rom[0] !== 0x56 || rom[1] !== 0x43) {
    return null;
  }

  // Check version
  const version = rom[2];
  if (version !== 0x01) {
    console.warn(`Unknown cartridge version: ${version}`);
  }

  // Read segments
  const segmentCount = rom[3];
  const segments: CodeSegmentMetadata[] = [];

  let offset = 4;
  for (let i = 0; i < segmentCount; i++) {
    const startAddress = (rom[offset] << 8) | rom[offset + 1];
    const length = (rom[offset + 2] << 8) | rom[offset + 3];
    const offsetInBank = (rom[offset + 4] << 8) | rom[offset + 5];

    segments.push({
      startAddress,
      length,
      offsetInBank,
    });

    offset += 6;
  }

  return segments;
}

/**
 * Load code from a cartridge ROM into memory
 *
 * @param rom - The ROM data
 * @param memory - Object with write8 method to write bytes to memory
 */
export function loadCartridgeCode(
  rom: Uint8Array,
  memory: { write8: (address: number, value: number) => void }
): { startAddress: number } | null {
  const segments = parseCartridgeMetadata(rom);
  if (!segments || segments.length === 0) {
    return null;
  }

  // Bank 1 starts at offset BANK_SIZE
  const codeBank = rom.slice(BANK_SIZE, BANK_SIZE * 2);

  const firstStartAddress = segments[0].startAddress;

  for (const segment of segments) {
    for (let i = 0; i < segment.length; i++) {
      const byte = codeBank[segment.offsetInBank + i];
      memory.write8(segment.startAddress + i, byte);
    }
  }

  return { startAddress: firstStartAddress };
}
