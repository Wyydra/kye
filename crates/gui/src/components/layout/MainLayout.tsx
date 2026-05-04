import React, { useState } from 'react';
import { 
  ChevronLeft, 
  Search, 
  Clock, 
  Settings, 
  Plus, 
  LayoutGrid,
  FolderOpen
} from 'lucide-react';
import { eventBus } from '../../lib/eventBus';
import { cn } from '../../lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
  onSelectWorkspace: () => void;
  onRefresh: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, onSelectWorkspace, onRefresh }) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!isSidebarCollapsed);
    setTimeout(() => {
      eventBus.emit('layout:resize');
    }, 300);
  };

  const NavItem = ({ icon: Icon, label, onClick, active = false }: any) => (
    <button 
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-all",
        active 
          ? "bg-accent text-accent-foreground" 
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
      {!isSidebarCollapsed && <span className="truncate">{label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar */}
      <aside 
        className={cn(
          "relative flex flex-col border-r bg-secondary transition-all duration-300 ease-in-out group/sidebar",
          isSidebarCollapsed ? "w-[60px]" : "w-[240px]"
        )}
      >
        {/* User / Workspace Selector */}
        <div className="flex items-center gap-2 p-4 mb-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
            K
          </div>
          {!isSidebarCollapsed && (
            <span className="text-sm font-semibold truncate">Kye Workspace</span>
          )}
        </div>

        {/* Navigation Content */}
        <div className="flex-1 px-3 space-y-6 overflow-y-auto">
          {/* Main Actions */}
          <div className="space-y-1">
            <NavItem icon={Search} label="Search" onClick={() => {}} />
            <NavItem icon={Clock} label="Recent" onClick={() => {}} />
            <NavItem icon={Settings} label="Settings" onClick={() => {}} />
          </div>

          {/* Workspace Section */}
          <div className="space-y-1">
            {!isSidebarCollapsed && (
              <h3 className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Workspace
              </h3>
            )}
            <NavItem icon={LayoutGrid} label="All Blocks" onClick={onRefresh} active={true} />
            <NavItem icon={FolderOpen} label="Open Folder" onClick={onSelectWorkspace} />
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t bg-secondary/50">
          <button 
            onClick={() => eventBus.emit('canvas:menu:open')}
            className={cn(
              "flex w-full items-center gap-2 rounded-md bg-foreground text-background py-2 px-3 text-sm font-bold shadow-sm transition-all hover:opacity-90 active:scale-95",
              isSidebarCollapsed ? "justify-center px-0" : "justify-start"
            )}
          >
            <Plus className="h-4 w-4" />
            {!isSidebarCollapsed && <span>New Node</span>}
          </button>
        </div>

        {/* Collapse Toggle - Only visible on hover of sidebar or when collapsed */}
        <button 
          onClick={toggleSidebar}
          className={cn(
            "absolute -right-3 top-12 z-20 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm transition-all hover:scale-110 opacity-0 group-hover/sidebar:opacity-100",
            isSidebarCollapsed && "opacity-100 right-[-12px]"
          )}
        >
          <ChevronLeft className={cn("h-3 w-3 transition-transform", isSidebarCollapsed && "rotate-180")} />
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
};
