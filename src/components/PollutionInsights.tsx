import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { POLLUTANT_TYPES } from '../types';
import { FileText, Download, CheckCircle, X, BarChart3, FileSpreadsheet } from 'lucide-react';

export const PollutionInsights: React.FC = () => {
  const { sources, grid, parameters } = useSimulationStore();
  const [aqiHistory, setAqiHistory] = useState<number[]>(new Array(60).fill(0));
  const [showReportModal, setShowReportModal] = useState(false);



  const maxPollution = grid.reduce((max, row) =>
    Math.max(max, ...row), 0
  );

  // Calculate air quality index (0-500) based on peak pollution
  // Multiplier of 5 ensures that release rates of ~50 result in "Very Unhealthy" to "Hazardous" levels
  const aqi = Math.min(500, Math.floor(maxPollution * 5));

  useEffect(() => {
    const interval = setInterval(() => {
      setAqiHistory(prev => [...prev.slice(1), aqi]);
    }, 1000);
    return () => clearInterval(interval);
  }, [aqi]);

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
    setShowReportModal(true);
  };

  const confirmDownloadReport = () => {
    const avgAQI = Math.floor(aqiHistory.reduce((a, b) => a + b, 0) / aqiHistory.length);
    const maxAQI = Math.max(...aqiHistory);
    const minAQI = Math.min(...aqiHistory.filter(v => v > 0));

    const report = {
      metadata: {
        title: 'Environmental Impact Report',
        generatedAt: new Date().toLocaleString(),
        reportType: 'Pollution Dispersion Analysis'
      },
      summary: {
        currentAQI: aqi,
        averageAQI: avgAQI,
        peakAQI: maxAQI,
        minimumAQI: minAQI,
        category: aqiCategory.level,
        pollutantType: POLLUTANT_TYPES[currentPollutant].name,
        sourceCount: sources.length,
        samplingPeriod: '60 seconds'
      },
      environmentalParameters: {
        windDirection: `${parameters.windDirection}°`,
        windSpeed: parameters.windSpeed,
        diffusionRate: parameters.diffusionRate,
        releaseRate: parameters.releaseRate,
        viscosity: parameters.viscosity,
        decayFactor: parameters.decayFactor
      },
      pollutionSources: sources.map((s, idx) => ({
        id: idx + 1,
        type: POLLUTANT_TYPES[s.type].name,
        position: { x: s.x, y: s.y },
        description: POLLUTANT_TYPES[s.type].description
      })),
      healthImpact: {
        description: description.healthImpact,
        visualIndicators: description.visualCue,
        realWorldComparison: description.realWorld
      },
      aqiTrendData: aqiHistory.map((value, idx) => ({
        second: idx + 1,
        aqi: value
      })),
      recommendations: getRecommendations(aqi)
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pollution-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowReportModal(false);
  };

  const downloadCSV = () => {
    const avgAQI = Math.floor(aqiHistory.reduce((a, b) => a + b, 0) / aqiHistory.length);
    const maxAQI = Math.max(...aqiHistory);
    const minAQI = Math.min(...aqiHistory.filter(v => v > 0));

    // Build CSV content
    let csv = 'Environmental Impact Report - CSV Export\n';
    csv += `Generated,${new Date().toLocaleString()}\n\n`;

    csv += 'SUMMARY STATISTICS\n';
    csv += 'Metric,Value\n';
    csv += `Current AQI,${aqi}\n`;
    csv += `Average AQI,${avgAQI}\n`;
    csv += `Peak AQI,${maxAQI}\n`;
    csv += `Minimum AQI,${minAQI}\n`;
    csv += `Category,${aqiCategory.level}\n`;
    csv += `Pollutant Type,${POLLUTANT_TYPES[currentPollutant].name}\n`;
    csv += `Number of Sources,${sources.length}\n\n`;

    csv += 'ENVIRONMENTAL PARAMETERS\n';
    csv += 'Parameter,Value\n';
    csv += `Wind Direction,${parameters.windDirection}°\n`;
    csv += `Wind Speed,${parameters.windSpeed}\n`;
    csv += `Diffusion Rate,${parameters.diffusionRate}\n`;
    csv += `Release Rate,${parameters.releaseRate}\n`;
    csv += `Viscosity,${parameters.viscosity}\n`;
    csv += `Decay Factor,${parameters.decayFactor}\n\n`;

    csv += 'AQI TREND DATA (60 seconds)\n';
    csv += 'Second,AQI Value\n';
    aqiHistory.forEach((value, idx) => {
      csv += `${idx + 1},${value}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pollution-data-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowReportModal(false);
  };

  const getRecommendations = (aqiValue: number): string[] => {
    if (aqiValue <= 50) return ['Air quality is satisfactory', 'Outdoor activities are safe', 'No precautions needed'];
    if (aqiValue <= 100) return ['Acceptable air quality', 'Unusually sensitive people should limit prolonged outdoor exertion', 'General public can enjoy normal activities'];
    if (aqiValue <= 150) return ['Sensitive groups should reduce prolonged outdoor exertion', 'General public should limit outdoor activities', 'Use air purifiers indoors'];
    if (aqiValue <= 200) return ['Everyone should avoid prolonged outdoor exertion', 'Sensitive groups should remain indoors', 'Close windows and use air filtration'];
    if (aqiValue <= 300) return ['Everyone should avoid all outdoor physical activities', 'Stay indoors with air purifiers', 'Seek medical attention if experiencing symptoms'];
    return ['Health emergency conditions', 'Entire population is affected', 'Evacuate area if possible', 'Emergency medical assistance may be required'];
  };

  return (
    <div className="pollution-insights" data-tour="pollution-insights">
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

      {/* Real-Time Graph */}
      <div className="aqi-chart-container" style={{ marginBottom: '1rem', background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '8px' }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
          <span>LIVE AQI TREND (60s)</span>
          <span style={{ color: aqiCategory.color }}>● Live</span>
        </div>
        <svg viewBox="0 0 300 60" style={{ width: '100%', height: '60px', overflow: 'visible' }}>
          {/* Grid lines */}
          <line x1="0" y1="0" x2="300" y2="0" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1="0" y1="30" x2="300" y2="30" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

          {/* Area Path */}
          <path
            d={`M 0 60 ${aqiHistory.map((val, i) => `L ${(i / 59) * 300} ${60 - (val / 500) * 60}`).join(' ')} L 300 60 Z`}
            fill={aqiCategory.color}
            fillOpacity="0.2"
          />

          {/* Line Path */}
          <path
            d={`M 0 ${60 - (aqiHistory[0] / 500) * 60} ${aqiHistory.map((val, i) => `L ${(i / 59) * 300} ${60 - (val / 500) * 60}`).join(' ')}`}
            fill="none"
            stroke={aqiCategory.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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

      {/* Report Download Modal */}
      {showReportModal && (
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
            maxWidth: '600px',
            width: '90%',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BarChart3 size={24} color="#8b5cf6" />
                <h3 style={{ margin: 0, color: 'white', fontSize: '18px' }}>Download Environmental Report</h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>
                <strong style={{ color: 'white' }}>Report Contents:</strong>
              </div>
              <div style={{ display: 'grid', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>Current AQI: {aqi} ({aqiCategory.level})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>60-second trend data with {aqiHistory.filter(v => v > 0).length} data points</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>Environmental parameters (wind, diffusion, release rates)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>{sources.length} pollution source{sources.length !== 1 ? 's' : ''} with detailed info</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span>Health impact assessment and recommendations</span>
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                <strong style={{ color: '#60a5fa' }}>Quick Stats:</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Average AQI</div>
                  <div style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>
                    {Math.floor(aqiHistory.reduce((a, b) => a + b, 0) / aqiHistory.length)}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Peak AQI</div>
                  <div style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>
                    {Math.max(...aqiHistory)}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Pollutant</div>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
                    {POLLUTANT_TYPES[currentPollutant].name}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Data Period</div>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
                    60 seconds
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowReportModal(false)}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-secondary"
                onClick={downloadCSV}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FileSpreadsheet size={14} />
                Export CSV
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmDownloadReport}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} />
                Download JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
