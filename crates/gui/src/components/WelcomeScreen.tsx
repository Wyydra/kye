import React from 'react';
import styles from './WelcomeScreen.module.css';

interface WelcomeScreenProps {
  onSelectWorkspace: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectWorkspace }) => {
  return (
    <div className={styles.welcomeContainer}>
      <div className={styles.welcomeCard}>
        <h1 className={styles.welcomeTitle}>Welcome to Kye</h1>
        <p className={styles.welcomeDescription}>
          To get started, please select a folder to serve as your workspace.
        </p>
        <button className={styles.selectButton} onClick={onSelectWorkspace}>
          Select Workspace
        </button>
      </div>
    </div>
  );
};
