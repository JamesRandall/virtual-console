import {Allotment} from "allotment";
import {DebugView} from "./application/DebugView.tsx";
import {EditorContainer} from "./application/EditorContainer.tsx";
import {AiChatPanel} from "./application/AiChatPanel.tsx";
import {ProjectExplorer} from "./application/ProjectExplorer.tsx";
import {AppToolbar} from "./application/AppToolbar.tsx";
import {useDevkitStore} from "./stores/devkitStore.ts";
import "allotment/dist/style.css";

function App() {
  const appMode = useDevkitStore((state) => state.appMode);
  const showProjectExplorer = useDevkitStore((state) => state.showProjectExplorer);
  const showChat = useDevkitStore((state) => state.showChat);

  return (
      <div className="h-full flex flex-col overflow-hidden">
          <AppToolbar />
          <div className="flex-1 min-h-0">
              <Allotment>
                  {showProjectExplorer && (
                      <Allotment.Pane minSize={200} preferredSize={250}>
                          <ProjectExplorer />
                      </Allotment.Pane>
                  )}
                  {appMode === 'debug' && (
                      <Allotment.Pane>
                          <DebugView />
                      </Allotment.Pane>
                  )}
                  <Allotment.Pane>
                      <EditorContainer />
                  </Allotment.Pane>
                  {showChat && (
                      <Allotment.Pane>
                          <AiChatPanel />
                      </Allotment.Pane>
                  )}
              </Allotment>
          </div>
      </div>
  )
}

export default App
