import React, { useState } from 'react';
import styles from './MainLayout.module.css';
import { ChevronLeftIcon } from './Icons';

interface MainLayoutProps {
  children: React.ReactNode;
  onSelectWorkspace: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, onSelectWorkspace }) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${isSidebarCollapsed ? styles.collapsed : ''}`}>
        <header className={styles.sidebarHeader}>
          <h1 className={`${styles.logo} ${isSidebarCollapsed ? styles.hidden : ''}`}>Kye</h1>
          <button className={styles.toggleButton} onClick={toggleSidebar}>
            <ChevronLeftIcon className={styles.toggleIcon} />
          </button>
        </header>
        <nav className={`${styles.nav} ${isSidebarCollapsed ? styles.hidden : ''}`}>
          <button className={styles.navButton} onClick={onSelectWorkspace}>
            Open Workspace
          </button>
        </nav>
      </aside>
      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
};
