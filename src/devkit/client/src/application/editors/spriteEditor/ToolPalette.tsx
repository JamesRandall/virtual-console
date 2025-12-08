import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPen,
  faSquare,
  faCircle,
  faSlash,
  faEraser,
  faFill,
  faBorderAll,
  faScissors,
  faCopy,
  faPaste,
  faHand,
  faArrowsLeftRight,
  faArrowsUpDown,
} from '@fortawesome/free-solid-svg-icons';
import { type IconDefinition } from '@fortawesome/fontawesome-svg-core';

// Tools that can be selected and stay active
export type Tool =
  | 'pen'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'eraser'
  | 'fill'
  | 'select'
  | 'move';

// Actions that execute immediately
export type Action = 'cut' | 'copy' | 'paste' | 'flipH' | 'flipV';

interface ToolConfig {
  id: Tool;
  icon: IconDefinition;
  label: string;
  group: 'drawing' | 'selection';
}

interface ActionConfig {
  id: Action;
  icon: IconDefinition;
  label: string;
}

const TOOLS: ToolConfig[] = [
  // Drawing tools
  { id: 'pen', icon: faPen, label: 'Pixel Pen', group: 'drawing' },
  { id: 'rectangle', icon: faSquare, label: 'Rectangle', group: 'drawing' },
  { id: 'ellipse', icon: faCircle, label: 'Ellipse', group: 'drawing' },
  { id: 'line', icon: faSlash, label: 'Line', group: 'drawing' },
  { id: 'fill', icon: faFill, label: 'Flood Fill', group: 'drawing' },
  { id: 'eraser', icon: faEraser, label: 'Eraser', group: 'drawing' },
  // Selection tools
  { id: 'select', icon: faBorderAll, label: 'Select Area', group: 'selection' },
  { id: 'move', icon: faHand, label: 'Move', group: 'selection' },
];

const ACTIONS: ActionConfig[] = [
  { id: 'cut', icon: faScissors, label: 'Cut Selection' },
  { id: 'copy', icon: faCopy, label: 'Copy Selection' },
  { id: 'paste', icon: faPaste, label: 'Paste' },
  { id: 'flipH', icon: faArrowsLeftRight, label: 'Flip Horizontal' },
  { id: 'flipV', icon: faArrowsUpDown, label: 'Flip Vertical' },
];

interface ToolPaletteProps {
  selectedTool: Tool;
  onToolSelect: (tool: Tool) => void;
  onAction: (action: Action) => void;
  hasSelection: boolean;
  hasClipboard: boolean;
  isPasting: boolean;
}

export function ToolPalette({
  selectedTool,
  onToolSelect,
  onAction,
  hasSelection,
  hasClipboard,
  isPasting,
}: ToolPaletteProps) {
  const isActionEnabled = (action: Action): boolean => {
    if (action === 'cut' || action === 'copy') {
      return hasSelection;
    }
    if (action === 'paste') {
      return hasClipboard;
    }
    // flipH and flipV are always enabled
    return true;
  };

  return (
    <div className="flex flex-col bg-zinc-800 overflow-visible">
      {/* All tools */}
      {TOOLS.map((tool) => (
        <div key={tool.id} className="relative group">
          <button
            onClick={() => onToolSelect(tool.id)}
            className={`
              w-10 h-10 flex items-center justify-center transition-colors
              ${
                selectedTool === tool.id
                  ? 'bg-zinc-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }
            `}
          >
            <FontAwesomeIcon icon={tool.icon} className="text-base" />
          </button>
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-zinc-900 text-zinc-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            {tool.label}
          </div>
        </div>
      ))}

      {/* Actions */}
      {ACTIONS.map((action) => {
        const enabled = isActionEnabled(action.id);
        const isActive = action.id === 'paste' && isPasting;
        return (
          <div key={action.id} className="relative group">
            <button
              onClick={() => enabled && onAction(action.id)}
              disabled={!enabled}
              className={`
                w-10 h-10 flex items-center justify-center transition-colors
                ${
                  isActive
                    ? 'bg-zinc-600 text-white'
                    : enabled
                      ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }
              `}
            >
              <FontAwesomeIcon icon={action.icon} className="text-base" />
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-zinc-900 text-zinc-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              {action.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
