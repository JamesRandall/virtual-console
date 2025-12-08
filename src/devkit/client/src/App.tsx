import {Allotment} from "allotment";
import {DebugView} from "./application/debugger/DebugView.tsx";
import {EditorContainer} from "./application/editors/EditorContainer.tsx";
import {AiChatPanel} from "./application/chat/AiChatPanel.tsx";
import {ProjectExplorer} from "./application/projectExplorer/ProjectExplorer.tsx";
import {AppToolbar} from "./application/AppToolbar.tsx";
import {ToastContainer} from "./components/Toast.tsx";
import {useDevkitStore} from "./stores/devkitStore.ts";
import "allotment/dist/style.css";

function App() {
  const appMode = useDevkitStore((state) => state.appMode);
  const showProjectExplorer = useDevkitStore((state) => state.showProjectExplorer);
  const showChat = useDevkitStore((state) => state.showChat);

  return (
      <>
        <div className="h-full flex flex-col overflow-hidden">
            <AppToolbar />
            <div className="flex-1 min-h-0">
                <Allotment>
                    {/* ProjectExplorer must stay mounted to avoid react-dnd HTML5Backend conflicts */}
                    {/* when it remounts. Use visible prop instead of conditional rendering. */}
                    <Allotment.Pane minSize={200} preferredSize={250} visible={showProjectExplorer}>
                        <ProjectExplorer />
                    </Allotment.Pane>
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
        <ToastContainer />
      </>
  )
}

export default App
