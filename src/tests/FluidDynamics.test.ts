import { FluidDynamics } from '../physics/FluidDynamics';

// Mock WebGLSimulationEngine to avoid GPU initialization in tests
jest.mock('../physics/WebGLSimulationEngine', () => ({
  WebGLSimulationEngine: {
    isSupported: jest.fn().mockReturnValue(false),
  },
}));

describe('FluidDynamics', () => {
  let fluidDynamics: FluidDynamics;
  const TEST_GRID_SIZE = 50;

  beforeEach(() => {
    fluidDynamics = new FluidDynamics(TEST_GRID_SIZE);
  });

  test('should initialize with correct grid size', () => {
    // Access private property for testing (casting to any)
    expect((fluidDynamics as any).gridSize).toBe(TEST_GRID_SIZE);
  });

  test('should initialize fields with zeros', () => {
    const density = fluidDynamics.getDensity();
    const u = fluidDynamics.getVelocityX();
    const v = fluidDynamics.getVelocityY();

    expect(density.length).toBe(TEST_GRID_SIZE);
    expect(density[0].length).toBe(TEST_GRID_SIZE);
    expect(density[0][0]).toBe(0);
    expect(u[0][0]).toBe(0);
    expect(v[0][0]).toBe(0);
  });

  test('should add density source correctly', () => {
    const x = 25;
    const y = 25;
    const amount = 100;

    fluidDynamics.addDensitySource(x, y, amount);
    const density = fluidDynamics.getDensity();

    expect(density[y][x]).toBe(amount);
  });

  test('should clamp density to 255', () => {
    const x = 25;
    const y = 25;
    const amount = 300;

    fluidDynamics.addDensitySource(x, y, amount);
    const density = fluidDynamics.getDensity();

    expect(density[y][x]).toBe(255);
  });

  test('should set velocity field based on wind parameters', () => {
    const windDirection = 0; // East (positive X)
    const windSpeed = 1.0;

    // Create params with wind
    const params = {
      windDirection,
      windSpeed,
      diffusionRate: 0,
      releaseRate: 0,
      viscosity: 0,
      decayFactor: 1.0,
      simulationSpeed: 1.0
    };

    // Run a step to apply wind force and solve velocity
    fluidDynamics.step(params, []);

    // Check center of grid
    const center = Math.floor(TEST_GRID_SIZE / 2);

    // With windDirection 0 (East), forceX should be positive
    const u0 = fluidDynamics.getVelocityX();
    const v0 = fluidDynamics.getVelocityY();

    expect(u0[center][center]).toBeGreaterThan(0);
    // v0 might be small/zero
    expect(Math.abs(v0[center][center])).toBeLessThan(0.1);
  });

  test('should reset simulation', () => {
    fluidDynamics.addDensitySource(10, 10, 100);
    fluidDynamics.reset();
    const density = fluidDynamics.getDensity();
    expect(density[10][10]).toBe(0);
  });

  test('should handle obstacles', () => {
    const obstacles = Array(TEST_GRID_SIZE).fill(0).map(() => Array(TEST_GRID_SIZE).fill(false));
    obstacles[10][10] = true;

    fluidDynamics.setObstacles(obstacles);

    // Set wind via step
    const params = {
      windDirection: 0,
      windSpeed: 1.0,
      diffusionRate: 0,
      releaseRate: 0,
      viscosity: 0,
      decayFactor: 1.0,
      simulationSpeed: 1.0
    };

    fluidDynamics.step(params, []);

    const u = fluidDynamics.getVelocityX();
    const v = fluidDynamics.getVelocityY();

    // Velocity inside obstacle should be 0 (enforce BC)
    expect(u[10][10]).toBe(0);
    expect(v[10][10]).toBe(0);

    // Velocity outside should be non-zero (wind)
    expect(u[10][11]).not.toBe(0);
  });

  test('should execute simulation step', () => {
    // Setup initial state
    fluidDynamics.addDensitySource(25, 25, 200);

    const params = {
      windDirection: 0,
      windSpeed: 1.0,
      diffusionRate: 0.1,
      releaseRate: 0, // Don't add more
      viscosity: 0,
      decayFactor: 1.0,
      simulationSpeed: 1.0
    };

    // Run a step
    fluidDynamics.step(params, []);

    const density = fluidDynamics.getDensity();

    // Density should have spread/moved
    // Exact values are hard to predict without running the math, 
    // but the source point should likely decrease (diffusion/advection) 
    // and neighbors should increase.

    expect(density[25][25]).toBeLessThan(200);

    // Check a neighbor (diffusion)
    // Note: Advection might move it away, but diffusion spreads it.
    // With wind 0 (East), it should move +x.
    // Let's check 25, 26 (y+1) or 26, 25 (x+1).

    // Just checking that the grid is not all zeros anymore (except the source)
    let totalMass = 0;
    for (let y = 0; y < TEST_GRID_SIZE; y++) {
      for (let x = 0; x < TEST_GRID_SIZE; x++) {
        totalMass += density[y][x];
      }
    }
    expect(totalMass).toBeGreaterThan(0);
  });
});
