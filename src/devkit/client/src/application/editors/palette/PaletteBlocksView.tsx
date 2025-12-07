import { useState } from 'react';
import { SYSTEM_PALETTE, rgbToString } from '../../../../../../console/src/systemPalette';

interface PaletteBlocksViewProps {
  paletteData: Uint8Array;
  blockSize: number;
  blockCount: number;
  onColorChange: (paletteIndex: number, colorIndex: number, systemPaletteIndex: number) => void;
  onBlockReorder?: (fromIndex: number, toIndex: number) => void;
  showIndexes?: boolean;
}

export function PaletteBlocksView({ paletteData, blockSize, blockCount, onColorChange, onBlockReorder, showIndexes = true }: PaletteBlocksViewProps) {
  const [draggedPaletteColor, setDraggedPaletteColor] = useState<{ paletteIndex: number; colorIndex: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ paletteIndex: number; colorIndex: number } | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<number | null>(null);
  const [blockDropTarget, setBlockDropTarget] = useState<number | null>(null);

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

  // Block drag handlers
  const handleBlockDragStart = (e: React.DragEvent<HTMLDivElement>, blockIndex: number) => {
    e.stopPropagation();
    // Set data transfer properties
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    e.dataTransfer.setData('text/plain', `block-${blockIndex}`);
    e.dataTransfer.setData('application/x-palette-block', blockIndex.toString());

    // Set a drag image using the current target
    const target = e.currentTarget;
    if (target) {
      e.dataTransfer.setDragImage(target, 10, 10);
    }

    setDraggedBlock(blockIndex);
  };

  const handleBlockDragEnd = () => {
    setDraggedBlock(null);
    setBlockDropTarget(null);
  };

  const handleBlockDragOver = (e: React.DragEvent, blockIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    // Only show drop target if we're dragging a block (not a color)
    if (e.dataTransfer.types.includes('application/x-palette-block')) {
      e.dataTransfer.dropEffect = 'move';
      setBlockDropTarget(blockIndex);
    }
  };

  const handleBlockDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBlockDropTarget(null);
  };

  const handleBlockDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setBlockDropTarget(null);
    setDraggedBlock(null);

    const blockIndexStr = e.dataTransfer.getData('application/x-palette-block');
    if (blockIndexStr && onBlockReorder) {
      const fromIndex = parseInt(blockIndexStr, 10);
      if (fromIndex !== targetIndex) {
        onBlockReorder(fromIndex, targetIndex);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: blockCount }, (_, paletteIndex) => {
        const offset = paletteIndex * blockSize;
        const colors = Array.from({ length: blockSize }, (_, i) => paletteData[offset + i]);

        const isDraggingBlock = draggedBlock === paletteIndex;
        const isBlockDropTarget = blockDropTarget === paletteIndex && draggedBlock !== paletteIndex;

        return (
          <div
            key={paletteIndex}
            className={`
              flex flex-col gap-2 p-2 -m-2 rounded-lg transition-all
              ${isDraggingBlock ? 'opacity-50 bg-zinc-700/50' : ''}
              ${isBlockDropTarget ? 'bg-green-900/30 ring-2 ring-green-400' : ''}
            `}
            onDragOver={(e) => handleBlockDragOver(e, paletteIndex)}
            onDragLeave={handleBlockDragLeave}
            onDrop={(e) => handleBlockDrop(e, paletteIndex)}
          >
            {/* Palette block header - draggable handle */}
            <div
              className={`
                flex items-center gap-2
                hover:bg-zinc-700/50 -mx-1 px-1 py-0.5 rounded transition-colors
                ${onBlockReorder ? 'cursor-grab active:cursor-grabbing' : ''}
              `}
              draggable={!!onBlockReorder}
              onDragStart={(e) => handleBlockDragStart(e, paletteIndex)}
              onDragEnd={handleBlockDragEnd}
            >
              {onBlockReorder && (
                <span className="dk-tertiary-text text-xs">⠿</span>
              )}
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
