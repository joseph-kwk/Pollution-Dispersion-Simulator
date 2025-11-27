import React, { useRef, useState, useEffect } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { useShareableURL } from '../hooks/useShareableURL';
import { POLLUTANT_TYPES, GRID_SIZE } from '../types';
import { Play, Pause, RotateCcw, Wind, Waves, Droplets, Plus, Trash2, Download, Upload, FileJson, Square, CheckCircle, AlertCircle, X, Info, Keyboard, Share2 } from 'lucide-react';

export const ControlPanel: React.FC = () => {
  const { isRunning, parameters, sources, gpuEnabled, scientistMode, isDrawingObstacles, actions } = useSimulationStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedConfig, setImportedConfig] = useState<any>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  const { generateShareURL } = useShareableURL();

  useEffect(() => {
    const handleKeyboardSave = () => setShowExportModal(true);
    const handleShowShortcuts = () => setShowShortcutsHelp(true);

    window.addEventListener('keyboard-save', handleKeyboardSave);
    window.addEventListener('show-shortcuts-help', handleShowShortcuts);

    return () => {
      window.removeEventListener('keyboard-save', handleKeyboardSave);
      window.removeEventListener('show-shortcuts-help', handleShowShortcuts);
    };
  }, []);

  const tooltips = {
    windDirection: 'Direction from which wind blows (0°=North, 90°=East, 180°=South, 270°=West). Determines primary dispersion path.',
    windSpeed: 'How fast air moves. Higher speeds spread pollution faster but dilute it more quickly. Range: 0-2 m/s.',
    diffusionRate: 'How quickly pollution spreads from high to low concentration areas. Think of it like dye in water - higher values = faster mixing.',
    releaseRate: 'Amount of pollution emitted per time step. Higher values create more intense pollution clouds.',
    viscosity: 'Fluid "thickness" that resists flow. Higher viscosity = slower, more stable dispersion patterns.',
    decayFactor: 'Natural breakdown rate of pollutants over time. Values closer to 1 = slower decay. Simulates chemical breakdown or settling.',
    pollutantType: 'Different pollutants behave differently: oils float, chemicals sink, thermal pollution rises. Each has unique dispersion physics.',
    simulationSpeed: 'Controls how fast time passes in the simulation. Higher values = faster movement and spread.'
  };

  const handleShare = () => {
    const url = generateShareURL();
    navigator.clipboard.writeText(url).then(() => {
      setShowShareTooltip(true);
      setTimeout(() => setShowShareTooltip(false), 2000);
    });
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  const confirmExport = () => {
    const config = {
      metadata: {
        name: 'Pollution Simulation Configuration',
        description: 'Saved simulation parameters and pollution sources',
        timestamp: new Date().toISOString(),
        version: '1.0'
      },
      parameters,
      sources,
      settings: {
        gpuEnabled,
        scientistMode
      }
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pollution-sim-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);
        if (config.parameters && config.sources) {
          setImportedConfig(config);
          setShowImportModal(true);
        } else {
          alert('Invalid configuration file: Missing required fields');
        }
      } catch (error) {
        console.error('Failed to import configuration:', error);
        alert('Invalid configuration file: Unable to parse JSON');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const confirmImport = () => {
    if (!importedConfig) return;
    
    actions.reset();
    setTimeout(() => {
      actions.updateParameters(importedConfig.parameters);
      actions.removeSource(0);
      importedConfig.sources.forEach((source: any) => actions.addSource(source));
      if (importedConfig.settings) {
        if (importedConfig.settings.gpuEnabled !== gpuEnabled) actions.toggleGPU();
        if (importedConfig.settings.scientistMode !== scientistMode) actions.toggleScientistMode();
      }
      setShowImportModal(false);
      setImportedConfig(null);
    }, 100);
  };

  return (
    <div className="sidebar-content" data-tour="controls-panel">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Controls</h2>
      </div>

      {/* Session Management */}
      <div className="control-section">
        <h3 className="section-title">Session</h3>
        <div className="btn-group">
          <button 
            className="btn btn-secondary ripple scale-hover"
            onClick={handleExport}
            title="Save current configuration (S)"
          >
            <Download style={{ width: '16px', height: '16px' }} />
            Save
          </button>
          <button 
            className="btn btn-secondary ripple scale-hover"
            onClick={() => fileInputRef.current?.click()}
            title="Load configuration"
          >
            <Upload style={{ width: '16px', height: '16px' }} />
            Load
          </button>
          <button 
            className="btn btn-secondary ripple scale-hover"
            onClick={handleShare}
            title="Share simulation URL"
            style={{ position: 'relative' }}
          >
            <Share2 style={{ width: '16px', height: '16px' }} />
            Share
            {showShareTooltip && (
              <span style={{
                position: 'absolute',
                top: '-30px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#10b981',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
              }}>
                Copied!
              </span>
            )}
          </button>
        </div>
        <button 
          className="btn btn-secondary ripple scale-hover"
          onClick={() => setShowShortcutsHelp(true)}
          title="View keyboard shortcuts (?)"
          style={{ width: '100%', marginTop: '8px' }}
        >
          <Keyboard style={{ width: '16px', height: '16px' }} />
          Shortcuts
        </button>
          <input 
            type="file" 
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={handleImport}
          />
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <FileJson size={24} color="#8b5cf6" />
              <h3 style={{ margin: 0, color: 'white', fontSize: '18px' }}>Export Configuration</h3>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>
                <strong style={{ color: 'white' }}>What will be saved:</strong>
              </div>
              <div style={{ display: 'grid', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>{sources.length} Pollution Source{sources.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>Wind: {parameters.windDirection}° at speed {parameters.windSpeed}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>Diffusion Rate: {parameters.diffusionRate}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>Release Rate: {parameters.releaseRate}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>Settings: GPU {gpuEnabled ? 'Enabled' : 'Disabled'}, Scientist Mode {scientistMode ? 'On' : 'Off'}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowExportModal(false)}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={confirmExport}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} />
                Download JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && importedConfig && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Upload size={24} color="#8b5cf6" />
              <h3 style={{ margin: 0, color: 'white', fontSize: '18px' }}>Import Configuration</h3>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>
                <strong style={{ color: 'white' }}>Configuration Preview:</strong>
              </div>
              <div style={{ display: 'grid', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                {importedConfig.metadata && (
                  <>
                    <div style={{ color: '#8b5cf6', fontWeight: 600, marginBottom: '4px' }}>
                      {importedConfig.metadata.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                      Saved: {new Date(importedConfig.metadata.timestamp).toLocaleString()}
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>{importedConfig.sources?.length || 0} Pollution Source{importedConfig.sources?.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>Wind: {importedConfig.parameters?.windDirection}° at speed {importedConfig.parameters?.windSpeed}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>Diffusion: {importedConfig.parameters?.diffusionRate}, Release: {importedConfig.parameters?.releaseRate}</span>
                </div>
              </div>
            </div>
            <div style={{ 
              background: 'rgba(251, 191, 36, 0.1)', 
              border: '1px solid rgba(251, 191, 36, 0.3)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start'
            }}>
              <AlertCircle size={16} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)' }}>
                This will replace your current simulation settings. Make sure to save your current configuration if needed.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => { setShowImportModal(false); setImportedConfig(null); }}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={confirmImport}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle size={14} />
                Apply Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Keyboard size={24} color="#8b5cf6" />
                <h3 style={{ margin: 0, color: 'white', fontSize: '18px' }}>Keyboard Shortcuts</h3>
              </div>
              <button 
                onClick={() => setShowShortcutsHelp(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                { key: 'Space', action: 'Play / Pause simulation' },
                { key: 'R', action: 'Reset simulation' },
                { key: 'S', action: 'Save configuration' },
                { key: 'G', action: 'Toggle GPU acceleration' },
                { key: 'V', action: 'Toggle Scientist Mode (vectors)' },
                { key: 'D', action: 'Toggle Draw Obstacles mode' },
                { key: 'W', action: 'Toggle Dynamic Weather' },
                { key: '?', action: 'Show this help' }
              ].map((shortcut, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.9)' }}>{shortcut.action}</span>
                  <kbd style={{
                    padding: '4px 8px',
                    background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    borderRadius: '4px',
                    color: '#8b5cf6',
                    fontWeight: 600,
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}>
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.8)'
            }}>
              <strong style={{ color: '#60a5fa' }}>Tip:</strong> Keyboard shortcuts work when not typing in input fields. Press <kbd style={{
                padding: '2px 6px',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                borderRadius: '4px',
                color: '#8b5cf6',
                fontFamily: 'monospace',
                fontSize: '11px'
              }}>?</kbd> anytime to see this help.
            </div>

            <button 
              className="btn btn-primary"
              onClick={() => setShowShortcutsHelp(false)}
              style={{ width: '100%', marginTop: '16px', padding: '10px' }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Performance Section */}
      <div className="control-section" data-tour="settings-section">
        <h3 className="section-title">Settings</h3>
        
        {/* GPU Toggle */}
        <div className="toggle-container" style={{ marginBottom: '12px' }}>
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

        {/* Scientist Mode Toggle */}
        <div className="toggle-container" style={{ marginBottom: '12px' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Scientist Mode</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Show grid & vectors
            </div>
          </div>
          <div className={`toggle-switch ${useSimulationStore(state => state.scientistMode) ? 'active' : ''}`} onClick={actions.toggleScientistMode}>
            <div className="toggle-thumb"></div>
          </div>
        </div>

        {/* Draw Obstacles Toggle */}
        <div className="toggle-container">
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Draw Obstacles</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Click on canvas to place walls
            </div>
          </div>
          <div className={`toggle-switch ${isDrawingObstacles ? 'active' : ''}`} onClick={actions.toggleDrawingObstacles}>
            <div className="toggle-thumb"></div>
          </div>
        </div>

        {/* Dynamic Weather Toggle */}
        <div className="toggle-container">
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Dynamic Weather</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Vary wind speed & direction
            </div>
          </div>
          <div className={`toggle-switch ${useSimulationStore(state => state.dynamicWeather) ? 'active' : ''}`} onClick={actions.toggleDynamicWeather}>
            <div className="toggle-thumb"></div>
          </div>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="control-section">
        <h3 className="section-title">Simulation</h3>

        <div className="btn-group">
          <button
            className={`btn ${isRunning ? 'btn-success' : 'btn-primary'} ripple scale-hover`}
            onClick={actions.start}
            disabled={isRunning}
            style={isRunning ? { opacity: 0.6 } : {}}
          >
            <Play style={{ width: '16px', height: '16px' }} />
            {isRunning ? 'Running...' : 'Start'}
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

        {/* Simulation Speed */}
        <div className="control-group">
          <label className="control-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Simulation Speed: {parameters.simulationSpeed?.toFixed(1)}x</span>
            <button
              onClick={() => setActiveTooltip(activeTooltip === 'simulationSpeed' ? null : 'simulationSpeed')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
              title="Learn more"
            >
              <Info size={14} color="#8b5cf6" />
            </button>
          </label>
          {activeTooltip === 'simulationSpeed' && (
            <div style={{
              fontSize: '11px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '6px',
              padding: '8px',
              marginBottom: '8px',
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.4
            }}>
              {tooltips.simulationSpeed}
            </div>
          )}
          <div className="range-container">
            <input
              type="range"
              className="range-input"
              min="0.1"
              max="5.0"
              step="0.1"
              value={parameters.simulationSpeed || 1.0}
              onChange={(e) => actions.updateParameters({ simulationSpeed: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Pollution Type */}
        <div className="control-group">
          <label className="control-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Pollution Type</span>
            <button
              onClick={() => setActiveTooltip(activeTooltip === 'pollutantType' ? null : 'pollutantType')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
              title="Learn more"
            >
              <Info size={14} color="#8b5cf6" />
            </button>
          </label>
          {activeTooltip === 'pollutantType' && (
            <div style={{
              fontSize: '11px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '6px',
              padding: '8px',
              marginBottom: '8px',
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.4
            }}>
              {tooltips.pollutantType}
            </div>
          )}
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
          <label className="control-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <Wind style={{ width: '14px', height: '14px', marginRight: '4px' }} />
              Wind Direction
            </div>
            <button
              onClick={() => setActiveTooltip(activeTooltip === 'windDirection' ? null : 'windDirection')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
              title="Learn more"
            >
              <Info size={14} color="#8b5cf6" />
            </button>
            <span className="control-value">{parameters.windDirection}°</span>
          </label>
          {activeTooltip === 'windDirection' && (
            <div style={{
              fontSize: '11px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '6px',
              padding: '8px',
              marginBottom: '8px',
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.4
            }}>
              {tooltips.windDirection}
            </div>
          )}
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
          <label className="control-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <Wind style={{ width: '14px', height: '14px', marginRight: '4px' }} />
              Wind Speed
            </div>
            <button
              onClick={() => setActiveTooltip(activeTooltip === 'windSpeed' ? null : 'windSpeed')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
              title="Learn more"
            >
              <Info size={14} color="#8b5cf6" />
            </button>
            <span className="control-value">{parameters.windSpeed}</span>
          </label>
          {activeTooltip === 'windSpeed' && (
            <div style={{
              fontSize: '11px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '6px',
              padding: '8px',
              marginBottom: '8px',
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.4
            }}>
              {tooltips.windSpeed}
            </div>
          )}
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
          <label className="control-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <Waves style={{ width: '14px', height: '14px', marginRight: '4px' }} />
              Diffusion Rate
            </div>
            <button
              onClick={() => setActiveTooltip(activeTooltip === 'diffusionRate' ? null : 'diffusionRate')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
              title="Learn more"
            >
              <Info size={14} color="#8b5cf6" />
            </button>
            <span className="control-value">{parameters.diffusionRate}</span>
          </label>
          {activeTooltip === 'diffusionRate' && (
            <div style={{
              fontSize: '11px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '6px',
              padding: '8px',
              marginBottom: '8px',
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.4
            }}>
              {tooltips.diffusionRate}
            </div>
          )}
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
          <label className="control-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <Droplets style={{ width: '14px', height: '14px', marginRight: '4px' }} />
              Release Rate
            </div>
            <button
              onClick={() => setActiveTooltip(activeTooltip === 'releaseRate' ? null : 'releaseRate')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
              title="Learn more"
            >
              <Info size={14} color="#8b5cf6" />
            </button>
            <span className="control-value">{parameters.releaseRate}</span>
          </label>
          {activeTooltip === 'releaseRate' && (
            <div style={{
              fontSize: '11px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '6px',
              padding: '8px',
              marginBottom: '8px',
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.4
            }}>
              {tooltips.releaseRate}
            </div>
          )}
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