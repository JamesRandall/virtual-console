import { useState } from 'react';
import { SYSTEM_PALETTE, rgbToString } from '../../../../../../console/src/systemPalette';

interface SystemPaletteViewProps {
  showIndexes?: boolean;
}

export function SystemPaletteView({ showIndexes = true }: SystemPaletteViewProps) {
  const [draggedColor, setDraggedColor] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, colorIndex: number) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', colorIndex.toString()); // Use text/plain for compatibility
    e.dataTransfer.setData('systemPaletteIndex', colorIndex.toString());
    setDraggedColor(colorIndex);
  };

  const handleDragEnd = () => {
    setDraggedColor(null);
  };

  return (
    <div className="grid grid-cols-16 gap-1">
      {SYSTEM_PALETTE.map((color, index) => (
        <div
          key={index}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          className={`
            relative w-8 h-8 rounded cursor-move border-2
            ${draggedColor === index ? 'border-white opacity-50' : 'border-zinc-600'}
            hover:border-zinc-400 transition-colors
          `}
          style={{ backgroundColor: rgbToString(color) }}
          title={`Index ${index}: rgb(${color[0]}, ${color[1]}, ${color[2]})`}
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
                {index}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
