import "./App.css";
import { invoke } from "@tauri-apps/api/core";
import Canvas from "./components/Canvas";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { useWorkspace } from "./hooks/useWorkspace";

function App() {
  const { workspace, noWorkspace, refresh } = useWorkspace();

  const handleSelectWorkspace = async () => {
    try {
      await invoke("select_workspace_folder");
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main style={{ margin: 0, padding: 0, width: "100vw", height: "100vh", display: "flex" }}>
      {noWorkspace
        ? <WelcomeScreen onSelectWorkspace={handleSelectWorkspace} />
        : <Canvas workspace={workspace} />
      }
    </main>
  );
}

export default App;
