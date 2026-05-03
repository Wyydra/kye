import { KyeCanvas } from "./components/KyeCanvas";
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
          <KyeCanvas workspace={workspace} />
        </MainLayout>
      )}
    </WorkspaceContext.Provider>
  );
}

export default App;
