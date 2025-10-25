import {MemoryView} from "./MemoryView.tsx";
import {RegisterView} from "./RegisterView.tsx";

export function DebugView() {
    return <div className="h-full w-full bg-zinc-800 grid grid-rows-[1fr_auto]">
        <MemoryView />
        <RegisterView />
    </div>
}