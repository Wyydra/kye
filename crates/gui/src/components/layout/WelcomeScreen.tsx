import React from "react";
import { FolderOpen } from "lucide-react";

interface WelcomeScreenProps {
  onSelectWorkspace: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSelectWorkspace,
}) => {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
      <div className="flex h-[500px] w-full max-w-[800px] overflow-hidden rounded-xl border bg-card shadow-2xl">
        {/* Left Side - Logo Area */}
        <div className="flex w-1/3 items-center justify-center bg-secondary/50 text-6xl font-black text-primary">
          KYE
        </div>

        {/* Right Side - Content */}
        <div className="flex flex-1 flex-col justify-center p-12">
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground">
            Welcome
          </h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Select a folder to get started with your graph workspace.
          </p>

          <div className="flex flex-col gap-4">
            <button
              onClick={onSelectWorkspace}
              className="flex items-center justify-start gap-3 rounded-lg border bg-secondary p-4 text-left transition-all hover:border-primary/50 hover:bg-secondary/80 group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-background border transition-colors group-hover:border-primary/50">
                <FolderOpen className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <div>
                <div className="font-semibold text-foreground">
                  Open Workspace
                </div>
                <div className="text-sm text-muted-foreground">
                  Choose a local folder to open
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
