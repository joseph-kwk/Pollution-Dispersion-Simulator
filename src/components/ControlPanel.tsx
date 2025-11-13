import React from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { POLLUTANT_TYPES, GRID_SIZE } from '../types';
import { Play, Pause, RotateCcw, Wind, Waves, Droplets, Plus, Trash2 } from 'lucide-react';

export const ControlPanel: React.FC = () => {
  const { isRunning, parameters, sources, gpuEnabled, actions } = useSimulationStore();

  return (
    <div className="sidebar-content">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Controls</h2>
      </div>

      {/* Performance Section */}
      <div className="control-section">
        <h3 className="section-title">Performance</h3>
        <div className="toggle-container">
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>GPU Acceleration</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {gpuEnabled ? 'GPU: Enabled' : 'GPU: Disabled'}
            </div>
          </div>
          <div className={`toggle-switch ${gpuEnabled ? 'active' : ''}`} onClick={actions.toggleGPU}>
            <div className="toggle-thumb"></div>
          </div>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="control-section">
        <h3 className="section-title">Simulation</h3>

        <div className="btn-group">
          <button
            className="btn btn-primary ripple scale-hover"
            onClick={actions.start}
            disabled={isRunning}
          >
            <Play style={{ width: '16px', height: '16px' }} />
            Start
          </button>
          <button
            className="btn btn-secondary ripple scale-hover"
            onClick={actions.pause}
            disabled={!isRunning}
          >
            <Pause style={{ width: '16px', height: '16px' }} />
            Pause
          </button>
          <button
            className="btn btn-danger ripple scale-hover"
            onClick={actions.reset}
          >
            <RotateCcw style={{ width: '16px', height: '16px' }} />
            Reset
          </button>
        </div>

        {/* Pollution Type */}
        <div className="control-group">
          <label className="control-label">
            Pollution Type
          </label>
          <div className="select-container">
            <select
              className="select-input"
              value={sources[0]?.type || 'CHEMICAL'}
              onChange={(e) => {
                // Update first source type
                const newType = e.target.value as keyof typeof POLLUTANT_TYPES;
                actions.removeSource(0);
                actions.addSource({
                  x: sources[0]?.x || GRID_SIZE / 2,
                  y: sources[0]?.y || GRID_SIZE / 2,
                  type: newType
                });
              }}
            >
              {Object.entries(POLLUTANT_TYPES).map(([key, type]) => (
                <option key={key} value={key}>{type.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pollution Sources */}
        <div className="control-group">
          <label className="control-label">
            Pollution Sources ({sources.length})
          </label>
          <button
            className="btn btn-secondary ripple scale-hover"
            onClick={() => actions.addSource({
              x: Math.floor(GRID_SIZE / 2),
              y: Math.floor(GRID_SIZE / 2),
              type: 'CHEMICAL'
            })}
            style={{ width: '100%', marginBottom: '8px' }}
          >
            <Plus style={{ width: '14px', height: '14px', marginRight: '4px' }} />
            Add Source
          </button>
          {sources.map((source, index) => (
            <div key={index} className="source-item">
              <div className="source-info">
                <span>Source {index + 1}: {POLLUTANT_TYPES[source.type].name}</span>
                <span>({source.x}, {source.y})</span>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => actions.removeSource(index)}
                disabled={sources.length === 1}
              >
                <Trash2 style={{ width: '12px', height: '12px' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Environmental Controls */}
      <div className="control-section">
        <h3 className="section-title">Environment</h3>

        {/* Wind Direction */}
        <div className="control-group">
          <label className="control-label">
            <Wind style={{ width: '14px', height: '14px', marginRight: '4px' }} />
            Wind Direction
            <span className="control-value">{parameters.windDirection}°</span>
          </label>
          <div className="range-container">
            <input
              type="range"
              className="range-input"
              min="0"
              max="360"
              value={parameters.windDirection}
              step="1"
              onChange={(e) => actions.updateParameters({ windDirection: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Wind Speed */}
        <div className="control-group">
          <label className="control-label">
            <Wind style={{ width: '14px', height: '14px', marginRight: '4px' }} />
            Wind Speed
            <span className="control-value">{parameters.windSpeed}</span>
          </label>
          <div className="range-container">
            <input
              type="range"
              className="range-input"
              min="0"
              max="2"
              step="0.1"
              value={parameters.windSpeed}
              onChange={(e) => actions.updateParameters({ windSpeed: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Diffusion Rate */}
        <div className="control-group">
          <label className="control-label">
            <Waves style={{ width: '14px', height: '14px', marginRight: '4px' }} />
            Diffusion Rate
            <span className="control-value">{parameters.diffusionRate}</span>
          </label>
          <div className="range-container">
            <input
              type="range"
              className="range-input"
              min="0"
              max="0.5"
              step="0.01"
              value={parameters.diffusionRate}
              onChange={(e) => actions.updateParameters({ diffusionRate: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Release Rate */}
        <div className="control-group">
          <label className="control-label">
            <Droplets style={{ width: '14px', height: '14px', marginRight: '4px' }} />
            Release Rate
            <span className="control-value">{parameters.releaseRate}</span>
          </label>
          <div className="range-container">
            <input
              type="range"
              className="range-input"
              min="1"
              max="50"
              value={parameters.releaseRate}
              step="1"
              onChange={(e) => actions.updateParameters({ releaseRate: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};