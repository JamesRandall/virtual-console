export interface Tab {
  id: string;
  label: string;
  isDirty?: boolean;  // Has unsaved changes
  canClose?: boolean; // Can be closed (default true)
}

interface TabStripProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
}

/**
 * TabStrip component for displaying a row of tabs with Tailwind styling.
 *
 * @param tabs - Array of tab objects with id and label
 * @param activeTabId - ID of the currently active tab
 * @param onTabChange - Callback fired when a tab is clicked
 * @param onTabClose - Optional callback fired when a tab's close button is clicked
 */
export function TabStrip({ tabs, activeTabId, onTabChange, onTabClose }: TabStripProps) {
  // Event handlers
  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
  };

  const handleCloseClick = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (onTabClose) {
      onTabClose(tabId);
    }
  };

  // Render
  return (
    <div className="flex border-b border-zinc-700 bg-zinc-800 overflow-x-auto">
      {tabs.map((tab) => {
        const canClose = tab.canClose !== false;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-r border-zinc-700 min-w-fit ${
              activeTabId === tab.id
                ? 'text-white bg-zinc-700 border-b-2 border-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-750'
            }`}
          >
            <span className="flex items-center gap-1">
              {tab.isDirty && (
                <span className="w-2 h-2 bg-amber-500 rounded-full" title="Unsaved changes" />
              )}
              {tab.label}
            </span>
            {canClose && onTabClose && (
              <span
                onClick={(e) => handleCloseClick(e, tab.id)}
                className="ml-1 hover:bg-zinc-600 rounded px-1 text-zinc-400 hover:text-white"
                title="Close"
              >
                ×
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
