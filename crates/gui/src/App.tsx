import { EditorProvider } from "./context/EditorContext";
import { MainLayout } from "./components/layout/MainLayout";

function App() {
  return (
    <EditorProvider>
      <MainLayout />
    </EditorProvider>
  );
}

export default App;
