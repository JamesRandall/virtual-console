import {useState, useCallback, useRef, useEffect} from 'react';
import {FilePond, registerPlugin} from 'react-filepond';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import type {FilePondFile} from 'filepond';

import 'filepond/dist/filepond.min.css';
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css';

import {Dialog} from './Dialog';
import {SYSTEM_PALETTE} from '../../../../console/src/systemPalette';

// Register Filepond plugins
registerPlugin(FilePondPluginImagePreview);

interface ImageGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (assemblyCode: string) => void;
}

// Target resolution for mode 0
const TARGET_WIDTH = 256;
const TARGET_HEIGHT = 160;

// Calculate color distance (Euclidean distance in RGB space)
function colorDistance(c1: readonly [number, number, number], c2: readonly [number, number, number]): number {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Find the closest color from the master palette
function findClosestPaletteIndex(rgb: [number, number, number], palette: number[]): number {
    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < palette.length; i++) {
        const paletteRgb = SYSTEM_PALETTE[palette[i]];
        const distance = colorDistance(rgb, paletteRgb);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }

    return closestIndex;
}

// Use median cut algorithm to find the best 16 colors for the image
function findBestPalette(imageData: ImageData): number[] {
    // Extract all unique colors from the image
    const colorCounts = new Map<string, {rgb: [number, number, number], count: number}>();

    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const key = `${r},${g},${b}`;

        const existing = colorCounts.get(key);
        if (existing) {
            existing.count++;
        } else {
            colorCounts.set(key, {rgb: [r, g, b], count: 1});
        }
    }

    // Sort colors by frequency
    const sortedColors = Array.from(colorCounts.values())
        .sort((a, b) => b.count - a.count);

    // For simplicity, use k-means-like approach: pick the most frequent colors
    // and find their closest matches in the master palette
    const selectedPaletteIndices = new Set<number>();

    // Always include black (index 253) as the first color
    selectedPaletteIndices.add(253);

    // Find the best matching palette indices for the most common colors
    for (const {rgb} of sortedColors) {
        if (selectedPaletteIndices.size >= 16) break;

        // Find closest palette index
        let minDistance = Infinity;
        let closestIndex = 0;

        for (let i = 0; i < SYSTEM_PALETTE.length; i++) {
            if (selectedPaletteIndices.has(i)) continue;

            const distance = colorDistance(rgb, SYSTEM_PALETTE[i]);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }

        selectedPaletteIndices.add(closestIndex);
    }

    // Fill remaining slots with commonly useful colors if needed
    const defaultPalette = [253, 255, 6, 61, 127, 37, 224, 9, 64, 130, 52, 229, 149, 60, 170, 237];
    for (const idx of defaultPalette) {
        if (selectedPaletteIndices.size >= 16) break;
        selectedPaletteIndices.add(idx);
    }

    return Array.from(selectedPaletteIndices).slice(0, 16);
}

// Process image and return debug data
async function processImage(file: File): Promise<{
    pixelData: number[];
    width: number;
    height: number;
    palette: number[];
}> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Calculate best fit dimensions
            const aspectRatio = img.width / img.height;
            const targetAspectRatio = TARGET_WIDTH / TARGET_HEIGHT;

            let width: number;
            let height: number;

            if (aspectRatio > targetAspectRatio) {
                // Image is wider, fit to width
                width = TARGET_WIDTH;
                height = Math.round(TARGET_WIDTH / aspectRatio);
            } else {
                // Image is taller, fit to height
                height = TARGET_HEIGHT;
                width = Math.round(TARGET_HEIGHT * aspectRatio);
            }

            // Create canvas and resize image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Draw resized image
            ctx.drawImage(img, 0, 0, width, height);

            // Get image data
            const imageData = ctx.getImageData(0, 0, width, height);

            // Find best 16-color palette
            const palette = findBestPalette(imageData);

            // Convert image to palette indices and pack as 4bpp (2 pixels per byte)
            const pixelData: number[] = [];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x += 2) {
                    // Get even pixel (high nibble)
                    const i1 = (y * width + x) * 4;
                    const rgb1: [number, number, number] = [
                        imageData.data[i1],
                        imageData.data[i1 + 1],
                        imageData.data[i1 + 2]
                    ];
                    const paletteIndex1 = findClosestPaletteIndex(rgb1, palette);

                    // Get odd pixel (low nibble) - use black if at edge
                    let paletteIndex2 = 0;
                    if (x + 1 < width) {
                        const i2 = (y * width + x + 1) * 4;
                        const rgb2: [number, number, number] = [
                            imageData.data[i2],
                            imageData.data[i2 + 1],
                            imageData.data[i2 + 2]
                        ];
                        paletteIndex2 = findClosestPaletteIndex(rgb2, palette);
                    }

                    // Pack: high nibble (even pixel) | low nibble (odd pixel)
                    const packedByte = (paletteIndex1 << 4) | paletteIndex2;
                    pixelData.push(packedByte);
                }
            }

            resolve({pixelData, width, height, palette});
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

