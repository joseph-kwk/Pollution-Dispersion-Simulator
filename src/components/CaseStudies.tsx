import React from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { POLLUTANT_TYPES, SimulationParameters } from '../types';

interface CaseStudy {
  id: string;
  title: string;
  description: string;
  severity: 'good' | 'moderate' | 'bad' | 'severe';
  scenario: string;
  parameters: SimulationParameters;
  sourceConfig: {
    x: number;
    y: number;
    type: keyof typeof POLLUTANT_TYPES;
  }[];
  expectedOutcome: string;
  realWorldExample: string;
}

const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'clean-air',
    title: '🌤️ Clean Air - Baseline',
    description: 'Minimal pollution with strong natural dispersion',
    severity: 'good',
    scenario: 'Normal atmospheric conditions with low emissions',
    parameters: {
      windDirection: 45,
      windSpeed: 1.2,
      diffusionRate: 0.25,
      releaseRate: 5,
      viscosity: 0.8,
      decayFactor: 0.98
    },
    sourceConfig: [
      { x: 40, y: 40, type: 'THERMAL' }
    ],
    expectedOutcome: 'Pollution disperses quickly and naturally decays. Air quality remains good.',
    realWorldExample: 'Rural area with light traffic on a windy day'
  },
  {
    id: 'urban-morning',
    title: '🏙️ Urban Morning Rush Hour',
    description: 'Moderate pollution from commuter traffic',
    severity: 'moderate',
    scenario: 'Multiple emission sources with moderate wind conditions',
    parameters: {
      windDirection: 90,
      windSpeed: 0.8,
      diffusionRate: 0.15,
      releaseRate: 15,
      viscosity: 1.0,
      decayFactor: 0.994
    },
    sourceConfig: [
      { x: 30, y: 40, type: 'CHEMICAL' },
      { x: 50, y: 40, type: 'CHEMICAL' }
    ],
    expectedOutcome: 'Pollution accumulates in downwind areas. Air quality degrades to moderate levels.',
    realWorldExample: 'City center during morning commute - Los Angeles, Beijing'
  },
  {
    id: 'industrial-accident',
    title: '🏭 Industrial Chemical Spill',
    description: 'Severe chemical release with poor dispersion',
    severity: 'bad',
    scenario: 'High-intensity chemical emission with low wind',
    parameters: {
      windDirection: 180,
      windSpeed: 0.3,
      diffusionRate: 0.08,
      releaseRate: 35,
      viscosity: 1.5,
      decayFactor: 0.988
    },
    sourceConfig: [
      { x: 40, y: 20, type: 'CHEMICAL' }
    ],
    expectedOutcome: 'Toxic plume spreads slowly, creating hazardous air quality zone.',
    realWorldExample: 'Bhopal gas tragedy (1984), Chemical plant accidents'
  },
  {
    id: 'thermal-pollution',
    title: '🔥 Power Plant Heat Discharge',
    description: 'Thermal pollution from industrial cooling',
    severity: 'moderate',
    scenario: 'Continuous heat release affecting local climate',
    parameters: {
      windDirection: 270,
      windSpeed: 0.6,
      diffusionRate: 0.2,
      releaseRate: 25,
      viscosity: 0.7,
      decayFactor: 0.99
    },
    sourceConfig: [
      { x: 30, y: 40, type: 'THERMAL' }
    ],
    expectedOutcome: 'Heat plume creates localized temperature gradient, affecting air quality.',
    realWorldExample: 'Coastal power plants with cooling water discharge'
  },
  {
    id: 'oil-refinery',
    title: '🛢️ Oil Refinery Operations',
    description: 'Persistent oil-based pollutants',
    severity: 'bad',
    scenario: 'Heavy oil vapor emissions with poor ventilation',
    parameters: {
      windDirection: 135,
      windSpeed: 0.4,
      diffusionRate: 0.1,
      releaseRate: 30,
      viscosity: 2.0,
      decayFactor: 0.985
    },
    sourceConfig: [
      { x: 25, y: 40, type: 'OIL' },
      { x: 55, y: 40, type: 'OIL' }
    ],
    expectedOutcome: 'Thick, persistent pollution cloud with slow decay. Poor air quality.',
    realWorldExample: 'Houston Ship Channel, Middle East refineries'
  },
  {
    id: 'sewage-treatment',
    title: '💧 Sewage Treatment Plant',
    description: 'Organic waste emissions affecting air quality',
    severity: 'moderate',
    scenario: 'Biological treatment facility with odor issues',
    parameters: {
      windDirection: 0,
      windSpeed: 0.9,
      diffusionRate: 0.18,
      releaseRate: 18,
      viscosity: 1.1,
      decayFactor: 0.992
    },
    sourceConfig: [
      { x: 40, y: 60, type: 'SEWAGE' }
    ],
    expectedOutcome: 'Organic pollutants spread downwind, creating odor zones.',
    realWorldExample: 'Urban wastewater treatment facilities'
  },
  {
    id: 'worst-case',
    title: '☠️ Environmental Disaster',
    description: 'Multiple simultaneous pollution sources',
    severity: 'severe',
    scenario: 'Industrial zone with no wind and multiple emissions',
    parameters: {
      windDirection: 0,
      windSpeed: 0.1,
      diffusionRate: 0.05,
      releaseRate: 50,
      viscosity: 2.5,
      decayFactor: 0.98
    },
    sourceConfig: [
      { x: 30, y: 30, type: 'CHEMICAL' },
      { x: 50, y: 30, type: 'OIL' },
      { x: 40, y: 50, type: 'SEWAGE' }
    ],
    expectedOutcome: 'Catastrophic air quality. Pollution stagnates and accumulates to hazardous levels.',
    realWorldExample: 'Delhi during winter inversion, Severe smog episodes'
  }
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'good': return '#10b981';
    case 'moderate': return '#f59e0b';
    case 'bad': return '#ef4444';
    case 'severe': return '#7f1d1d';
    default: return '#6b7280';
  }
};

