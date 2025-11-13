import React from 'react';
import { Waves, Sun, Moon } from 'lucide-react';

export const Header: React.FC = () => {
  const [isDark, setIsDark] = React.useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="app-title">
          <Waves style={{ width: '24px', height: '24px', marginRight: '8px' }} />
          Pollution Dispersion Simulator
        </h1>
      </div>
      <div className="header-right">
        <div className="status-indicator">
          <div className="status-dot active"></div>
          <span id="systemStatus">Online</span>
        </div>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          data-tooltip="Toggle Dark/Light Theme"
          data-tooltip-position="bottom"
        >
          {isDark ? <Sun id="themeIcon" /> : <Moon id="themeIcon" />}
        </button>
      </div>
    </header>
  );
};