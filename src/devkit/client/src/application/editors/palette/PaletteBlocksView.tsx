import { useState } from 'react';
import { SYSTEM_PALETTE, rgbToString } from '../../../../../../console/src/systemPalette';

interface PaletteBlocksViewProps {
  paletteData: Uint8Array;
  blockSize: number;
  blockCount: number;
  onColorChange: (paletteIndex: number, colorIndex: number, systemPaletteIndex: number) => void;
  showIndexes?: boolean;
}

export function PaletteBlocksView({ paletteData, blockSize, blockCount, onColorChange, showIndexes = true }: PaletteBlocksViewProps) {
  const [draggedPaletteColor, setDraggedPaletteColor] = useState<{ paletteIndex: number; colorIndex: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ paletteIndex: number; colorIndex: number } | null>(null);

  const handleDragStart = (e: React.DragEvent, paletteIndex: number, colorIndex: number) => {
    const offset = paletteIndex * blockSize + colorIndex;
    const systemPaletteIndex = paletteData[offset];

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('paletteBlockIndex', paletteIndex.toString());
    e.dataTransfer.setData('paletteColorIndex', colorIndex.toString());
    e.dataTransfer.setData('systemPaletteIndex', systemPaletteIndex.toString());

    setDraggedPaletteColor({ paletteIndex, colorIndex });
  };

  const handleDragEnd = () => {
    setDraggedPaletteColor(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, paletteIndex: number, colorIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDropTarget({ paletteIndex, colorIndex });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent, paletteIndex: number, colorIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);

    // Try multiple ways to get the data
    let systemPaletteIndexStr = e.dataTransfer.getData('systemPaletteIndex');
    if (!systemPaletteIndexStr) {
      systemPaletteIndexStr = e.dataTransfer.getData('text/plain');
    }

    if (systemPaletteIndexStr) {
      const systemPaletteIndex = parseInt(systemPaletteIndexStr, 10);
      onColorChange(paletteIndex, colorIndex, systemPaletteIndex);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: blockCount }, (_, paletteIndex) => {
        const offset = paletteIndex * blockSize;
        const colors = Array.from({ length: blockSize }, (_, i) => paletteData[offset + i]);

        return (
          <div key={paletteIndex} className="flex flex-col gap-2">
            {/* Palette block header */}
            <div className="flex items-center gap-2">
              <span className="dk-subsection-header">Block {paletteIndex}</span>
              <span className="dk-tertiary-text text-xs">
                (0x{(0x0200 + offset).toString(16).toUpperCase().padStart(4, '0')})
              </span>
            </div>

            {/* Color grid */}
            <div className="grid grid-cols-16 gap-1">
              {colors.map((systemPaletteIndex, colorIndex) => {
                const color = SYSTEM_PALETTE[systemPaletteIndex];
                const isDragging = draggedPaletteColor?.paletteIndex === paletteIndex &&
                                   draggedPaletteColor?.colorIndex === colorIndex;
                const isDropTarget = dropTarget?.paletteIndex === paletteIndex &&
                                     dropTarget?.colorIndex === colorIndex;

                return (
                  <div
                    key={colorIndex}
                    draggable
                    onDragStart={(e) => handleDragStart(e, paletteIndex, colorIndex)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, paletteIndex, colorIndex)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, paletteIndex, colorIndex)}
                    className={`
                      relative w-8 h-8 rounded cursor-move border-2
                      ${isDragging ? 'border-white opacity-50' : ''}
                      ${isDropTarget ? 'border-green-400 scale-110' : 'border-zinc-600'}
                      ${!isDragging && !isDropTarget ? 'hover:border-zinc-400' : ''}
                      transition-all
                    `}
                    style={{ backgroundColor: rgbToString(color) }}
                    title={`Color ${colorIndex}: System palette index ${systemPaletteIndex}`}
                  >
                    {/* Color index label */}
                    {showIndexes && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span
                          className="text-[8px] font-mono font-semibold px-0.5 rounded"
                          style={{
                            color: color[0] + color[1] + color[2] > 384 ? '#000' : '#fff',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                          }}
                        >
                          {colorIndex}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
