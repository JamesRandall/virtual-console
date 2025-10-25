import {Allotment} from "allotment";
import {DebugView} from "./application/DebugView.tsx";
import {Editor} from "./application/Editor.tsx";
import "allotment/dist/style.css";

function App() {
  return (
      <div className="h-full overflow-none">
          <Allotment>
              <DebugView />
              <Editor />
          </Allotment>
      </div>
  )
}

export default App