// Generate assembly code
function generateAssembly(
    pixelData: number[],
    width: number,
    height: number,
    palette: number[]
): string {
    const lines: string[] = [];

    lines.push('; Image to Assembly - Generated Code');
    lines.push('; Image dimensions: ' + width + 'x' + height);
    lines.push('');
    lines.push('.org $B80');
    lines.push('');
    lines.push('; Constants');
    lines.push('.define VIDEO_MODE $0101');
    lines.push('.define PALETTE_RAM $0200');
    lines.push('.define SCRATCH $80');
    lines.push('');
    lines.push('main:');
    lines.push('  ; Set video mode to 0 (256x160 @ 4bpp)');
    lines.push('  LD R0, #0');
    lines.push('  ST R0, [VIDEO_MODE]');
    lines.push('');
    lines.push('  ; Setup palette');
    lines.push('  CALL setup_palette');
    lines.push('');
    lines.push('  ; Clear screen to black');
    lines.push('  CALL clear_screen');
    lines.push('');
    lines.push('  ; Draw centered image (X must be even for 4bpp packing)');
    const centerX = Math.floor((TARGET_WIDTH - width) / 2);
    const alignedCenterX = centerX - (centerX % 2); // Ensure even X position
    lines.push('  LD R0, #' + alignedCenterX + ' ; Center X (aligned to even)');
    lines.push('  LD R1, #' + Math.floor((TARGET_HEIGHT - height) / 2) + ' ; Center Y');
    lines.push('  CALL draw_bitmap');
    lines.push('');
    lines.push('done:');
    lines.push('  JMP done');
    lines.push('');

    // Setup palette subroutine
    lines.push('setup_palette:');
    lines.push('  PUSH R0');
    lines.push('  PUSH R1');
    lines.push('  PUSH R2');
    lines.push('  PUSH R3');
    lines.push('');
    for (let i = 0; i < palette.length; i++) {
        lines.push('  LD R0, #' + palette[i]);
        lines.push('  ST R0, [PALETTE_RAM + ' + i + ']');
    }
    lines.push('');
    lines.push('  POP R3');
    lines.push('  POP R2');
    lines.push('  POP R1');
    lines.push('  POP R0');
    lines.push('  RET');
    lines.push('');

    // Clear screen subroutine
    lines.push('clear_screen:');
    lines.push('  PUSH R0');
    lines.push('  PUSH R2');
    lines.push('  PUSH R3');
    lines.push('  PUSH R4');
    lines.push('');
    lines.push('  LD R2, #$B0');
    lines.push('  LD R3, #$00');
    lines.push('  LD R4, #$50');
    lines.push('  LD R0, #0');
    lines.push('');
    lines.push('.outer:');
    lines.push('  DEC R4');
    lines.push('  CMP R4, #$FF');
    lines.push('  BRZ .done_clear');
    lines.push('');
    lines.push('.inner:');
    lines.push('  ST R0, [R2:R3]');
    lines.push('  INC R3');
    lines.push('  BRNZ .inner');
    lines.push('');
    lines.push('  INC R2');
    lines.push('  JMP .outer');
    lines.push('');
    lines.push('.done_clear:');
    lines.push('  POP R4');
    lines.push('  POP R3');
    lines.push('  POP R2');
    lines.push('  POP R0');
    lines.push('  RET');
    lines.push('');

    // Draw bitmap subroutine (works with packed 4bpp data)
    lines.push('draw_bitmap:');
    lines.push('.define START_X SCRATCH');
    lines.push('.define CURRENT_X SCRATCH+1');
    lines.push('.define CURRENT_Y SCRATCH+2');
    lines.push('.define END_Y SCRATCH+3');
    lines.push('.define BITMAP_LO SCRATCH+4');
    lines.push('.define BITMAP_HI SCRATCH+5');
    lines.push('.define END_X SCRATCH+6');
    lines.push('');
    lines.push('  PUSH R0');
    lines.push('  PUSH R1');
    lines.push('  PUSH R2');
    lines.push('  PUSH R3');
    lines.push('  PUSH R4');
    lines.push('  PUSH R5');
    lines.push('');
    lines.push('  ST R0, START_X');
    lines.push('  ST R1, CURRENT_Y');
    lines.push('  ADD R1, #' + height);
    lines.push('  ST R1, END_Y');
    lines.push('  LD R1, START_X');
    lines.push('  ADD R1, #' + width);
    lines.push('  ST R1, END_X');
    lines.push('');
    lines.push('  LD R4, #>bitmap');
    lines.push('  LD R5, #<bitmap');
    lines.push('  ST R4, BITMAP_HI');
    lines.push('  ST R5, BITMAP_LO');
    lines.push('');
    lines.push('.row_loop:');
    lines.push('  LD R0, START_X');
    lines.push('  ST R0, CURRENT_X');
    lines.push('');
    lines.push('.col_loop:');
    lines.push('  ; Load packed byte from bitmap');
    lines.push('  LD R4, BITMAP_HI');
    lines.push('  LD R5, BITMAP_LO');
    lines.push('  LD R2, [R4:R5]');
    lines.push('');
    lines.push('  ; Draw two pixels (packed in R2)');
    lines.push('  LD R0, CURRENT_X');
    lines.push('  LD R1, CURRENT_Y');
    lines.push('  CALL draw_packed_pixels');
    lines.push('');
    lines.push('  ; Increment bitmap pointer');
    lines.push('  LD R2, BITMAP_LO');
    lines.push('  INC R2');
    lines.push('  ST R2, BITMAP_LO');
    lines.push('  BRNZ .no_carry');
    lines.push('  LD R3, BITMAP_HI');
    lines.push('  INC R3');
    lines.push('  ST R3, BITMAP_HI');
    lines.push('.no_carry:');
    lines.push('');
    lines.push('  ; Next column (increment by 2 since we drew 2 pixels)');
    lines.push('  LD R0, CURRENT_X');
    lines.push('  INC R0');
    lines.push('  INC R0');
    lines.push('  ST R0, CURRENT_X');
    lines.push('  LD R1, END_X');
    lines.push('  CMP R0, R1');
    lines.push('  BRNZ .col_loop');
    lines.push('');
    lines.push('  ; Next row');
    lines.push('  LD R0, CURRENT_Y');
    lines.push('  INC R0');
    lines.push('  ST R0, CURRENT_Y');
    lines.push('  LD R1, END_Y');
    lines.push('  CMP R0, R1');
    lines.push('  BRZ .done_bitmap');
    lines.push('  JMP .row_loop');
    lines.push('.done_bitmap:');
    lines.push('');
    lines.push('  POP R5');
    lines.push('  POP R4');
    lines.push('  POP R3');
    lines.push('  POP R2');
    lines.push('  POP R1');
    lines.push('  POP R0');
    lines.push('  RET');
    lines.push('');

    // Draw packed pixels subroutine
    // Inputs: R0 = X coordinate (must be even: 0, 2, 4, etc.)
    //         R1 = Y coordinate
    //         R2 = packed byte (high nibble = pixel at X, low nibble = pixel at X+1)
    // Writes the packed byte directly to framebuffer at (X, Y)
    lines.push('draw_packed_pixels:');
    lines.push('  PUSH R0');
    lines.push('  PUSH R1');
    lines.push('  PUSH R2');
    lines.push('  PUSH R3');
    lines.push('  PUSH R4');
    lines.push('  PUSH R5');
    lines.push('');
    lines.push('  ; Bounds check Y');
    lines.push('  CMP R1, #160');
    lines.push('  BRC .exit_packed');
    lines.push('');
    lines.push('  ; Calculate framebuffer address: 0xB000 + (Y * 128) + (X / 2)');
    lines.push('  ; Since X is even, X/2 is just X >> 1');
    lines.push('  LD R3, #0');
    lines.push('  MOV R4, R1');
    lines.push('');
    lines.push('  ; Multiply Y by 128 (shift left 7 times)');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('');
    lines.push('  ; Add X/2 to the offset');
    lines.push('  MOV R5, R0');
    lines.push('  SHR R5');
    lines.push('  ADD R4, R5');
    lines.push('  BRC .carry_packed');
    lines.push('  JMP .no_carry_packed');
    lines.push('');
    lines.push('.carry_packed:');
    lines.push('  INC R3');
    lines.push('');
    lines.push('.no_carry_packed:');
    lines.push('  ; Add framebuffer base (0xB000)');
    lines.push('  ADD R3, #$B0');
    lines.push('');
    lines.push('  ; Write packed byte directly to framebuffer');
    lines.push('  ST R2, [R3:R4]');
    lines.push('');
    lines.push('.exit_packed:');
    lines.push('  POP R5');
    lines.push('  POP R4');
    lines.push('  POP R3');
    lines.push('  POP R2');
    lines.push('  POP R1');
    lines.push('  POP R0');
    lines.push('  RET');
    lines.push('');

    // Draw pixel subroutine (from examples) - kept for reference but not used for bitmap
    lines.push('draw_pixel:');
    lines.push('  PUSH R0');
    lines.push('  PUSH R1');
    lines.push('  PUSH R2');
    lines.push('  PUSH R3');
    lines.push('  PUSH R4');
    lines.push('  PUSH R5');
    lines.push('');
    lines.push('  CMP R1, #160');
    lines.push('  BRC .exit');
    lines.push('');
    lines.push('  LD R3, #0');
    lines.push('  MOV R4, R1');
    lines.push('');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('  SHL R4');
    lines.push('  ROL R3');
    lines.push('');
    lines.push('  MOV R5, R0');
    lines.push('  SHR R5');
    lines.push('  ADD R4, R5');
    lines.push('  BRC .carry');
    lines.push('  JMP .no_carry2');
    lines.push('');
    lines.push('.carry:');
    lines.push('  INC R3');
    lines.push('');
    lines.push('.no_carry2:');
    lines.push('  ADD R3, #$B0');
    lines.push('');
    lines.push('  LD R5, [R3:R4]');
    lines.push('');
    lines.push('  AND R0, #1');
    lines.push('  BRNZ .odd_pixel');
    lines.push('');
    lines.push('  AND R5, #$0F');
    lines.push('  SHL R2, #4');
    lines.push('  OR R5, R2');
    lines.push('  JMP .write_byte');
    lines.push('');
    lines.push('.odd_pixel:');
    lines.push('  AND R5, #$F0');
    lines.push('  AND R2, #$0F');
    lines.push('  OR R5, R2');
    lines.push('');
    lines.push('.write_byte:');
    lines.push('  ST R5, [R3:R4]');
    lines.push('');
    lines.push('.exit:');
    lines.push('  POP R5');
    lines.push('  POP R4');
    lines.push('  POP R3');
    lines.push('  POP R2');
    lines.push('  POP R1');
    lines.push('  POP R0');
    lines.push('  RET');
    lines.push('');

    // Bitmap data
    lines.push('bitmap:');
    for (let i = 0; i < pixelData.length; i += 16) {
        const chunk = pixelData.slice(i, i + 16);
        const hexValues = chunk.map(v => '$' + v.toString(16).toUpperCase().padStart(2, '0'));
        lines.push('  .byte ' + hexValues.join(', '));
    }

    return lines.join('\n');
}

