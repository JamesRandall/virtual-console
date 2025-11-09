import {useState, useCallback, useRef, useEffect} from 'react';
import {FilePond, registerPlugin} from 'react-filepond';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import type {FilePondFile} from 'filepond';

import 'filepond/dist/filepond.min.css';
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css';

import {Dialog} from './Dialog';

// Register Filepond plugins
registerPlugin(FilePondPluginImagePreview);

interface ImageGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (assemblyCode: string) => void;
}

// RGB palette from the video spec
const RGB_PALETTE: [number, number, number][] = [
    // red - row 0
    [254, 242, 242], [255, 226, 226], [255, 201, 201], [255, 162, 162], [255, 100, 103], [255, 57, 66], [241, 31, 47], [208, 6, 33], [173, 0, 27], [145, 0, 23], [83, 0, 16],
    // orange - row 1
    [255, 251, 235], [255, 244, 214], [255, 232, 176], [255, 214, 130], [255, 184, 72], [255, 161, 46], [247, 132, 24], [207, 99, 5], [169, 74, 1], [139, 57, 2], [85, 33, 2],
    // amber - row 2
    [255, 252, 231], [255, 247, 195], [254, 237, 150], [255, 224, 102], [255, 208, 65], [255, 188, 51], [248, 157, 30], [209, 120, 10], [173, 93, 3], [145, 74, 4], [90, 45, 1],
    // yellow - row 3
    [255, 254, 234], [254, 252, 197], [254, 245, 140], [255, 235, 87], [255, 222, 54], [254, 203, 44], [248, 166, 26], [209, 125, 6], [175, 98, 3], [147, 79, 5], [92, 49, 3],
    // lime - row 4
    [253, 255, 233], [247, 255, 199], [235, 252, 156], [217, 248, 105], [194, 240, 64], [168, 228, 51], [138, 202, 31], [111, 168, 12], [91, 141, 5], [77, 122, 4], [49, 84, 2],
    // green - row 5
    [247, 254, 231], [235, 251, 210], [214, 246, 178], [183, 238, 140], [141, 224, 95], [105, 209, 76], [74, 182, 63], [53, 153, 53], [38, 128, 45], [29, 110, 41], [15, 75, 28],
    // emerald - row 6
    [236, 253, 245], [212, 250, 230], [178, 245, 209], [137, 237, 183], [89, 224, 152], [56, 209, 133], [38, 184, 118], [27, 157, 107], [18, 131, 94], [13, 111, 83], [6, 76, 59],
    // teal - row 7
    [241, 254, 253], [205, 251, 250], [154, 246, 246], [102, 239, 245], [53, 226, 239], [29, 210, 228], [20, 183, 206], [14, 156, 180], [11, 130, 156], [9, 112, 138], [6, 81, 104],
    // cyan - row 8
    [237, 254, 255], [206, 251, 254], [164, 247, 254], [113, 240, 254], [56, 228, 254], [30, 214, 248], [22, 189, 225], [16, 164, 200], [13, 140, 176], [10, 121, 157], [8, 94, 128],
    // sky - row 9
    [241, 251, 255], [226, 244, 255], [188, 232, 255], [138, 218, 255], [89, 199, 255], [60, 182, 254], [42, 157, 230], [28, 133, 202], [19, 113, 177], [14, 97, 156], [9, 73, 122],
    // blue - row 10
    [239, 246, 255], [222, 235, 255], [192, 219, 255], [151, 199, 255], [109, 173, 255], [81, 151, 255], [62, 130, 247], [50, 112, 223], [40, 92, 191], [33, 77, 166], [22, 53, 123],
    // indigo - row 11
    [239, 243, 255], [225, 231, 255], [200, 211, 255], [166, 184, 255], [128, 152, 255], [103, 127, 254], [84, 106, 240], [72, 90, 216], [60, 73, 187], [50, 61, 163], [32, 38, 118],
    // violet - row 12
    [246, 245, 255], [238, 235, 254], [224, 218, 254], [199, 193, 255], [170, 159, 255], [146, 131, 254], [129, 110, 246], [115, 94, 228], [99, 78, 204], [85, 63, 179], [61, 41, 139],
    // purple - row 13
    [251, 245, 255], [245, 234, 255], [233, 218, 255], [215, 195, 255], [188, 164, 254], [167, 139, 250], [150, 118, 241], [133, 98, 224], [116, 79, 202], [100, 62, 179], [72, 40, 142],
    // fuchsia - row 14
    [253, 244, 255], [250, 232, 255], [243, 216, 255], [232, 193, 254], [217, 162, 254], [205, 138, 254], [192, 117, 248], [175, 96, 231], [155, 75, 207], [136, 56, 183], [105, 36, 146],
    // pink - row 15
    [254, 243, 255], [252, 232, 254], [246, 215, 254], [238, 191, 254], [227, 160, 254], [219, 137, 254], [207, 118, 248], [190, 97, 230], [170, 75, 207], [151, 56, 183], [115, 35, 142],
    // rose - row 16
    [254, 242, 249], [252, 231, 243], [251, 213, 235], [250, 189, 225], [246, 156, 211], [244, 133, 201], [238, 112, 189], [224, 88, 171], [204, 66, 151], [183, 46, 131], [142, 24, 100],
    // pink - row 17
    [255, 242, 246], [255, 228, 236], [254, 208, 224], [252, 182, 209], [249, 147, 189], [246, 122, 175], [239, 101, 162], [222, 78, 143], [197, 56, 121], [176, 37, 104], [134, 19, 77],
    // slate - row 18
    [252, 249, 251], [247, 243, 248], [239, 236, 244], [225, 223, 237], [186, 186, 214], [147, 148, 187], [115, 117, 163], [93, 96, 146], [68, 73, 125], [49, 54, 109], [30, 33, 82],
    // gray - row 19
    [252, 252, 253], [248, 249, 251], [241, 243, 247], [227, 231, 239], [187, 193, 209], [146, 153, 178], [115, 123, 151], [93, 102, 133], [68, 76, 107], [50, 58, 87], [30, 36, 65],
    // zinc - row 20
    [252, 252, 253], [249, 249, 251], [240, 240, 245], [228, 228, 235], [187, 188, 201], [146, 147, 166], [113, 114, 137], [92, 93, 118], [66, 67, 91], [49, 50, 70], [33, 34, 51],
    // neutral - row 21
    [252, 252, 253], [250, 250, 250], [241, 241, 241], [229, 229, 229], [189, 189, 189], [148, 148, 148], [113, 113, 113], [93, 93, 93], [66, 66, 66], [49, 49, 49], [35, 35, 35],
    // stone - row 22
    [252, 252, 251], [250, 250, 249], [241, 241, 239], [229, 229, 226], [189, 189, 185], [148, 148, 143], [115, 115, 109], [94, 94, 88], [66, 66, 61], [52, 52, 47], [35, 35, 31],
    // black - row 23 (first index is 253)
    [0, 0, 0], [0, 0, 0], [255, 255, 255]
];

