import React from 'react';
import styles from './WelcomeScreen.module.css';

interface WelcomeScreenProps {
  onSelectWorkspace: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectWorkspace }) => {
  return (
    <div className={styles.welcomeContainer}>
      <div className={styles.welcomeCard}>
        <div className={styles.logo}>KYE</div>
        <div className={styles.mainContent}>
          <h1 className={styles.welcomeTitle}>Welcome</h1>
          <p className={styles.welcomeDescription}>
            Select a folder to get started
          </p>
          <div className={styles.buttonContainer}>
            <button className={styles.actionButton} onClick={onSelectWorkspace}>
              Open an Existing Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
