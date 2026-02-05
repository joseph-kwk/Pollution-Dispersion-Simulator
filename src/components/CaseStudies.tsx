import React, { useState } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { POLLUTANT_TYPES, SimulationParameters } from '../types';
import { useNavigate } from 'react-router-dom';

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
    title: '🌤️ Baseline: Clean Atmosphere',
    description: 'Reference state with minimal background CO2 and optimal dispersion.',
    severity: 'good',
    scenario: 'Rural environment with good wind circulation and no local emissions.',
    parameters: {
      windDirection: 45,
      windSpeed: 1.2,
      diffusionRate: 0.25,
      releaseRate: 5,
      viscosity: 0.8,
      decayFactor: 0.98,
      simulationSpeed: 1.0
    },
    sourceConfig: [
      { x: 40, y: 40, type: 'CO2' }
    ],
    expectedOutcome: 'Pollutants disperse immediately. AQI remains near 0 (Good).',
    realWorldExample: 'remote countryside or oceanic air.'
  },
  {
    id: 'urban-morning',
    title: '🏙️ Scenario: Urban Rush Hour',
    description: 'Traffic-related emissions accumulating during morning commute.',
    severity: 'moderate',
    scenario: 'High-density traffic emitting NO2 and PM2.5 with moderate wind.',
    parameters: {
      windDirection: 90,
      windSpeed: 0.8,
      diffusionRate: 0.15,
      releaseRate: 15,
      viscosity: 1.0,
      decayFactor: 0.994,
      simulationSpeed: 1.0
    },
    sourceConfig: [
      { x: 30, y: 40, type: 'NO2' },
      { x: 50, y: 40, type: 'PM25' }
    ],
    expectedOutcome: 'Brown haze (NO2) forms downwind. AQI rises to Moderate/Unhealthy levels.',
    realWorldExample: 'Los Angeles or London during peak traffic hours.'
  },
  {
    id: 'industrial-accident',
    title: '⚠️ Scenario: Chemical Plant Leak',
    description: 'Acute release of localized toxic gas (SO2).',
    severity: 'bad',
    scenario: 'Sudden valve failure releasing concentrated Sulfur Dioxide in low wind.',
    parameters: {
      windDirection: 180,
      windSpeed: 0.3,
      diffusionRate: 0.08,
      releaseRate: 35,
      viscosity: 1.5,
      decayFactor: 0.988,
      simulationSpeed: 1.0
    },
    sourceConfig: [
      { x: 40, y: 20, type: 'SO2' }
    ],
    expectedOutcome: 'Dense, pungent cloud moves slowly along ground. Hazardous near source.',
    realWorldExample: 'Industrial accidents involving acid gas releases.'
  },
  {
    id: 'radon-accumulation',
    title: '🏠 Scenario: Basement Radon',
    description: 'Invisible radioactive gas accumulating in enclosed, low spaces.',
    severity: 'moderate',
    scenario: 'Ground seepage of Radon with poor ventilation (low diffusion).',
    parameters: {
      windDirection: 0,
      windSpeed: 0.1,
      diffusionRate: 0.05,
      releaseRate: 12,
      viscosity: 0.9,
      decayFactor: 0.995,
      simulationSpeed: 1.0
    },
    sourceConfig: [
      { x: 40, y: 50, type: 'RADON' }
    ],
    expectedOutcome: 'Gas sinks and pools at the bottom (basement effect). Silent health risk.',
    realWorldExample: 'Poorly ventilated basements in radon-prone geological zones.'
  },
  {
    id: 'wildfire-smoke',
    title: '🔥 Scenario: Wildfire Haze',
    description: 'Widespread PM2.5 smoke covering a large area.',
    severity: 'severe',
    scenario: 'Heavy particulate emission drifting from distance (simulated as wide source).',
    parameters: {
      windDirection: 270,
      windSpeed: 1.5,
      diffusionRate: 0.3,
      releaseRate: 40,
      viscosity: 1.2,
      decayFactor: 0.998,
      simulationSpeed: 1.0
    },
    sourceConfig: [
      { x: 20, y: 20, type: 'PM25' },
      { x: 20, y: 40, type: 'PM25' },
      { x: 20, y: 60, type: 'PM25' }
    ],
    expectedOutcome: 'Blanket of purple haze reduces visibility. Hazardous AQI across entire region.',
    realWorldExample: 'California or Australian wildfires affecting downwind cities.'
  },
  {
    id: 'thermal-inversion',
    title: '🌫️ Scenario: Winter Smog (Inversion)',
    description: 'Pollutants trapped by atmospheric inversion layer.',
    severity: 'severe',
    scenario: 'Zero wind and very low diffusion trapping multiple urban pollutants.',
    parameters: {
      windDirection: 0,
      windSpeed: 0.05,
      diffusionRate: 0.02,
      releaseRate: 25,
      viscosity: 1.5,
      decayFactor: 0.999,
      simulationSpeed: 1.0
    },
    sourceConfig: [
      { x: 30, y: 30, type: 'NO2' },
      { x: 50, y: 50, type: 'PM25' },
      { x: 40, y: 40, type: 'SO2' }
    ],
    expectedOutcome: 'Pollution does not disperse. Accumulates rapidly to toxic levels.',
    realWorldExample: 'The Great Smog of London (1952) or modern day Salt Lake City inversions.'
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
  const navigate = useNavigate();
  const [loadingStudy, setLoadingStudy] = useState<string | null>(null);

  const loadCaseStudy = (caseStudy: CaseStudy) => {
    setLoadingStudy(caseStudy.id);

    // Reset first
    actions.reset();

    // Small delay for visual feedback
    setTimeout(() => {
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

      // Navigate to simulator and start
      navigate('/');

      setTimeout(() => {
        actions.start();
        setLoadingStudy(null);
      }, 200);
    }, 300);
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
              disabled={loadingStudy === study.id}
            >
              {loadingStudy === study.id ? '⏳ Loading...' : '▶ Load & Run Scenario'}
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