// Target resolution for mode 0
const TARGET_WIDTH = 256;
const TARGET_HEIGHT = 160;

// Calculate color distance (Euclidean distance in RGB space)
function colorDistance(c1: [number, number, number], c2: [number, number, number]): number {
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
        const paletteRgb = RGB_PALETTE[palette[i]];
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

        for (let i = 0; i < RGB_PALETTE.length; i++) {
            if (selectedPaletteIndices.has(i)) continue;

            const distance = colorDistance(rgb, RGB_PALETTE[i]);
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

            // Convert image to palette indices (one per byte - draw_pixel will handle packing)
            const pixelData: number[] = [];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    const rgb: [number, number, number] = [
                        imageData.data[i],
                        imageData.data[i + 1],
                        imageData.data[i + 2]
                    ];
                    const paletteIndex = findClosestPaletteIndex(rgb, palette);
                    pixelData.push(paletteIndex);
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
    lines.push('  ; Draw centered image');
    lines.push('  LD R0, #' + Math.floor((TARGET_WIDTH - width) / 2) + ' ; Center X');
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

    // Draw bitmap subroutine
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
    lines.push('  LD R4, #<bitmap');
    lines.push('  LD R5, #>bitmap');
    lines.push('  ST R4, BITMAP_LO');
    lines.push('  ST R5, BITMAP_HI');
    lines.push('');
    lines.push('.row_loop:');
    lines.push('  LD R0, START_X');
    lines.push('  ST R0, CURRENT_X');
    lines.push('');
    lines.push('.col_loop:');
    lines.push('  ; Load palette index from bitmap');
    lines.push('  LD R4, BITMAP_HI');
    lines.push('  LD R5, BITMAP_LO');
    lines.push('  LD R2, [R4:R5]');
    lines.push('');
    lines.push('  ; Draw pixel');
    lines.push('  LD R0, CURRENT_X');
    lines.push('  LD R1, CURRENT_Y');
    lines.push('  CALL draw_pixel');
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
    lines.push('  ; Next column');
    lines.push('  LD R0, CURRENT_X');
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

    // Draw pixel subroutine (from examples)
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

        // Convert palette indices back to RGB using the palette
        for (let i = 0; i < debugData.pixelData.length; i++) {
            const paletteIndex = debugData.pixelData[i];
            const masterPaletteIndex = debugData.palette[paletteIndex];
            const rgb = RGB_PALETTE[masterPaletteIndex];

            const pixelIndex = i * 4;
            imageData.data[pixelIndex] = rgb[0];     // R
            imageData.data[pixelIndex + 1] = rgb[1]; // G
            imageData.data[pixelIndex + 2] = rgb[2]; // B
            imageData.data[pixelIndex + 3] = 255;    // A
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
                                    const rgb = RGB_PALETTE[masterIdx];
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
