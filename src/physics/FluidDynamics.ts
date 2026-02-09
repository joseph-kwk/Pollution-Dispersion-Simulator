import { GRID_SIZE, SimulationParameters, PollutionSource } from '../types';
import { WebGLSimulationEngine } from './WebGLSimulationEngine';

export class FluidDynamics {
  private gridSize: number;
  private dt: number = 0.1;

  // Velocity fields (Current and Previous)
  private u: number[][]; // x-velocity
  private v: number[][]; // y-velocity
  private u_prev: number[][];
  private v_prev: number[][];

  // Density fields (Current and Previous)
  private density: number[][];
  private density_prev: number[][];

  // Obstacles
  private obstacles: boolean[][];

  // GPU acceleration
  private gpuEngine: WebGLSimulationEngine | null = null;
  private useGPU: boolean = false;

  constructor(gridSize: number = GRID_SIZE) {
    this.gridSize = gridSize;

    // Initialize standard fields
    this.u = this.createField();
    this.v = this.createField();
    this.u_prev = this.createField();
    this.v_prev = this.createField();
    this.density = this.createField();
    this.density_prev = this.createField();
    this.obstacles = Array(gridSize).fill(0).map(() => Array(gridSize).fill(false));

    // Try to initialize GPU acceleration
    if (WebGLSimulationEngine.isSupported()) {
      try {
        const gpuCanvas = document.createElement('canvas');
        gpuCanvas.width = gridSize;
        gpuCanvas.height = gridSize;
        this.gpuEngine = new WebGLSimulationEngine(gpuCanvas, gridSize);
        console.log('GPU acceleration initialized successfully');
      } catch (error) {
        console.warn('GPU acceleration failed to initialize:', error);
        this.useGPU = false;
      }
    }
  }

  private createField(): number[][] {
    return Array(this.gridSize).fill(0).map(() => Array(this.gridSize).fill(0));
  }

  // --- Public Interface ---

  setGPUEnabled(enabled: boolean): void {
    this.useGPU = enabled && this.gpuEngine !== null;
  }

  setObstacles(obstacles: boolean[][]): void {
    this.obstacles = obstacles.map(row => [...row]);
  }

  setDensity(density: number[][]): void {
    this.density = density.map(row => [...row]);
  }

  getDensity(): number[][] {
    return this.density.map(row => [...row]);
  }

  getVelocityX(): number[][] {
    return this.u.map(row => [...row]);
  }

  getVelocityY(): number[][] {
    return this.v.map(row => [...row]);
  }

