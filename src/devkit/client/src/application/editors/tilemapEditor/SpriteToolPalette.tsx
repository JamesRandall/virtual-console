import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faMousePointer,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { SpriteTool } from './spriteUtils';

interface SpriteToolPaletteProps {
  selectedTool: SpriteTool;
  onToolChange: (tool: SpriteTool) => void;
  hasSelection: boolean;
  onDelete: () => void;
}

interface ToolButton {
  tool: SpriteTool;
  icon: IconDefinition;
  title: string;
  shortcut?: string;
}

const tools: ToolButton[] = [
  { tool: 'select', icon: faMousePointer, title: 'Select / Move', shortcut: 'M' },
  { tool: 'place', icon: faPlus, title: 'Place Sprite', shortcut: 'P' },
  { tool: 'delete', icon: faTrash, title: 'Delete Sprite', shortcut: 'D' },
];

export function SpriteToolPalette({
  selectedTool,
  onToolChange,
  hasSelection,
  onDelete,
}: SpriteToolPaletteProps) {
  return (
    <div className="flex flex-col h-full bg-zinc-800 border-r border-zinc-700 py-2">
      {/* Sprite tools */}
      <div className="flex flex-col gap-1 px-1">
        {tools.map(({ tool, icon, title, shortcut }) => (
          <button
            key={tool}
            onClick={() => onToolChange(tool)}
            className={`
              w-10 h-10 flex items-center justify-center rounded transition-colors
              ${selectedTool === tool
                ? 'bg-green-600 text-white'
                : 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }
            `}
            title={`${title}${shortcut ? ` (${shortcut})` : ''}`}
          >
            <FontAwesomeIcon icon={icon} className="text-sm" />
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-700 my-2 mx-1" />

      {/* Delete selected (for quick access) */}
      <div className="flex flex-col gap-1 px-1">
        <button
          onClick={onDelete}
          disabled={!hasSelection}
          className={`
            w-10 h-10 flex items-center justify-center rounded transition-colors
            ${hasSelection
              ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
              : 'text-zinc-600 cursor-not-allowed'
            }
          `}
          title="Delete Selected (Delete)"
        >
          <FontAwesomeIcon icon={faTrash} className="text-sm" />
        </button>
      </div>

      {/* Help text */}
      <div className="mt-auto px-2 py-2">
        <div className="text-[9px] text-zinc-500 leading-tight">
          <div>T: Tile mode</div>
          <div>S: Sprite mode</div>
          <div>Arrows: Nudge</div>
          <div>H/V: Flip</div>
        </div>
      </div>
    </div>
  );
}
