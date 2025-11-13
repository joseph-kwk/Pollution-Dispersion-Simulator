import React from 'react';
import { useSimulationStore } from '@/stores/simulationStore';

export const StatusBar: React.FC = () => {
  const { fps, gpuEnabled, isRunning } = useSimulationStore();

  return (
    <footer className="app-status">
      <div className="status-section">
        <div className="status-indicator">
          <span className={`status-dot ${isRunning ? 'active' : ''}`}></span>
          <span>{isRunning ? 'Running' : 'Ready'}</span>
        </div>
        <div className="status-indicator">
          <span className={`status-dot ${gpuEnabled ? 'active' : ''}`}></span>
          <span>GPU: {gpuEnabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div className="status-indicator">
          <span>FPS: {fps}</span>
        </div>
      </div>

      <div className="status-section">
        <span style={{ fontSize: 'var(--font-size-xs)' }}>
          Grid: 80×80 | WebGL: Checking | v3.0.0
        </span>
      </div>
    </footer>
  );
};