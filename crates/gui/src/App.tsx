import { useEffect, useState } from "react";
import { EditorProvider } from "./context/EditorContext";
import { MainLayout } from "./components/layout/MainLayout";
import { kyeService } from "./services/kyeService";
import { FolderOpen } from "lucide-react";

function App() {
  const [hasWorkspace, setHasWorkspace] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if a workspace is configured
    kyeService
      .getWorkspacePath()
      .then((path) => setHasWorkspace(!!path))
      .catch(() => setHasWorkspace(false));
  }, []);

  const handleSelectWorkspace = async () => {
    try {
      const path = await kyeService.selectWorkspaceFolder();
      if (path) {
        setHasWorkspace(true);
      }
    } catch (e) {
      console.error("Failed to select workspace:", e);
    }
  };

  if (hasWorkspace === null) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasWorkspace) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mx-auto mb-8 ring-1 ring-primary/10">
            <FolderOpen className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Kye</h1>
          <p className="text-muted-foreground leading-relaxed">
            Choose a folder to start your spatial-first knowledge graph. 
            All your data stays local and private.
          </p>
          <button
            onClick={handleSelectWorkspace}
            className="mt-8 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all active:scale-95"
          >
            Open Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <EditorProvider>
      <MainLayout />
    </EditorProvider>
  );
}

export default App;
