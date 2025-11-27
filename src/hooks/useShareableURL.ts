import { useEffect, useCallback } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { GRID_SIZE, SimulationParameters, PollutionSource } from '../types';

interface ShareableState {
  p: SimulationParameters; // parameters
  s: PollutionSource[];    // sources
  o: string;               // obstacles (base64 encoded binary string)
  g: boolean;              // gpuEnabled
  m: boolean;              // scientistMode
  w: boolean;              // dynamicWeather
}

export const useShareableURL = () => {
  const store = useSimulationStore();
  const { 
    parameters, 
    sources, 
    obstacles, 
    gpuEnabled, 
    scientistMode, 
    dynamicWeather,
    actions 
  } = store;

  // Encode obstacles to a compact string
  const encodeObstacles = useCallback((obstaclesGrid: boolean[][]): string => {
    let binaryString = '';
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        binaryString += obstaclesGrid[y][x] ? '1' : '0';
      }
    }
    
    // Convert binary string to base64
    // We'll use a simple compression: chunks of 6 bits -> base64 char
    const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let result = "";
    for (let i = 0; i < binaryString.length; i += 6) {
      const chunk = binaryString.substr(i, 6).padEnd(6, '0');
      const value = parseInt(chunk, 2);
      result += base64Chars[value];
    }
    return result;
  }, []);

  // Decode obstacles from string
  const decodeObstacles = useCallback((encoded: string): boolean[][] => {
    const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let binaryString = "";
    for (let i = 0; i < encoded.length; i++) {
      const val = base64Chars.indexOf(encoded[i]);
      binaryString += val.toString(2).padStart(6, '0');
    }

    const newObstacles = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(false));
    let index = 0;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (index < binaryString.length) {
          newObstacles[y][x] = binaryString[index] === '1';
          index++;
        }
      }
    }
    return newObstacles;
  }, []);

  const generateShareURL = useCallback(() => {
    const state: ShareableState = {
      p: parameters,
      s: sources,
      o: encodeObstacles(obstacles),
      g: gpuEnabled,
      m: scientistMode,
      w: dynamicWeather
    };

    const jsonString = JSON.stringify(state);
    const encodedState = btoa(jsonString);
    const url = new URL(window.location.href);
    url.searchParams.set('state', encodedState);
    return url.toString();
  }, [parameters, sources, obstacles, gpuEnabled, scientistMode, dynamicWeather, encodeObstacles]);

  // Load state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encodedState = params.get('state');

    if (encodedState) {
      try {
        const jsonString = atob(encodedState);
        const state: ShareableState = JSON.parse(jsonString);

        // Apply state to store
        if (state.p) actions.updateParameters(state.p);
        if (state.s) actions.setSources(state.s);
        if (state.o) actions.setObstacles(decodeObstacles(state.o));
        if (state.g !== undefined && state.g !== gpuEnabled) actions.toggleGPU();
        if (state.m !== undefined && state.m !== scientistMode) actions.toggleScientistMode();
        if (state.w !== undefined && state.w !== dynamicWeather) actions.toggleDynamicWeather();
        
      } catch (error) {
        console.error("Failed to load state from URL:", error);
      }
    }
  }, []); // Run once on mount

  return { generateShareURL };
};
