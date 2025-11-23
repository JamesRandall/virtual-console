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
    <div className="dk-tab-container">
      {tabs.map((tab) => {
        const canClose = tab.canClose !== false;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`${
              activeTabId === tab.id
                ? 'dk-tab-active'
                : 'dk-tab-inactive'
            } flex items-center dk-gap-small min-w-fit`}
          >
            <span className="flex items-center dk-gap-tight">
              {tab.isDirty && (
                <span className="w-2 h-2 dk-bg-hover rounded-full" title="Unsaved changes" />
              )}
              {tab.label}
            </span>
            {canClose && onTabClose && (
              <span
                onClick={(e) => handleCloseClick(e, tab.id)}
                className="ml-1 hover:dk-bg-hover dk-rounded px-1 dk-text-secondary hover:text-white dk-transition"
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
