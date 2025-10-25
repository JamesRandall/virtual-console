import {MemoryView} from "./MemoryView.tsx";

export function DebugView() {
    return <div className="h-full w-full bg-zinc-800">
        <MemoryView />
    </div>
}