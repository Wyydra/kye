import { KyeCanvas } from "./components/canvas/KyeCanvas";
import { WelcomeScreen } from "./components/layout/WelcomeScreen";
import { MainLayout } from "./components/layout/MainLayout";
import { useWorkspace } from "./hooks/useWorkspace";
import { WorkspaceContext } from "./context/WorkspaceContext";

function App() {
  const { workspace, workspacePath, templates, noWorkspace, selectWorkspace, refresh } = useWorkspace();

  return (
    <WorkspaceContext.Provider value={{ workspacePath, templates, refresh }}>
      {noWorkspace ? (
        <WelcomeScreen onSelectWorkspace={selectWorkspace} />
      ) : (
        <MainLayout onSelectWorkspace={selectWorkspace} onRefresh={refresh}>
          <KyeCanvas workspace={workspace} templates={templates} onRefresh={refresh} />
        </MainLayout>
      )}
    </WorkspaceContext.Provider>
  );
}

export default App;
