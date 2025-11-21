import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wind, Sun, Moon, HelpCircle } from 'lucide-react';

export const Header: React.FC = () => {
  const [isDark, setIsDark] = React.useState(false);
  const location = useLocation();

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  };

  const startTour = () => {
    window.dispatchEvent(new CustomEvent('start-tour'));
  };

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="logo-link">
          <div className="logo-container">
            <Wind className="logo-icon" />
            <div className="logo-text">
              <span className="logo-title">Pollution Dispersion</span>
              <span className="logo-subtitle">Environmental Simulator</span>
            </div>
          </div>
        </Link>
        
        <nav className="main-nav">
          <Link 
            to="/" 
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            <span className="nav-icon">🎮</span>
            <span>Simulator</span>
          </Link>
          <Link 
            to="/case-studies" 
            className={`nav-link ${location.pathname === '/case-studies' ? 'active' : ''}`}
            data-tour="case-studies-nav"
          >
            <span className="nav-icon">📚</span>
            <span>Case Studies</span>
          </Link>
        </nav>
      </div>
      
      <div className="header-right">
        <div className="status-indicator">
          <div className="status-dot active"></div>
          <span id="systemStatus">Online</span>
        </div>
        <button
          className="theme-toggle"
          onClick={startTour}
          title="Start Tour"
          style={{ marginRight: '8px' }}
        >
          <HelpCircle size={20} />
        </button>
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