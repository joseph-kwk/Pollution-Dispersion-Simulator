import React from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { POLLUTANT_TYPES } from '../types';
import { FileText } from 'lucide-react';

export const PollutionInsights: React.FC = () => {
  const { sources, grid, parameters } = useSimulationStore();

  // Calculate total pollution
  const totalPollution = grid.reduce((sum, row) => 
    sum + row.reduce((rowSum, cell) => rowSum + cell, 0), 0
  );

  // Calculate air quality index (0-500)
  const aqi = Math.min(500, Math.floor((totalPollution / (grid.length * grid[0].length)) * 2));

  const getAQICategory = () => {
    if (aqi <= 50) return { level: 'Good', color: '#10b981', icon: '😊' };
    if (aqi <= 100) return { level: 'Moderate', color: '#f59e0b', icon: '😐' };
    if (aqi <= 150) return { level: 'Unhealthy for Sensitive Groups', color: '#f97316', icon: '😷' };
    if (aqi <= 200) return { level: 'Unhealthy', color: '#ef4444', icon: '😨' };
    if (aqi <= 300) return { level: 'Very Unhealthy', color: '#991b1b', icon: '☠️' };
    return { level: 'Hazardous', color: '#7f1d1d', icon: '💀' };
  };

  const aqiCategory = getAQICategory();

  const getPollutantDescription = (type: keyof typeof POLLUTANT_TYPES) => {
    return {
      CHEMICAL: {
        cleanState: 'Pure Air',
        pollutedState: 'Toxic Fumes',
        healthImpact: 'Can cause respiratory issues, nausea, and long-term organ damage',
        visualCue: 'Dark red clouds indicate high toxicity',
        realWorld: 'Like industrial emissions or chemical spills'
      },
      OIL: {
        cleanState: 'Clear Water',
        pollutedState: 'Oil Slick',
        healthImpact: 'Kills marine life, contaminates water supplies',
        visualCue: 'Dark patches floating on surface',
        realWorld: 'Like oil tanker spills or pipeline leaks'
      },
      SEWAGE: {
        cleanState: 'Fresh Water',
        pollutedState: 'Contaminated Water',
        healthImpact: 'Spreads diseases, causes algae blooms',
        visualCue: 'Brown clouds with organic growth',
        realWorld: 'Like sewage overflow or agricultural runoff'
      },
      THERMAL: {
        cleanState: 'Normal Temperature',
        pollutedState: 'Heat Pollution',
        healthImpact: 'Reduces oxygen in water, kills temperature-sensitive species',
        visualCue: 'Orange glow showing heat spread',
        realWorld: 'Like power plant cooling water discharge'
      }
    }[type];
  };

  const currentPollutant = sources[0]?.type || 'CHEMICAL';
  const description = getPollutantDescription(currentPollutant);

  const handleDownloadReport = () => {
    const report = {
      timestamp: new Date().toLocaleString(),
      simulationStatus: {
        aqi: aqi,
        category: aqiCategory.level,
        pollutantType: POLLUTANT_TYPES[currentPollutant].name,
        sourceCount: sources.length
      },
      parameters: parameters,
      healthImpact: description.healthImpact
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pollution-report-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pollution-insights">
      <div className="insights-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="insights-title">Environmental Impact</h3>
        <button 
          className="btn btn-sm btn-secondary"
          onClick={handleDownloadReport}
          title="Download Report"
          style={{ padding: '4px 8px' }}
        >
          <FileText style={{ width: '14px', height: '14px', marginRight: '4px' }} />
          Report
        </button>
      </div>

      {/* Air Quality Index */}
      <div className="aqi-display">
        <div className="aqi-label">Air Quality Index</div>
        <div className="aqi-value" style={{ color: aqiCategory.color }}>
          <span className="aqi-number">{aqi}</span>
          <span className="aqi-icon">{aqiCategory.icon}</span>
        </div>
        <div className="aqi-category" style={{ color: aqiCategory.color }}>
          {aqiCategory.level}
        </div>
        <div className="aqi-bar">
          <div 
            className="aqi-fill" 
            style={{ 
              width: `${Math.min(100, (aqi / 500) * 100)}%`,
              backgroundColor: aqiCategory.color 
            }}
          />
        </div>
      </div>

      {/* Pollution Type Insights */}
      <div className="pollutant-insights">
        <h4 className="pollutant-name">{POLLUTANT_TYPES[currentPollutant].name}</h4>
        <div className="insight-grid">
          <div className="insight-item">
            <div className="insight-label">Clean State</div>
            <div className="insight-value clean">{description.cleanState}</div>
          </div>
          <div className="insight-item">
            <div className="insight-label">Polluted State</div>
            <div className="insight-value polluted">{description.pollutedState}</div>
          </div>
        </div>

        <div className="insight-description">
          <div className="description-section">
            <div className="section-icon">⚕️</div>
            <div className="section-content">
              <div className="section-label">Health Impact</div>
              <div className="section-text">{description.healthImpact}</div>
            </div>
          </div>

          <div className="description-section">
            <div className="section-icon">👁️</div>
            <div className="section-content">
              <div className="section-label">What You See</div>
              <div className="section-text">{description.visualCue}</div>
            </div>
          </div>

          <div className="description-section">
            <div className="section-icon">🌍</div>
            <div className="section-content">
              <div className="section-label">Real-World Example</div>
              <div className="section-text">{description.realWorld}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Color Legend */}
      <div className="color-legend">
        <div className="legend-title">Color Guide</div>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'linear-gradient(to right, #7dd3fc, #3b82f6)' }}></div>
            <span>Clean (Safe to breathe)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'linear-gradient(to right, #a78bfa, #8b5cf6)' }}></div>
            <span>Moderate (Slight concern)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'linear-gradient(to right, #fb923c, #f97316)' }}></div>
            <span>Unhealthy (Avoid exposure)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'linear-gradient(to right, #f87171, #dc2626)' }}></div>
            <span>Hazardous (Dangerous)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
