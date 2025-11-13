import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '@/stores/simulationStore';
import { WebGLSimulationEngine } from '@/physics/WebGLSimulationEngine';

export const StatusBar: React.FC = () => {
  const { fps, gpuEnabled, isRunning } = useSimulationStore();
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // Check WebGL2 support
    setWebglSupported(WebGLSimulationEngine.isSupported());
  }, []);

  const getWebGLStatus = () => {
    if (webglSupported === null) return 'Checking';
    if (!webglSupported) return 'Not Supported';
    return gpuEnabled ? 'GPU Accelerated' : 'CPU Mode';
  };

  return (
    <footer className="app-status">
      <div className="status-section">
        <div className="status-indicator">
          <span className={`status-dot ${isRunning ? 'active' : ''}`}></span>
          <span>{isRunning ? 'Running' : 'Ready'}</span>
        </div>
        <div className="status-indicator">
          <span className={`status-dot ${webglSupported && gpuEnabled ? 'active' : ''}`}></span>
          <span>WebGL: {getWebGLStatus()}</span>
        </div>
        <div className="status-indicator">
          <span>FPS: {fps}</span>
        </div>
      </div>

      <div className="status-section">
        <span style={{ fontSize: 'var(--font-size-xs)' }}>
          Grid: 80×80 | Navier-Stokes Physics | v3.0.0
        </span>
      </div>
    </footer>
  );
};