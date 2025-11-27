import { GRID_SIZE, SimulationParameters, PollutionSource } from '../types';
import { WebGLSimulationEngine } from './WebGLSimulationEngine';

export class FluidDynamics {
  private gridSize: number;
  private baseDt: number = 0.1; // Base time step
  private dt: number = 0.1; // Current time step

  // Velocity fields
  private u!: number[][]; // x-velocity
  private v!: number[][]; // y-velocity

  // Density field (pollution)
  private density!: number[][];
  private densityPrev!: number[][];

  // Obstacles
  private obstacles!: boolean[][];

  // GPU acceleration
  private gpuEngine: WebGLSimulationEngine | null = null;
  private useGPU: boolean = false;

  constructor(gridSize: number = GRID_SIZE, canvas?: HTMLCanvasElement) {
    this.gridSize = gridSize;
    this.initializeFields();

    // Try to initialize GPU acceleration
    if (canvas && WebGLSimulationEngine.isSupported()) {
      try {
        this.gpuEngine = new WebGLSimulationEngine(canvas, gridSize);
        this.useGPU = true;
        console.log('GPU acceleration enabled');
      } catch (error) {
        console.warn('GPU acceleration failed to initialize:', error);
        this.useGPU = false;
      }
    }
  }

  private initializeFields(): void {
    const size = this.gridSize;
    this.u = Array(size).fill(0).map(() => Array(size).fill(0));
    this.v = Array(size).fill(0).map(() => Array(size).fill(0));
    this.density = Array(size).fill(0).map(() => Array(size).fill(0));
    this.densityPrev = Array(size).fill(0).map(() => Array(size).fill(0));
    this.obstacles = Array(size).fill(0).map(() => Array(size).fill(false));
  }

  // Toggle GPU acceleration
  setGPUEnabled(enabled: boolean): void {
    this.useGPU = enabled && this.gpuEngine !== null;
  }

  // Set obstacles
  setObstacles(obstacles: boolean[][]): void {
    this.obstacles = obstacles.map(row => [...row]);
  }

  // Set density field (pollution)
  setDensity(density: number[][]): void {
    this.density = density.map(row => [...row]);
  }

  // Get density field
  getDensity(): number[][] {
    return this.density.map(row => [...row]);
  }

  // Get velocity X field
  getVelocityX(): number[][] {
    return this.u.map(row => [...row]);
  }

  // Get velocity Y field
  getVelocityY(): number[][] {
    return this.v.map(row => [...row]);
  }