  addDensitySource(x: number, y: number, amount: number): void {
    if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
      if (!this.obstacles[y][x]) {
        this.density[y][x] += amount;
        if (this.density[y][x] > 255) this.density[y][x] = 255;
      }
    }
  }

  addVelocityForce(x: number, y: number, amountX: number, amountY: number): void {
    if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
      if (!this.obstacles[y][x]) {
        this.u[y][x] += amountX;
        this.v[y][x] += amountY;
      }
    }
  }

  reset(): void {
    this.u = this.createField();
    this.v = this.createField();
    this.u_prev = this.createField();
    this.v_prev = this.createField();
    this.density = this.createField();
    this.density_prev = this.createField();
  }

  step(parameters: SimulationParameters, sources: PollutionSource[] = []): void {
    this.dt = 0.1 * (parameters.simulationSpeed || 1.0);

    // 1. Solve Velocity (Always on CPU for consistency)
    this.solveVelocity(parameters);

    if (this.useGPU && this.gpuEngine) {
      // Pass the computed velocity field to the GPU
      this.gpuEngine.updateVelocity(this.u, this.v);
      // Run density advection/diffusion on GPU
      this.gpuEngine.simulateFrame(this.density, parameters, sources, this.obstacles, { readback: true });
    } else {
      this.solveDensity(parameters, sources);
    }
  }

  // --- CPU Physics Implementation (Navier-Stokes) ---

  private solveVelocity(parameters: SimulationParameters): void {
    const N = this.gridSize;
    // Water is approx 50-100x more viscous than air. We scale the user param accordingly.
    const mediumViscScale = parameters.medium === 'water' ? 0.0005 : 0.0001;
    const visc = parameters.viscosity * mediumViscScale;
    const windSpeed = parameters.windSpeed;
    const windDir = parameters.windDirection;

    // Add Wind as force
    const angleRad = (windDir * Math.PI) / 180;
    const forceX = Math.cos(angleRad) * windSpeed * 0.5;
    const forceY = Math.sin(angleRad) * windSpeed * 0.5;

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (!this.obstacles[i][j]) {
          this.u_prev[i][j] = forceX;
          this.v_prev[i][j] = forceY;
        }
      }
    }
    this.add_source(this.u, this.u_prev, this.dt);
    this.add_source(this.v, this.v_prev, this.dt);

    if (visc > 0) {
      this.diffuse(1, this.u_prev, this.u, visc);
      this.diffuse(2, this.v_prev, this.v, visc);
      this.project(this.u_prev, this.v_prev, this.u, this.v);
      this.advect(1, this.u, this.u_prev, this.u_prev, this.v_prev);
      this.advect(2, this.v, this.v_prev, this.u_prev, this.v_prev);
      this.project(this.u, this.v, this.u_prev, this.v_prev);
    } else {
      // Inviscid solver (faster, good for smoke)
      this.project(this.u_prev, this.v_prev, this.u, this.v);
      this.advect(1, this.u, this.u_prev, this.u_prev, this.v_prev);
      this.advect(2, this.v, this.v_prev, this.u_prev, this.v_prev);
      this.project(this.u, this.v, this.u_prev, this.v_prev);
    }
  }

  private solveDensity(parameters: SimulationParameters, sources: PollutionSource[]): void {
    const N = this.gridSize;
    // Pollution diffuses much slower in liquids.
    const mediumDiffScale = parameters.medium === 'water' ? 0.00002 : 0.0001;
    const diff = parameters.diffusionRate * mediumDiffScale;

    // Add Sources
    sources.forEach(source => {
      if (source.active) {
        this.addDensitySource(source.x, source.y, source.releaseRate !== undefined ? source.releaseRate : parameters.releaseRate);
      }
    });

    // Diffuse Density
    [this.density, this.density_prev] = [this.density_prev, this.density];
    this.diffuse(0, this.density, this.density_prev, diff);

    // Advect Density
    [this.density, this.density_prev] = [this.density_prev, this.density];
    this.advect(0, this.density, this.density_prev, this.u, this.v);

    // Apply Decay
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        this.density[i][j] *= parameters.decayFactor;
        if (this.density[i][j] < 0) this.density[i][j] = 0;
        if (this.density[i][j] > 255) this.density[i][j] = 255;
      }
    }
  }

  // Operation 0: Density, 1: X-Velocity, 2: Y-Velocity
  private add_source(x: number[][], s: number[][], dt: number) {
    const N = this.gridSize;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        x[i][j] += dt * s[i][j];
      }
    }
  }

  private diffuse(b: number, x: number[][], x0: number[][], diff: number) {
    const N = this.gridSize;
    const a = this.dt * diff * (N - 2) * (N - 2);
    this.lin_solve(b, x, x0, a, 1 + 4 * a);
  }

  private lin_solve(b: number, x: number[][], x0: number[][], a: number, c: number) {
    const N = this.gridSize;
    // Jacobi Iteration
    // Higher iterations = more accurate but slower. 10-20 is usually good for games.
    for (let k = 0; k < 15; k++) {
      for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
          if (!this.obstacles[i][j]) {
            x[i][j] = (x0[i][j] + a * (x[i - 1][j] + x[i + 1][j] + x[i][j - 1] + x[i][j + 1])) / c;
          } else {
            x[i][j] = 0;
          }
        }
      }
      this.set_bnd(b, x);
    }
  }

  private project(velocX: number[][], velocY: number[][], p: number[][], div: number[][]) {
    const N = this.gridSize;

    // Calculate Divergence
    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        // If obstacle, divergence is handled by boundary conditions
        if (!this.obstacles[i][j]) {
          div[i][j] = -0.5 * (velocX[i + 1][j] - velocX[i - 1][j] + velocY[i][j + 1] - velocY[i][j - 1]) / N;
          p[i][j] = 0;
        }
      }
    }

    this.set_bnd(0, div);
    this.set_bnd(0, p);

    // Solve Poisson equation for pressure
    this.lin_solve(0, p, div, 1, 4);

    // Subtract gradient field
    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        if (!this.obstacles[i][j]) {
          velocX[i][j] -= 0.5 * (N) * (p[i + 1][j] - p[i - 1][j]);
          velocY[i][j] -= 0.5 * (N) * (p[i][j + 1] - p[i][j - 1]);
        }
      }
    }

    this.set_bnd(1, velocX);
    this.set_bnd(2, velocY);
  }

  private advect(b: number, d: number[][], d0: number[][], velocX: number[][], velocY: number[][]) {
    const N = this.gridSize;
    const dt0 = this.dt * (N - 2);

    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        if (this.obstacles[i][j]) continue;

        let x = j - dt0 * velocX[i][j];
        let y = i - dt0 * velocY[i][j];

        // Clamp
        if (x < 0.5) x = 0.5;
        if (x > N - 1.5) x = N - 1.5;
        if (y < 0.5) y = 0.5;
        if (y > N - 1.5) y = N - 1.5;

        const i0 = Math.floor(x);
        const i1 = i0 + 1;
        const j0 = Math.floor(y);
        const j1 = j0 + 1;

        const s1 = x - i0;
        const s0 = 1.0 - s1;
        const t1 = y - j0;
        const t0 = 1.0 - t1;

        d[i][j] = s0 * (t0 * d0[j0][i0] + t1 * d0[j1][i0]) +
          s1 * (t0 * d0[j0][i1] + t1 * d0[j1][i1]);
      }
    }
    this.set_bnd(b, d);
  }

  private set_bnd(b: number, x: number[][]) {
    const N = this.gridSize;

    // Simple box boundaries
    for (let i = 1; i < N - 1; i++) {
      x[i][0] = b === 1 ? -x[i][1] : x[i][1];
      x[i][N - 1] = b === 1 ? -x[i][N - 2] : x[i][N - 2];
    }
    for (let i = 1; i < N - 1; i++) {
      x[0][i] = b === 2 ? -x[1][i] : x[1][i];
      x[N - 1][i] = b === 2 ? -x[N - 2][i] : x[N - 2][i];
    }

    // Corners
    x[0][0] = 0.5 * (x[1][0] + x[0][1]);
    x[0][N - 1] = 0.5 * (x[1][N - 1] + x[0][N - 2]);
    x[N - 1][0] = 0.5 * (x[N - 2][0] + x[N - 1][1]);
    x[N - 1][N - 1] = 0.5 * (x[N - 2][N - 1] + x[N - 1][N - 2]);
  }
}