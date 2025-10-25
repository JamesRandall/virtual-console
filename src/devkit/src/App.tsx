import {Allotment} from "allotment";
import {DebugView} from "./application/DebugView.tsx";
import {EditorContainer} from "./application/EditorContainer.tsx";
import "allotment/dist/style.css";

function App() {
  return (
      <div className="h-full overflow-none">
          <Allotment>
              <DebugView />
              <EditorContainer />
          </Allotment>
      </div>
  )
}

export default App
