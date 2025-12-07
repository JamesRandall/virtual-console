import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPen,
  faEraser,
  faFillDrip,
  faObjectGroup,
  faArrowsUpDownLeftRight,
  faMousePointer,
  faCopy,
  faCut,
  faPaste,
  faSlash,
  faSquare,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type TilemapTool = 'pen' | 'eraser' | 'fill' | 'line' | 'rectangle' | 'select' | 'move' | 'pointer';

interface TilemapToolPaletteProps {
  selectedTool: TilemapTool;
  onToolChange: (tool: TilemapTool) => void;
  hasSelection: boolean;
  hasClipboard: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
}

interface ToolButton {
  tool: TilemapTool;
  icon: IconDefinition;
  title: string;
  shortcut?: string;
}

const tools: ToolButton[] = [
  { tool: 'pointer', icon: faMousePointer, title: 'Pointer (Edit Attributes)', shortcut: 'A' },
  { tool: 'pen', icon: faPen, title: 'Pen', shortcut: 'P' },
  { tool: 'eraser', icon: faEraser, title: 'Eraser', shortcut: 'E' },
  { tool: 'fill', icon: faFillDrip, title: 'Fill', shortcut: 'F' },
  { tool: 'line', icon: faSlash, title: 'Line', shortcut: 'L' },
  { tool: 'rectangle', icon: faSquare, title: 'Rectangle', shortcut: 'R' },
  { tool: 'select', icon: faObjectGroup, title: 'Select', shortcut: 'S' },
  { tool: 'move', icon: faArrowsUpDownLeftRight, title: 'Move', shortcut: 'M' },
];

export function TilemapToolPalette({
  selectedTool,
  onToolChange,
  hasSelection,
  hasClipboard,
  onCopy,
  onCut,
  onPaste,
}: TilemapToolPaletteProps) {
  return (
    <div className="flex flex-col h-full bg-zinc-800 border-r border-zinc-700 py-2">
      {/* Drawing tools */}
      <div className="flex flex-col gap-1 px-1">
        {tools.map(({ tool, icon, title, shortcut }) => (
          <button
            key={tool}
            onClick={() => onToolChange(tool)}
            className={`
              w-10 h-10 flex items-center justify-center rounded transition-colors
              ${selectedTool === tool
                ? 'bg-zinc-600 text-white'
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

      {/* Clipboard operations */}
      <div className="flex flex-col gap-1 px-1">
        <button
          onClick={onCopy}
          disabled={!hasSelection}
          className={`
            w-10 h-10 flex items-center justify-center rounded transition-colors
            ${hasSelection
              ? 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              : 'text-zinc-600 cursor-not-allowed'
            }
          `}
          title="Copy (Ctrl+C)"
        >
          <FontAwesomeIcon icon={faCopy} className="text-sm" />
        </button>
        <button
          onClick={onCut}
          disabled={!hasSelection}
          className={`
            w-10 h-10 flex items-center justify-center rounded transition-colors
            ${hasSelection
              ? 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              : 'text-zinc-600 cursor-not-allowed'
            }
          `}
          title="Cut (Ctrl+X)"
        >
          <FontAwesomeIcon icon={faCut} className="text-sm" />
        </button>
        <button
          onClick={onPaste}
          disabled={!hasClipboard}
          className={`
            w-10 h-10 flex items-center justify-center rounded transition-colors
            ${hasClipboard
              ? 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              : 'text-zinc-600 cursor-not-allowed'
            }
          `}
          title="Paste (Ctrl+V)"
        >
          <FontAwesomeIcon icon={faPaste} className="text-sm" />
        </button>
      </div>
    </div>
  );
}