export const CaseStudies: React.FC = () => {
  const actions = useSimulationStore((state) => state.actions);

  const loadCaseStudy = (caseStudy: CaseStudy) => {
    // Reset first
    actions.reset();
    
    // Clear existing sources
    const currentSources = useSimulationStore.getState().sources;
    currentSources.forEach((_, index) => {
      actions.removeSource(index);
    });

    // Update parameters
    actions.updateParameters(caseStudy.parameters);

    // Add new sources
    caseStudy.sourceConfig.forEach(source => {
      actions.addSource(source);
    });

    // Start simulation
    setTimeout(() => {
      actions.start();
    }, 100);
  };

  return (
    <div className="case-studies-container">
      <div className="case-studies-header">
        <h1>📚 Case Studies & Examples</h1>
        <p className="subtitle">
          Explore real-world pollution scenarios from best to worst case. 
          Click any scenario to load it into the simulator.
        </p>
      </div>

      <div className="severity-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#10b981' }}></span>
          <span>Good</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#f59e0b' }}></span>
          <span>Moderate</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#ef4444' }}></span>
          <span>Bad</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#7f1d1d' }}></span>
          <span>Severe</span>
        </div>
      </div>

      <div className="case-studies-grid">
        {CASE_STUDIES.map((study) => (
          <div 
            key={study.id} 
            className="case-study-card"
            style={{ borderLeftColor: getSeverityColor(study.severity) }}
          >
            <div className="case-study-header">
              <h2>{study.title}</h2>
              <span 
                className="severity-badge"
                style={{ 
                  backgroundColor: getSeverityColor(study.severity),
                  color: study.severity === 'good' || study.severity === 'moderate' ? '#000' : '#fff'
                }}
              >
                {study.severity.toUpperCase()}
              </span>
            </div>

            <p className="case-study-description">{study.description}</p>

            <div className="case-study-details">
              <div className="detail-section">
                <h3>📋 Scenario</h3>
                <p>{study.scenario}</p>
              </div>

              <div className="detail-section">
                <h3>🔬 Parameters</h3>
                <ul>
                  <li>Wind: {study.parameters.windDirection}° @ {study.parameters.windSpeed} m/s</li>
                  <li>Diffusion: {study.parameters.diffusionRate}</li>
                  <li>Release Rate: {study.parameters.releaseRate} units/s</li>
                  <li>Decay: {(study.parameters.decayFactor * 100).toFixed(1)}%</li>
                </ul>
              </div>

              <div className="detail-section">
                <h3>📊 Expected Outcome</h3>
                <p>{study.expectedOutcome}</p>
              </div>

              <div className="detail-section">
                <h3>🌍 Real-World Example</h3>
                <p className="real-world-example">{study.realWorldExample}</p>
              </div>
            </div>

            <button 
              className="load-case-study-btn"
              onClick={() => loadCaseStudy(study)}
            >
              Load Scenario →
            </button>
          </div>
        ))}
      </div>

      <div className="case-studies-footer">
        <p>
          💡 <strong>Tip:</strong> After loading a scenario, you can adjust parameters 
          to see how changes affect pollution dispersion. Try increasing wind speed 
          or diffusion rate to improve air quality.
        </p>
      </div>
    </div>
  );
};
