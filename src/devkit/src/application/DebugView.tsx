import {useEffect, useState} from 'react';
import { DebugToolbar } from "./DebugToolbar.tsx";
import { MemoryView } from "./MemoryView.tsx";
import { RegisterView } from "./RegisterView.tsx";
import { ConsoleView } from "./ConsoleView.tsx";
import { TabStrip, type Tab } from "../components/TabStrip.tsx";
import {useDevkitStore} from "../stores/devkitStore.ts";
import {useVirtualConsole} from "../consoleIntegration/virtualConsole.tsx";
import {updateVirtualConsoleSnapshot} from "../stores/utilities.ts";

type TabId = 'debug' | 'console';

const TABS: Tab[] = [
    { id: 'debug', label: 'Debug' },
    { id: 'console', label: 'Console' },
];

export function DebugView() {
    // Local state
    const [activeTab, setActiveTab] = useState<TabId>('debug');
    const updateMemorySnapshot = useDevkitStore((state) => state.updateMemorySnapshot);
    const updateCpuSnapshot = useDevkitStore((state) => state.updateCpuSnapshot);
    const virtualConsole = useVirtualConsole();

    useEffect(() => {
        // Wait for CPU to be initialized before taking snapshot
        virtualConsole.ready.then(() => {
            updateVirtualConsoleSnapshot(virtualConsole, updateMemorySnapshot, updateCpuSnapshot).catch((error) => {
                console.error("Error updating snapshots:", error);
            });
        });
    }, [updateCpuSnapshot, updateMemorySnapshot, virtualConsole]);

    // Event handlers
    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId as TabId);
    };

    // Render
    return (
        <div className="h-full w-full bg-zinc-800 flex flex-col">
            {/* Tabs */}
            <TabStrip
                tabs={TABS}
                activeTabId={activeTab}
                onTabChange={handleTabChange}
            />

            {/* Tab content - flex-1 makes it fill available space */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'debug' ? (
                    <div className="h-full grid grid-rows-[1fr_auto]">
                        <MemoryView />
                        <RegisterView />
                    </div>
                ) : (
                    <ConsoleView />
                )}
            </div>

            {/* Toolbar at bottom */}
            <DebugToolbar />
        </div>
    );
}