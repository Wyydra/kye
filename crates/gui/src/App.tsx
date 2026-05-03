import "./App.css";
import Canvas from "./components/Canvas";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MainLayout } from "./components/MainLayout";
import { useWorkspace } from "./hooks/useWorkspace";
import { WorkspaceContext } from "./context/WorkspaceContext";

function App() {
  const { workspace, workspacePath, templates, noWorkspace, selectWorkspace } = useWorkspace();

  return (
    <WorkspaceContext.Provider value={{ workspacePath, templates }}>
      {noWorkspace ? (
        <WelcomeScreen onSelectWorkspace={selectWorkspace} />
      ) : (
        <MainLayout onSelectWorkspace={selectWorkspace}>
          <Canvas workspace={workspace} />
        </MainLayout>
      )}
    </WorkspaceContext.Provider>
  );
}

export default App;