  // Add source to density
  addDensitySource(x: number, y: number, amount: number): void {
    if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
      this.density[y][x] += amount;
      if (this.density[y][x] > 255) this.density[y][x] = 255;
    }
  }

  // Set velocity field (wind)
  setVelocityField(windDirection: number, windSpeed: number): void {
    const angleRad = (windDirection * Math.PI) / 180;
    const speed = windSpeed * 2.0; // Scale for visibility
    const baseVelX = speed * Math.cos(angleRad);
    const baseVelY = speed * Math.sin(angleRad);

    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        if (!this.obstacles[i][j]) {
          this.u[i][j] = baseVelX;
          this.v[i][j] = baseVelY;
        } else {
          this.u[i][j] = 0;
          this.v[i][j] = 0;
        }
      }
    }
  }

  // Semi-Lagrangian advection
  private advect(field: number[][], fieldPrev: number[][], u: number[][], v: number[][]): void {
    for (let i = 1; i < this.gridSize - 1; i++) {
      for (let j = 1; j < this.gridSize - 1; j++) {
        if (this.obstacles[i][j]) {
          field[i][j] = 0;
          continue;
        }

        // Trace back particle
        const x = j - this.dt * u[i][j];
        const y = i - this.dt * v[i][j];

        // Bilinear interpolation
        const x0 = Math.floor(x);
        const x1 = x0 + 1;
        const y0 = Math.floor(y);
        const y1 = y0 + 1;

        const s1 = x - x0;
        const s0 = 1 - s1;
        const t1 = y - y0;
        const t0 = 1 - t1;

        let val = 0;
        if (x0 >= 0 && x0 < this.gridSize && y0 >= 0 && y0 < this.gridSize) val += s0 * t0 * fieldPrev[y0][x0];
        if (x1 >= 0 && x1 < this.gridSize && y0 >= 0 && y0 < this.gridSize) val += s1 * t0 * fieldPrev[y0][x1];
        if (x0 >= 0 && x0 < this.gridSize && y1 >= 0 && y1 < this.gridSize) val += s0 * t1 * fieldPrev[y1][x0];
        if (x1 >= 0 && x1 < this.gridSize && y1 >= 0 && y1 < this.gridSize) val += s1 * t1 * fieldPrev[y1][x1];

        field[i][j] = val;
      }
    }
  }

  // Diffusion using Gauss-Seidel relaxation
  private diffuse(field: number[][], fieldPrev: number[][], diff: number): void {
    const a = this.dt * diff * this.gridSize * this.gridSize;

    for (let k = 0; k < 20; k++) { // Jacobi iterations
      for (let i = 1; i < this.gridSize - 1; i++) {
        for (let j = 1; j < this.gridSize - 1; j++) {
          if (!this.obstacles[i][j]) {
            field[i][j] = (fieldPrev[i][j] +
                          a * (field[i-1][j] + field[i+1][j] +
                               field[i][j-1] + field[i][j+1])) / (1 + 4 * a);
          } else {
            field[i][j] = 0;
          }
        }
      }
    }
  }

  // Set boundary conditions
  private setBoundaryConditions(field: number[][], type: 'velocity' | 'density'): void {
    for (let i = 0; i < this.gridSize; i++) {
      field[i][0] = type === 'velocity' ? -field[i][1] : field[i][1];
      field[i][this.gridSize - 1] = type === 'velocity' ? -field[i][this.gridSize - 2] : field[i][this.gridSize - 2];
      field[0][i] = type === 'velocity' ? -field[1][i] : field[1][i];
      field[this.gridSize - 1][i] = type === 'velocity' ? -field[this.gridSize - 2][i] : field[this.gridSize - 2][i];
    }
    
    // Corners
    field[0][0] = 0.5 * (field[1][0] + field[0][1]);
    field[0][this.gridSize-1] = 0.5 * (field[1][this.gridSize-1] + field[0][this.gridSize-2]);
    field[this.gridSize-1][0] = 0.5 * (field[this.gridSize-2][0] + field[this.gridSize-1][1]);
    field[this.gridSize-1][this.gridSize-1] = 0.5 * (field[this.gridSize-2][this.gridSize-1] + field[this.gridSize-1][this.gridSize-2]);
  }

  // Main simulation step
  step(parameters: SimulationParameters, sources: PollutionSource[] = []): void {
    // Update time step based on simulation speed
    this.dt = this.baseDt * (parameters.simulationSpeed || 1.0);

    if (this.useGPU && this.gpuEngine) {
      // Use GPU acceleration
      this.gpuEngine.simulateFrame(this.density, parameters, sources, this.obstacles, { readback: true });
    } else {
      // Use CPU simulation
      this.cpuStep(parameters, sources);
    }
  }

  // CPU-based simulation (original implementation)
  private cpuStep(parameters: SimulationParameters, sources: PollutionSource[]): void {
    // 1. Add pollution at sources
    sources.forEach((source: PollutionSource) => {
      if (source.active && source.x >= 0 && source.y >= 0 &&
          source.x < this.gridSize && source.y < this.gridSize) {
        this.addDensitySource(source.x, source.y, parameters.releaseRate);
      }
    });

    // 2. Set velocity field based on wind parameters
    this.setVelocityField(parameters.windDirection, parameters.windSpeed);

    // 3. Diffuse Density
    // Swap buffers so densityPrev has current state (with sources), density is target
    [this.density, this.densityPrev] = [this.densityPrev, this.density];
    this.diffuse(this.density, this.densityPrev, parameters.diffusionRate);
    this.setBoundaryConditions(this.density, 'density');

    // 4. Advect Density
    // Swap buffers so densityPrev has diffused state, density is target
    [this.density, this.densityPrev] = [this.densityPrev, this.density];
    this.advect(this.density, this.densityPrev, this.u, this.v);
    this.setBoundaryConditions(this.density, 'density');

    // 5. Apply decay
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        this.density[i][j] *= parameters.decayFactor;
        this.density[i][j] = Math.max(0, Math.min(255, this.density[i][j]));
      }
    }
  }

  // Reset simulation
  reset(): void {
    this.initializeFields();
  }
}