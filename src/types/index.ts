// Simulation types
export interface Vector2D {
  x: number;
  y: number;
}

export interface SimulationParameters {
  windDirection: number;
  windSpeed: number;
  diffusionRate: number;
  releaseRate: number;
  viscosity: number;
  decayFactor: number;
  simulationSpeed: number;
}

export interface PollutantType {
  id: string;
  name: string;
  description: string;
  baseColor: { r: number; g: number; b: number };
  diffusionModifier: number;
  behavior: {
    sinkRate: number;
    reactivity: number;
    viscosity: number;
    tempGradient?: number;
    organicGrowth?: number;
  };
  effects: string[];
}

export interface PollutionSource {
  x: number;
  y: number;
  type: keyof typeof POLLUTANT_TYPES;
  active: boolean;
  releaseRate?: number; // Individual release rate (0.0 to 1.0)
}

export interface SimulationState {
  isRunning: boolean;
  grid: number[][];
  obstacles: boolean[][];
  sources: PollutionSource[];
  parameters: SimulationParameters;
  fps: number;
  gpuEnabled: boolean;
  scientistMode: boolean;
  isDrawingObstacles: boolean;
  dynamicWeather: boolean;
  resetTrigger: number;
}

// UI types
export interface ControlGroup {
  id: string;
  label: string;
  type: 'slider' | 'select' | 'toggle' | 'button';
  value: any;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: any; label: string }[];
  tooltip?: string;
}

// Store types
// Store types
export interface SimulationStore extends SimulationState {
  actions: {
    start: () => void;
    pause: () => void;
    reset: () => void;
    updateParameters: (params: Partial<SimulationParameters>) => void;
    addSource: (source: Omit<PollutionSource, 'active'>) => void;
    setSources: (sources: PollutionSource[]) => void;
    removeSource: (index: number) => void;
    toggleGPU: () => void;
    toggleScientistMode: () => void;
    toggleDrawingObstacles: () => void;
    toggleDynamicWeather: () => void;
    setGrid: (grid: number[][]) => void;
    setObstacles: (obstacles: boolean[][]) => void;
    addObstacle: (x: number, y: number) => void;
    removeObstacle: (x: number, y: number) => void;
    setFPS: (fps: number) => void;
  };
}

// Constants
export const GRID_SIZE = 80;
export const POLLUTANT_TYPES = {
  CO2: {
    id: 'co2',
    name: 'Carbon Dioxide (CO2)',
    description: 'Greenhouse gas. Heavier than air, accumulates in low-lying areas. Invisible but dangerous in high concentrations.',
    baseColor: { r: 100, g: 116, b: 139 }, // Slate grey (invisible in reality, visualized as grey)
    diffusionModifier: 1.0,
    behavior: {
      sinkRate: 0.15, // Sinks (Heavy gas)
      reactivity: 0.0,
      viscosity: 0.9,
    },
    effects: ['asphyxiation', 'acidification']
  },
  PM25: {
    id: 'pm25',
    name: 'PM2.5 (Particulate Matter)',
    description: 'Fine particles <2.5µm. Penetrates deep into lungs. Found in smoke, haze, and vehicle exhaust.',
    baseColor: { r: 168, g: 85, b: 247 }, // Purple for high danger/haze
    diffusionModifier: 0.6, // Suspended longer
    behavior: {
      sinkRate: 0.02, // Lofts/Suspends
      reactivity: 0.1,
      viscosity: 1.1,
    },
    effects: ['respiratory', 'cardiovascular']
  },
  NO2: {
    id: 'no2',
    name: 'Nitrogen Dioxide (NO2)',
    description: 'Reddish-brown gas involved in smog formation. Emitted by combustion engines and power plants.',
    baseColor: { r: 180, g: 83, b: 9 }, // Brown/Amber
    diffusionModifier: 1.1,
    behavior: {
      sinkRate: 0.05, // Slightly heavier than air
      reactivity: 0.8, // Highly reactive (Ozone precursor)
      viscosity: 1.0,
    },
    effects: ['lungIrritation', 'smog']
  },
  SO2: {
    id: 'so2',
    name: 'Sulfur Dioxide (SO2)',
    description: 'Colorless, pungent gas from burning fossil fuels. Precursor to acid rain and particulate formation.',
    baseColor: { r: 234, g: 179, b: 8 }, // Yellowish (sulfur association)
    diffusionModifier: 1.2,
    behavior: {
      sinkRate: 0.08,
      reactivity: 0.6,
      viscosity: 1.0,
    },
    effects: ['acidRain', 'respiratory']
  },
  RADON: {
    id: 'radon',
    name: 'Radon Gas',
    description: 'Radioactive, colorless, odorless. Heaviest gas, accumulates significantly in basements/low spots.',
    baseColor: { r: 255, g: 100, b: 100 }, // Warning Red (Radioactive)
    diffusionModifier: 0.4, // Slow diffusion
    behavior: {
      sinkRate: 0.4, // Very heavy
      reactivity: 0.01,
      viscosity: 1.5,
    },
    effects: ['cancer', 'radiation']
  }
} as const;