import { useEffect, useState } from "react";
import { EditorProvider } from "./context/EditorContext";
import { MainLayout } from "./components/layout/MainLayout";
import { WelcomeScreen } from "./components/layout/WelcomeScreen";
import { kyeService } from "./services/kyeService";

function App() {
  const [hasWorkspace, setHasWorkspace] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if a workspace is configured by trying to get its path
    kyeService
      .getWorkspacePath()
      .then((path) => setHasWorkspace(!!path))
      .catch(() => setHasWorkspace(false));
  }, []);

  if (hasWorkspace === null) {
    // Loading state
    return <div className="h-screen w-screen bg-background" />;
  }

  const handleSelectWorkspace = async () => {
    try {
      console.log("Invoking select_workspace_folder...");
      const path = await kyeService.selectWorkspaceFolder();
      console.log("Selected path:", path);
      if (path) {
        setHasWorkspace(true);
      }
    } catch (e) {
      console.error("Failed to select workspace:", e);
    }
  };

  if (!hasWorkspace) {
    return <WelcomeScreen onSelectWorkspace={handleSelectWorkspace} />;
  }

  return (
    <EditorProvider>
      <MainLayout />
    </EditorProvider>
  );
}

export default App;
