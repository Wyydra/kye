import "./App.css";
import Canvas from "./components/Canvas";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { useWorkspace } from "./hooks/useWorkspace";
import { WorkspaceContext } from "./context/WorkspaceContext";

function App() {
  const { workspace, workspacePath, templates, noWorkspace, selectWorkspace } = useWorkspace();

  return (
    <WorkspaceContext.Provider value={{ workspacePath, templates }}>
      <main style={{ margin: 0, padding: 0, width: "100vw", height: "100vh", display: "flex" }}>
        {noWorkspace
          ? <WelcomeScreen onSelectWorkspace={selectWorkspace} />
          : <Canvas workspace={workspace} />
        }
      </main>
    </WorkspaceContext.Provider>
  );
}

export default App;
