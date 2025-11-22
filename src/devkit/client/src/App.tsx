import {Allotment} from "allotment";
import {DebugView} from "./application/DebugView.tsx";
import {EditorContainer} from "./application/EditorContainer.tsx";
import {AiChatPanel} from "./application/AiChatPanel.tsx";
import {ProjectExplorer} from "./application/ProjectExplorer.tsx";
import "allotment/dist/style.css";

function App() {
  return (
      <div className="h-full overflow-none">
          <Allotment>
              <Allotment.Pane minSize={200} preferredSize={250}>
                  <ProjectExplorer />
              </Allotment.Pane>
              <Allotment.Pane>
                  <Allotment>
                      <DebugView />
                      <EditorContainer />
                      <AiChatPanel />
                  </Allotment>
              </Allotment.Pane>
          </Allotment>
      </div>
  )
}

export default App
