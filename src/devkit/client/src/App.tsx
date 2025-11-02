import {Allotment} from "allotment";
import {DebugView} from "./application/DebugView.tsx";
import {EditorContainer} from "./application/EditorContainer.tsx";
import {AiChatPanel} from "./application/AiChatPanel.tsx";
import "allotment/dist/style.css";

function App() {
  return (
      <div className="h-full overflow-none">
          <Allotment>
              <DebugView />
              <EditorContainer />
              <AiChatPanel />
          </Allotment>
      </div>
  )
}

export default App
