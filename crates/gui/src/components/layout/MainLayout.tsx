import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { eventBus } from '../../lib/eventBus';
import { cn } from '../../lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
  onSelectWorkspace: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, onSelectWorkspace }) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!isSidebarCollapsed);
    setTimeout(() => {
      eventBus.emit('layout:resize');
    }, 300);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside 
        className={cn(
          "relative flex flex-col border-r bg-card transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-[60px]" : "w-[240px]"
        )}
      >
        <header className="flex items-center justify-between p-4">
          <h1 
            className={cn(
              "text-xl font-bold transition-all duration-300",
              isSidebarCollapsed ? "scale-0 opacity-0" : "scale-100 opacity-100"
            )}
          >
            Kye
          </h1>
          <button 
            onClick={toggleSidebar}
            className="rounded-md p-1.5 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ChevronLeft 
              className={cn(
                "h-5 w-5 transition-transform duration-300",
                isSidebarCollapsed && "rotate-180"
              )} 
            />
          </button>
        </header>

        <nav className={cn(
          "flex flex-col gap-2 p-4 transition-opacity duration-300",
          isSidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
          <button 
            onClick={onSelectWorkspace}
            className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary/80"
          >
            Open Workspace
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background/50">
        {children}
      </main>
    </div>
  );
};