export function ImageGenerator({isOpen, onClose, onGenerate}: ImageGeneratorProps) {
    const [files, setFiles] = useState<FilePondFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [debugData, setDebugData] = useState<{
        pixelData: number[];
        width: number;
        height: number;
        palette: number[];
    } | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleGenerate = useCallback(async () => {
        if (files.length === 0) {
            setError('Please select an image file');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const file = files[0].file as File;
            const data = await processImage(file);
            setDebugData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process image');
        } finally {
            setIsProcessing(false);
        }
    }, [files]);

    // Render debug canvas when debug data is available
    useEffect(() => {
        if (!debugData || !canvasRef.current) return;

        const canvas = canvasRef.current;
        canvas.width = debugData.width;
        canvas.height = debugData.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        // Create ImageData to render
        const imageData = ctx.createImageData(debugData.width, debugData.height);

        // Unpack 4bpp data and convert to RGB
        let pixelIndex = 0;
        for (let i = 0; i < debugData.pixelData.length; i++) {
            const packedByte = debugData.pixelData[i];

            // Extract high nibble (even pixel)
            const paletteIndex1 = (packedByte >> 4) & 0x0F;
            const masterPaletteIndex1 = debugData.palette[paletteIndex1];
            const rgb1 = SYSTEM_PALETTE[masterPaletteIndex1];

            imageData.data[pixelIndex * 4] = rgb1[0];
            imageData.data[pixelIndex * 4 + 1] = rgb1[1];
            imageData.data[pixelIndex * 4 + 2] = rgb1[2];
            imageData.data[pixelIndex * 4 + 3] = 255;
            pixelIndex++;

            // Extract low nibble (odd pixel) - only if not past width
            if (pixelIndex % debugData.width !== 0) {
                const paletteIndex2 = packedByte & 0x0F;
                const masterPaletteIndex2 = debugData.palette[paletteIndex2];
                const rgb2 = SYSTEM_PALETTE[masterPaletteIndex2];

                imageData.data[pixelIndex * 4] = rgb2[0];
                imageData.data[pixelIndex * 4 + 1] = rgb2[1];
                imageData.data[pixelIndex * 4 + 2] = rgb2[2];
                imageData.data[pixelIndex * 4 + 3] = 255;
                pixelIndex++;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }, [debugData]);

    const handleContinueToAssembly = useCallback(() => {
        if (!debugData) return;

        const assemblyCode = generateAssembly(
            debugData.pixelData,
            debugData.width,
            debugData.height,
            debugData.palette
        );
        onGenerate(assemblyCode);
        setDebugData(null);
        onClose();
    }, [debugData, onGenerate, onClose]);

    return (
        <Dialog isOpen={isOpen} onClose={onClose} title="Convert image to assembly">
            <div className="space-y-4">
                {!debugData ? (
                    <>
                        <div className="text-zinc-300 text-sm">
                            Upload an image to convert it to assembly code. The image will be:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Resized to best fit 256x160 resolution</li>
                                <li>Converted to a 16-color palette</li>
                                <li>Generated as assembly code that draws the image centered on screen</li>
                            </ul>
                        </div>

                        <FilePond
                            files={files.map(f => f.file)}
                            onupdatefiles={(fileItems) => setFiles(fileItems as FilePondFile[])}
                            allowMultiple={false}
                            maxFiles={1}
                            acceptedFileTypes={['image/*']}
                            labelIdle='Drag & Drop your image or <span class="filepond--label-action">Browse</span>'
                        />

                        {error && (
                            <div className="bg-red-600 text-white px-4 py-2 rounded text-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={files.length === 0 || isProcessing}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? 'Processing...' : 'Process Image'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-zinc-300 text-sm">
                            Preview of processed image with 16-color palette:
                            <div className="mt-2 text-xs">
                                Size: {debugData.width}×{debugData.height} pixels
                            </div>
                        </div>

                        <div className="flex justify-center bg-black p-4 rounded">
                            <canvas
                                ref={canvasRef}
                                className="border border-zinc-600"
                                style={{imageRendering: 'pixelated'}}
                            />
                        </div>

                        <div className="text-zinc-300 text-xs">
                            <div className="font-semibold mb-1">Selected Palette:</div>
                            <div className="flex flex-wrap gap-2">
                                {debugData.palette.map((masterIdx, idx) => {
                                    const rgb = SYSTEM_PALETTE[masterIdx];
                                    return (
                                        <div key={idx} className="flex items-center gap-1">
                                            <div
                                                className="w-6 h-6 border border-zinc-600 rounded"
                                                style={{backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`}}
                                            />
                                            <span>{idx}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <button
                                onClick={() => setDebugData(null)}
                                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleContinueToAssembly}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                                Generate Assembly
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Dialog>
    );
}
