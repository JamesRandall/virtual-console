export interface Tab {
  id: string;
  label: string;
}

interface TabStripProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}

/**
 * TabStrip component for displaying a row of tabs with Tailwind styling.
 *
 * @param tabs - Array of tab objects with id and label
 * @param activeTabId - ID of the currently active tab
 * @param onTabChange - Callback fired when a tab is clicked
 */
export function TabStrip({ tabs, activeTabId, onTabChange }: TabStripProps) {
  // Event handlers
  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
  };

  // Render
  return (
    <div className="flex border-b border-zinc-700">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTabId === tab.id
              ? 'text-white border-b-2 border-white bg-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-750'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
