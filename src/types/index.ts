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
export interface SimulationStore {
  state: SimulationState;
  actions: {
    start: () => void;
    pause: () => void;
    reset: () => void;
    updateParameters: (params: Partial<SimulationParameters>) => void;
    addSource: (source: Omit<PollutionSource, 'active'>) => void;
    removeSource: (index: number) => void;
    toggleGPU: () => void;
    setGrid: (grid: number[][]) => void;
    setObstacles: (obstacles: boolean[][]) => void;
    setFPS: (fps: number) => void;
  };
}

// Constants
export const GRID_SIZE = 80;
export const POLLUTANT_TYPES = {
  CHEMICAL: {
    id: 'chemical',
    name: 'Chemical Pollution',
    description: 'Industrial chemical waste, highly toxic and slow to disperse',
    baseColor: { r: 139, g: 0, b: 0 },
    diffusionModifier: 0.8,
    behavior: {
      sinkRate: 0.2,
      reactivity: 0.1,
      viscosity: 1.2
    },
    effects: ['toxicity', 'waterQuality']
  },
  OIL: {
    id: 'oil',
    name: 'Oil Spill',
    description: 'Oil-based pollutants, forms a thick layer on water surface',
    baseColor: { r: 47, g: 79, b: 79 },
    diffusionModifier: 0.6,
    behavior: {
      sinkRate: -0.3,
      reactivity: 0.05,
      viscosity: 2.0
    },
    effects: ['surfaceSpread', 'waterQuality']
  },
  SEWAGE: {
    id: 'sewage',
    name: 'Organic Waste',
    description: 'Sewage and organic pollutants, affects water quality and promotes algae growth',
    baseColor: { r: 101, g: 67, b: 33 },
    diffusionModifier: 1.2,
    behavior: {
      sinkRate: 0.1,
      reactivity: 0.3,
      viscosity: 1.1,
      organicGrowth: 0.2
    },
    effects: ['organicContent', 'waterQuality', 'algaeGrowth']
  },
  THERMAL: {
    id: 'thermal',
    name: 'Thermal Pollution',
    description: 'Heat discharge raising water temperature, affecting oxygen levels',
    baseColor: { r: 255, g: 140, b: 0 },
    diffusionModifier: 1.5,
    behavior: {
      sinkRate: -0.1,
      reactivity: 0.4,
      viscosity: 0.8,
      tempGradient: 0.3
    },
    effects: ['temperature', 'oxygenLevel', 'waterQuality']
  }
} as const;