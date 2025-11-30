import { useMemo } from 'react';
import { SYSTEM_PALETTE, rgbToString, type RGBColor } from '../../../../../../console/src/systemPalette';

interface ColorPickerProps {
  paletteData: Uint8Array | null;
  paletteBlockIndex: number;
  selectedColorIndex: number;
  onColorSelect: (colorIndex: number) => void;
  showTransparency: boolean;
}

const COLORS_PER_BLOCK_4BPP = 16;

// Checkerboard pattern for transparency display
const CHECKER_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='4' height='4' fill='%23404040'/%3E%3Crect x='4' y='4' width='4' height='4' fill='%23404040'/%3E%3Crect x='4' width='4' height='4' fill='%23303030'/%3E%3Crect y='4' width='4' height='4' fill='%23303030'/%3E%3C/svg%3E")`;

export function ColorPicker({
  paletteData,
  paletteBlockIndex,
  selectedColorIndex,
  onColorSelect,
  showTransparency,
}: ColorPickerProps) {
  // Get the colors for this palette block
  const colors = useMemo(() => {
    const result: Array<{ index: number; color: RGBColor; systemIndex: number }> = [];
    const blockOffset = paletteBlockIndex * COLORS_PER_BLOCK_4BPP;

    for (let i = 0; i < COLORS_PER_BLOCK_4BPP; i++) {
      const systemIndex = paletteData ? paletteData[blockOffset + i] || 0 : i;
      const color = SYSTEM_PALETTE[systemIndex] || SYSTEM_PALETTE[0];
      result.push({ index: i, color, systemIndex });
    }

    return result;
  }, [paletteData, paletteBlockIndex]);

  // Calculate brightness for contrast
  const getBrightness = (color: RGBColor): number => {
    return color[0] + color[1] + color[2];
  };

  return (
    <div className="flex flex-col dk-gap-tight">
      <div className="flex items-center dk-gap-small">
        <span className="dk-label">Color:</span>
        <span className="dk-tertiary-text text-xs">
          Index {selectedColorIndex} {selectedColorIndex === 0 && '(transparent)'}
        </span>
      </div>

      <div className="flex dk-gap-tight flex-wrap">
        {colors.map(({ index, color, systemIndex }) => {
          const isSelected = index === selectedColorIndex;
          const brightness = getBrightness(color);
          const isTransparent = index === 0;
          const useDarkRing = brightness > 384;

          return (
            <button
              key={index}
              onClick={() => onColorSelect(index)}
              className={`
                relative w-8 h-8 rounded transition-all
                ${isSelected
                  ? `ring-2 ring-offset-1 ring-offset-zinc-800 ${useDarkRing ? 'ring-black' : 'ring-white'}`
                  : 'hover:scale-110'}
              `}
              style={{
                backgroundColor: isTransparent && showTransparency ? 'transparent' : rgbToString(color),
                backgroundImage: isTransparent && showTransparency ? CHECKER_PATTERN : undefined,
              }}
              title={`Color ${index} (System palette: ${systemIndex})`}
            >
              {/* Selection indicator - circle in center */}
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`w-2 h-2 rounded-full ${useDarkRing ? 'bg-black' : 'bg-white'}`}
                  />
                </div>
              )}

              {/* Color index label */}
              <div className="absolute bottom-0 right-0 text-[8px] font-mono px-0.5 rounded-tl"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                }}
              >
                {index}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
