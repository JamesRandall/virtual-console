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
export type Action = 'cut' | 'copy' | 'paste';

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
  const drawingTools = TOOLS.filter((t) => t.group === 'drawing');
  const selectionTools = TOOLS.filter((t) => t.group === 'selection');

  const isActionEnabled = (action: Action): boolean => {
    if (action === 'cut' || action === 'copy') {
      return hasSelection;
    }
    if (action === 'paste') {
      return hasClipboard;
    }
    return true;
  };

  return (
    <div className="flex flex-col dk-padding-tight dk-gap-small w-10">
      {/* Drawing tools */}
      <div className="flex flex-col dk-gap-tight">
        <span className="dk-tertiary-text text-[9px] text-center">Draw</span>
        {drawingTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            className={`
              w-8 h-8 flex items-center justify-center rounded transition-colors
              ${
                selectedTool === tool.id
                  ? 'bg-zinc-600 text-white'
                  : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'
              }
            `}
            title={tool.label}
          >
            <FontAwesomeIcon icon={tool.icon} className="text-sm" />
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-600 my-1" />

      {/* Selection tools */}
      <div className="flex flex-col dk-gap-tight">
        <span className="dk-tertiary-text text-[9px] text-center">Select</span>
        {selectionTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            className={`
              w-8 h-8 flex items-center justify-center rounded transition-colors
              ${
                selectedTool === tool.id
                  ? 'bg-zinc-600 text-white'
                  : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'
              }
            `}
            title={tool.label}
          >
            <FontAwesomeIcon icon={tool.icon} className="text-sm" />
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-600 my-1" />

      {/* Actions */}
      <div className="flex flex-col dk-gap-tight">
        <span className="dk-tertiary-text text-[9px] text-center">Edit</span>
        {ACTIONS.map((action) => {
          const enabled = isActionEnabled(action.id);
          const isActive = action.id === 'paste' && isPasting;
          return (
            <button
              key={action.id}
              onClick={() => enabled && onAction(action.id)}
              disabled={!enabled}
              className={`
                w-8 h-8 flex items-center justify-center rounded transition-colors
                ${
                  isActive
                    ? 'bg-zinc-600 text-white'
                    : enabled
                      ? 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }
              `}
              title={action.label}
            >
              <FontAwesomeIcon icon={action.icon} className="text-sm" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
