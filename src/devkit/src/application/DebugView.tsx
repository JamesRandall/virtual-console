import {MemoryView} from "./MemoryView.tsx";
import {RegisterView} from "./RegisterView.tsx";
import {DebugToolbar} from "./DebugToolbar.tsx";

export function DebugView() {
    return <div className="h-full w-full bg-zinc-800 grid grid-rows-[1fr_auto_auto]">
        <MemoryView />
        <RegisterView />
        <DebugToolbar />
    </div>
}