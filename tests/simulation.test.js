/**
 * @jest-environment jsdom
 */

import { AdvancedPhysicsEngine } from '../scripts/advancedPhysics.js';
import { DispersionAnalytics } from '../scripts/advancedVisualization.js';

// Mock WebGL context
const mockWebGLContext = {
  createShader: jest.fn(),
  shaderSource: jest.fn(),
  compileShader: jest.fn(),
  getShaderParameter: jest.fn(() => true),
  createProgram: jest.fn(),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  getProgramParameter: jest.fn(() => true),
  createTexture: jest.fn(),
  bindTexture: jest.fn(),
  texImage2D: jest.fn(),
  texParameteri: jest.fn()
};

// Mock canvas
global.HTMLCanvasElement.prototype.getContext = jest.fn(() => mockWebGLContext);

describe('Advanced Physics Engine', () => {
  let engine;
  
  beforeEach(() => {
    engine = new AdvancedPhysicsEngine(80, 1.0);
  });
  
  test('should initialize with correct grid size', () => {
    expect(engine.gridSize).toBe(80);
    expect(engine.velocityU).toHaveLength(80);
    expect(engine.velocityV).toHaveLength(80);
  });
  
  test('should create grids with correct dimensions', () => {
    const grid = engine.createGrid();
    expect(grid).toHaveLength(80);
    expect(grid[0]).toHaveLength(80);
    expect(grid[0][0]).toBe(0);
  });
  
  test('should calculate wind forcing correctly', () => {
    engine.windProfile = {
      referenceHeight: 10,
      referenceSpeed: 5,
      roughnessLength: 0.1
    };
    
    const windForce = engine.calculateWindForcing(40, 40);
    expect(windForce).toHaveProperty('u');
    expect(windForce).toHaveProperty('v');
    expect(typeof windForce.u).toBe('number');
    expect(typeof windForce.v).toBe('number');
  });
  
  test('should interpolate velocity correctly', () => {
    // Set up test velocity field
    engine.velocityU[10][10] = 1.0;
    engine.velocityU[11][10] = 2.0;
    engine.velocityU[10][11] = 1.5;
    engine.velocityU[11][11] = 2.5;
    
    const interpolated = engine.interpolateVelocity(10.5, 10.5, 'u');
    expect(interpolated).toBeCloseTo(1.75, 2);
  });
  
  test('should compute Laplacian correctly', () => {
    const testField = engine.createGrid();
    testField[10][10] = 4.0;
    testField[9][10] = 1.0;
    testField[11][10] = 1.0;
    testField[10][9] = 1.0;
    testField[10][11] = 1.0;
    
    const laplacian = engine.computeLaplacian(testField, 10, 10);
    expect(laplacian).toBeCloseTo(0, 2); // Should be 0 for this symmetric case
  });
});

describe('Dispersion Analytics', () => {
  let analytics;
  let testGrid;
  
  beforeEach(() => {
    analytics = new DispersionAnalytics();
    testGrid = Array(20).fill(0).map(() => Array(20).fill(0));
    
    // Create test pollution pattern
    testGrid[10][10] = 100;
    testGrid[10][11] = 80;
    testGrid[11][10] = 80;
    testGrid[9][10] = 60;
    testGrid[10][9] = 60;
  });
  
  test('should calculate max concentration correctly', () => {
    const maxConc = analytics.getMaxConcentration(testGrid);
    expect(maxConc).toBe(100);
  });
  
  test('should calculate affected area correctly', () => {
    const area = analytics.calculateAffectedArea(testGrid);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeLessThan(1); // Should be small area for test data
  });
  
  test('should assess risk level correctly', () => {
    expect(analytics.assessRiskLevel(250, 60)).toBe('CRITICAL');
    expect(analytics.assessRiskLevel(150, 30)).toBe('HIGH');
    expect(analytics.assessRiskLevel(75, 15)).toBe('MODERATE');
    expect(analytics.assessRiskLevel(25, 5)).toBe('LOW');
  });
  
  test('should calculate risk zones', () => {
    const riskZones = analytics.calculateRiskZones(testGrid);
    expect(Array.isArray(riskZones)).toBe(true);
    expect(riskZones.length).toBeGreaterThan(0);
    
    riskZones.forEach(zone => {
      expect(zone).toHaveProperty('x');
      expect(zone).toHaveProperty('y');
      expect(zone).toHaveProperty('riskLevel');
      expect(zone).toHaveProperty('radius');
    });
  });
  
  test('should calculate forecast confidence', () => {
    const goodData = { weather: { windSpeed: 5, temperature: 20 } };
    const badData = null;
    
    const goodConfidence = analytics.calculateForecastConfidence(goodData);
    const badConfidence = analytics.calculateForecastConfidence(badData);
    
    expect(goodConfidence).toBeGreaterThan(badConfidence);
    expect(goodConfidence).toBeLessThanOrEqual(1.0);
    expect(badConfidence).toBeLessThanOrEqual(1.0);
  });
});

describe('Integration Tests', () => {
  test('should maintain mass conservation over time', () => {
    const engine = new AdvancedPhysicsEngine(40, 1.0);
    const analytics = new DispersionAnalytics();
    
    // Initialize with point source
    const initialGrid = engine.createGrid();
    initialGrid[20][20] = 1000;
    
    const initialMass = analytics.getMaxConcentration(initialGrid) * 40 * 40;
    
    // Simulate several steps
    let currentGrid = initialGrid;
    for (let i = 0; i < 50; i++) {
      currentGrid = engine.simulatePollutantTransport(currentGrid, {
        diffusionModifier: 1.0,
        behavior: {
          viscosity: 1.0,
          reactivity: 0.0,
          sinkRate: 0.0
        }
      });
    }
    
    const finalMass = analytics.getMaxConcentration(currentGrid) * 40 * 40;
    const massLoss = Math.abs(finalMass - initialMass) / initialMass;
    
    // Allow 5% mass loss due to numerical diffusion
    expect(massLoss).toBeLessThan(0.05);
  });
});

describe('Performance Tests', () => {
  test('should complete simulation step within performance budget', () => {
    const engine = new AdvancedPhysicsEngine(80, 1.0);
    const testGrid = engine.createGrid();
    testGrid[40][40] = 100;
    
    const startTime = performance.now();
    
    for (let i = 0; i < 10; i++) {
      engine.simulatePollutantTransport(testGrid, {
        diffusionModifier: 1.0,
        behavior: { viscosity: 1.0, reactivity: 0.0, sinkRate: 0.0 }
      });
    }
    
    const endTime = performance.now();
    const timePerStep = (endTime - startTime) / 10;
    
    // Should complete each step in less than 16ms (60 FPS target)
    expect(timePerStep).toBeLessThan(16);
  });
});

describe('Error Handling', () => {
  test('should handle invalid grid inputs gracefully', () => {
    const analytics = new DispersionAnalytics();
    
    expect(() => analytics.getMaxConcentration(null)).not.toThrow();
    expect(() => analytics.getMaxConcentration([])).not.toThrow();
    expect(() => analytics.calculateAffectedArea(undefined)).not.toThrow();
  });
  
  test('should handle extreme parameter values', () => {
    const engine = new AdvancedPhysicsEngine(80, 1.0);
    
    expect(() => {
      engine.calculateWindForcing(1000, 1000); // Out of bounds
    }).not.toThrow();
    
    expect(() => {
      engine.interpolateVelocity(-10, -10, 'u'); // Negative coordinates
    }).not.toThrow();
  });
});
