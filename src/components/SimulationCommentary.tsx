import React from 'react';
import { useSimulationStore } from '../stores/simulationStore';

export const SimulationCommentary: React.FC = () => {
  const { isRunning, sources, parameters } = useSimulationStore();

  const getWindDescription = () => {
    const speed = parameters.windSpeed;
    if (speed < 0.3) return 'Calm conditions';
    if (speed < 0.8) return 'Light breeze';
    if (speed < 1.3) return 'Moderate wind';
    return 'Strong wind';
  };

  const getWindDirectionName = () => {
    const dir = parameters.windDirection;
    if (dir >= 337.5 || dir < 22.5) return 'North';
    if (dir >= 22.5 && dir < 67.5) return 'Northeast';
    if (dir >= 67.5 && dir < 112.5) return 'East';
    if (dir >= 112.5 && dir < 157.5) return 'Southeast';
    if (dir >= 157.5 && dir < 202.5) return 'South';
    if (dir >= 202.5 && dir < 247.5) return 'Southwest';
    if (dir >= 247.5 && dir < 292.5) return 'West';
    return 'Northwest';
  };

  const getDiffusionDescription = () => {
    const rate = parameters.diffusionRate;
    if (rate < 0.1) return 'Low spreading';
    if (rate < 0.25) return 'Moderate spreading';
    return 'High spreading';
  };

  const getReleaseDescription = () => {
    const rate = parameters.releaseRate;
    if (rate < 15) return 'Low emission rate';
    if (rate < 30) return 'Moderate emission rate';
    return 'High emission rate';
  };

  if (!isRunning) {
    return (
      <div className="simulation-commentary">
        <div className="commentary-header">
          <div className="status-dot paused"></div>
          <span className="commentary-title">Simulation Paused</span>
        </div>
        <div className="commentary-content">
          <p className="commentary-text">
            Click <strong>Start</strong> to begin the pollution dispersion simulation.
          </p>
          <div className="commentary-details">
            <div className="detail-item">
              <span className="detail-icon">🌀</span>
              <span className="detail-text">Particles will spawn from {sources.length} source{sources.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="detail-item">
              <span className="detail-icon">💨</span>
              <span className="detail-text">{getWindDescription()} from {getWindDirectionName()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="simulation-commentary active">
      <div className="commentary-header">
        <div className="status-dot running"></div>
        <span className="commentary-title">Simulation Active</span>
      </div>
      <div className="commentary-content">
        <p className="commentary-text">
          <strong>{sources.length}</strong> pollution source{sources.length !== 1 ? 's' : ''} releasing contaminants. 
          Particles are flowing <strong>{getWindDirectionName()}</strong> with <strong>{getWindDescription().toLowerCase()}</strong>.
        </p>
        <div className="commentary-details">
          <div className="detail-item">
            <span className="detail-icon">📊</span>
            <span className="detail-text">{getReleaseDescription()}</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon">🌊</span>
            <span className="detail-text">{getDiffusionDescription()}</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon">🎨</span>
            <span className="detail-text">Blue → Red = Clean → Polluted</span>
          </div>
        </div>
        <div className="commentary-info">
          <small>💡 Adjust wind direction and speed to see the pollution plume shift in real-time</small>
        </div>
      </div>
    </div>
  );
};
