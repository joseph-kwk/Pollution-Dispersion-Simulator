import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { POLLUTANT_TYPES } from '../types';
import { FileText, Download, CheckCircle, X, BarChart3, FileSpreadsheet } from 'lucide-react';

export const PollutionInsights: React.FC = () => {
  const { sources, grid, parameters } = useSimulationStore();
  const [aqiHistory, setAqiHistory] = useState<number[]>(new Array(60).fill(0));
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'health' | 'visual' | 'realworld'>('health');

  const TabButton = ({ active, onClick, icon, label }: any) => (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '6px',
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent',
        color: active ? 'white' : 'rgba(255,255,255,0.5)',
        cursor: 'pointer',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        transition: 'all 0.2s'
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );


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
      CO2: {
        cleanState: 'Fresh Air (400ppm)',
        pollutedState: 'High C02 (>1000ppm)',
        healthImpact: 'Dizziness, headache, shortness of breath, asphyxiation in confined spaces.',
        visualCue: 'Invisible gas (displayed as grey mist)',
        realWorld: 'Poorly ventilated rooms, industrial exhaust.'
      },
      PM25: {
        cleanState: 'Clear Sky',
        pollutedState: 'Haze / Smog',
        healthImpact: 'Penetrates deep lungs, heart disease risk, asthma attacks.',
        visualCue: 'Purple/Hazy clouds reducing visibility',
        realWorld: 'Wildfire smoke, vehicle exhaust, dust storms.'
      },
      NO2: {
        cleanState: 'Clean Air',
        pollutedState: 'Brown Smog',
        healthImpact: 'Inflames lining of lungs, reduces immunity to lung infections.',
        visualCue: 'Reddish-brown layer over cities',
        realWorld: 'Traffic congestion, power plants.'
      },
      SO2: {
        cleanState: 'Clean Air',
        pollutedState: 'Acidic Gas',
        healthImpact: 'Throat irritation, bronchoconstriction, aggravates heart disease.',
        visualCue: 'Colorless but forms yellow haze',
        realWorld: 'Coal burning, volcanic eruptions.'
      },
      RADON: {
        cleanState: 'Safe Baseline',
        pollutedState: 'Radioactive Accumulation',
        healthImpact: '#1 cause of lung cancer among non-smokers. Silent killer.',
        visualCue: 'Invisible (displayed as red warning zones)',
        realWorld: 'Seeping from ground into basements.'
      }
    }[type];
  };

  const currentPollutant = sources[0]?.type || 'CO2';
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
        <h3 className="insights-title">Pollution Insights</h3>
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

      {/* Main AQI Status */}
      <div className="aqi-display" style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="aqi-label" style={{ fontSize: '11px', color: '#94a3b8' }}>CURRENT AQI</div>
          <div className="status-indicator" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: aqiCategory.color, boxShadow: `0 0 8px ${aqiCategory.color}` }}></div>
            <span style={{ fontSize: '11px', color: aqiCategory.color, fontWeight: 600 }}>Live Monitoring</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <div className="aqi-value" style={{ fontSize: '36px', fontWeight: 800, color: aqiCategory.color, lineHeight: 1 }}>
            {aqi}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>{aqiCategory.level}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{aqiCategory.icon} Impact Warning</div>
          </div>
        </div>
      </div>

      {/* Atmosphere & Compliance Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>ATMOSPHERE</div>
          <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>
            {parameters.diffusionRate < 0.1 ? 'Stagnant' : parameters.diffusionRate > 0.3 ? 'Unstable' : 'Neutral'}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>
            {parameters.diffusionRate < 0.1 ? 'Traps Pollutants' : 'Favors Dispersion'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>EPA STATUS</div>
          <div style={{ fontSize: '12px', color: aqi > 100 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
            {aqi > 100 ? 'Non-Compliant' : 'Compliant'}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>
            {aqi > 100 ? 'Exceeds Limits' : 'Within NAAQS'}
          </div>
        </div>
      </div>

      {/* Tabs: Analysis Details */}
      <div className="analysis-card" style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', overflow: 'hidden', marginBottom: '12px' }}>
        <div style={{ borderBottom: '1px solid #1e293b', padding: '8px 12px', background: '#1e293b' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>{POLLUTANT_TYPES[currentPollutant].name} Analysis</span>
        </div>

        <div className="description-tabs">
          <div style={{ display: 'flex', background: '#0f172a' }}>
            <TabButton active={activeTab === 'health'} onClick={() => setActiveTab('health')} icon="⚕️" label="Health" />
            <TabButton active={activeTab === 'visual'} onClick={() => setActiveTab('visual')} icon="👁️" label="Visuals" />
            <TabButton active={activeTab === 'realworld'} onClick={() => setActiveTab('realworld')} icon="🌍" label="Context" />
          </div>

          <div style={{ padding: '12px', fontSize: '13px', lineHeight: '1.5', color: '#cbd5e1', minHeight: '80px', borderTop: '1px solid #1e293b' }}>
            {activeTab === 'health' && (
              <>
                <div style={{ fontWeight: 600, color: '#f87171', marginBottom: '4px' }}>Health Impact:</div>
                {description.healthImpact}
              </>
            )}
            {activeTab === 'visual' && (
              <>
                <div style={{ fontWeight: 600, color: '#60a5fa', marginBottom: '4px' }}>Visual Identification:</div>
                {description.visualCue}
              </>
            )}
            {activeTab === 'realworld' && (
              <>
                <div style={{ fontWeight: 600, color: '#a78bfa', marginBottom: '4px' }}>Real-World Examples:</div>
                {description.realWorld}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Safety Advisory Summary */}
      <div style={{
        padding: '10px',
        background: `rgba(${parseInt(aqiCategory.color.slice(1, 3), 16)}, ${parseInt(aqiCategory.color.slice(3, 5), 16)}, ${parseInt(aqiCategory.color.slice(5, 7), 16)}, 0.1)`,
        borderLeft: `3px solid ${aqiCategory.color}`,
        borderRadius: '4px',
        marginBottom: '1rem'
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: aqiCategory.color, marginBottom: '4px', textTransform: 'uppercase' }}>Safety Advisory</div>
        <div style={{ fontSize: '12px', color: '#e2e8f0' }}>{getRecommendations(aqi)[0]}</div>
      </div>

      {/* Color Legend */}
      <div className="color-legend-compact">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
          <span>Safe (0)</span>
          <span>Moderate (100)</span>
          <span>Hazardous (300+)</span>
        </div>
        <div style={{
          height: '6px',
          borderRadius: '3px',
          background: 'linear-gradient(to right, #10b981, #f59e0b, #ef4444, #7f1d1d)',
          width: '100%'
        }} />
      </div>

      {/* Report Download Modal */}
      {
        showReportModal && (
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
        )
      }
    </div >
  );
};
