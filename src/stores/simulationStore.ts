import { create } from 'zustand';
import { SimulationState, SimulationParameters, PollutionSource, GRID_SIZE, SimulationStore } from '../types';

const initialParameters: SimulationParameters = {
  windDirection: 90,
  windSpeed: 0.8,
  diffusionRate: 0.15,
  releaseRate: 20,
  viscosity: 1.0,
  decayFactor: 0.992,
  simulationSpeed: 1.0,
  medium: 'air'
};

const createInitialGrid = (): number[][] =>
  Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));

const createInitialObstacles = (): boolean[][] =>
  Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(false));

const initialState: SimulationState = {
  isRunning: false,
  grid: createInitialGrid(),
  obstacles: createInitialObstacles(),
  sources: [{
    x: Math.floor(GRID_SIZE / 2),
    y: Math.floor(GRID_SIZE / 2),
    type: 'CO2',
    active: true
  }],
  parameters: initialParameters,
  fps: 0,
  gpuEnabled: false,
  scientistMode: false,
  isDrawingObstacles: false,
  dynamicWeather: false,
  resetTrigger: 0
};

export const useSimulationStore = create<SimulationStore>((set) => ({
  ...initialState,
  actions: {
    start: () => set({ isRunning: true }),
    pause: () => set({ isRunning: false }),
    reset: () => set((state) => ({
      isRunning: false,
      grid: createInitialGrid(),
      obstacles: createInitialObstacles(),
      parameters: initialParameters,
      sources: [{
        x: Math.floor(GRID_SIZE / 2),
        y: Math.floor(GRID_SIZE / 2),
        type: 'CO2',
        active: true
      }],
      resetTrigger: state.resetTrigger + 1
    })),
    updateParameters: (params) => set((state) => ({
      parameters: { ...state.parameters, ...params }
    })),
    addSource: (source) => set((state) => ({
      sources: [...state.sources, { ...source, active: true }]
    })),
    setSources: (sources) => set({ sources }),
    removeSource: (index) => set((state) => ({
      sources: state.sources.filter((_, i) => i !== index)
    })),
    toggleGPU: () => set((state) => ({ gpuEnabled: !state.gpuEnabled })),
    toggleScientistMode: () => set((state) => ({ scientistMode: !state.scientistMode })),
    toggleDrawingObstacles: () => set((state) => ({ isDrawingObstacles: !state.isDrawingObstacles })),
    toggleDynamicWeather: () => set((state) => ({ dynamicWeather: !state.dynamicWeather })),
    setGrid: (grid) => set({ grid }),
    setObstacles: (obstacles) => set({ obstacles }),
    addObstacle: (x, y) => set((state) => {
      const newObstacles = state.obstacles.map(row => [...row]);
      if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        newObstacles[y][x] = true;
      }
      return { obstacles: newObstacles };
    }),
    removeObstacle: (x, y) => set((state) => {
      const newObstacles = state.obstacles.map(row => [...row]);
      if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        newObstacles[y][x] = false;
      }
      return { obstacles: newObstacles };
    }),
    setFPS: (fps) => set({ fps }),
    setMedium: (medium) => set((state) => ({
      parameters: { ...state.parameters, medium }
    }))
  }
}));