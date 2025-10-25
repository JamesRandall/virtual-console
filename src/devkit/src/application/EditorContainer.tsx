import {Editor} from "@monaco-editor/react";

export function EditorContainer() {
    return <div className="h-full w-full bg-zinc-800">
        <Editor
            height="100%"
            defaultLanguage="typescript"
            defaultValue="// some comment"
            theme="vs-dark"
            onChange={(value) => console.log(value)}
        />
    </div>
}