// Constants
const GRID_SIZE = 80; // Size of the simulation grid (80x80 cells)
let CELL_SIZE; // Will be calculated based on canvas size

// Pollution types configuration
const POLLUTANT_TYPES = {
    CHEMICAL: {
        id: 'chemical',
        name: 'Chemical Pollution',
        description: 'Industrial chemical waste, highly toxic and slow to disperse',
        baseColor: { r: 139, g: 0, b: 0 }, // Dark red
        diffusionModifier: 0.8,
        behavior: {
            sinkRate: 0.2, // Tends to sink in water
            reactivity: 0.1, // Slow chemical breakdown
            viscosity: 1.2 // Slightly more viscous than water
        },
        effects: ['toxicity', 'waterQuality']
    },
    OIL: {
        id: 'oil',
        name: 'Oil Spill',
        description: 'Oil-based pollutants, forms a thick layer on water surface',
        baseColor: { r: 47, g: 79, b: 79 }, // Dark slate gray
        diffusionModifier: 0.6,
        behavior: {
            sinkRate: -0.3, // Floats on water
            reactivity: 0.05, // Very slow breakdown
            viscosity: 2.0 // Much more viscous than water
        },
        effects: ['surfaceSpread', 'waterQuality']
    },
    SEWAGE: {
        id: 'sewage',
        name: 'Organic Waste',
        description: 'Sewage and organic pollutants, affects water quality and promotes algae growth',
        baseColor: { r: 101, g: 67, b: 33 }, // Brown
        diffusionModifier: 1.2,
        behavior: {
            sinkRate: 0.1, // Slight tendency to sink
            reactivity: 0.3, // Moderate breakdown rate
            viscosity: 1.1, // Similar to water
            organicGrowth: 0.2 // Promotes algae growth
        },
        effects: ['organicContent', 'waterQuality', 'algaeGrowth']
    },
    THERMAL: {
        id: 'thermal',
        name: 'Thermal Pollution',
        description: 'Heat discharge raising water temperature, affecting oxygen levels',
        baseColor: { r: 255, g: 140, b: 0 }, // Dark orange
        diffusionModifier: 1.5,
        behavior: {
            sinkRate: -0.1, // Hot water rises
            reactivity: 0.4, // Moderately quick temperature dissipation
            viscosity: 0.8, // Less viscous due to heat
            tempGradient: 0.3 // Temperature difference from surrounding water
        },
        effects: ['temperature', 'oxygenLevel', 'waterQuality']
    }
};

// Simulation state
let pollutantGrid = [];
let newPollutantGrid = [];
let obstacleMask = [];
let obstaclesDirty = false;
let isRunning = false;
let animationFrameId = null;
let pollutionSource = { 
    x: Math.floor(GRID_SIZE / 2), 
    y: Math.floor(GRID_SIZE / 2),
    type: 'CHEMICAL' // Default pollution type
};

// GPU acceleration
let gpuEngine = null;
let useGPUAcceleration = false;
let simulationWorker = null;

// Performance monitoring
let frameCount = 0;
let lastTime = performance.now();
let currentFPS = 0;
let gpuFrameTick = 0; // For throttling GPU readbacks
const GPU_READBACK_INTERVAL = 2; // Read back every N frames (tune: 1-4)

// Initialize grids
function initializeGrid() {
    pollutantGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    newPollutantGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    obstacleMask = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    obstaclesDirty = true;
}

// Initialize GPU acceleration
function initializeGPU(canvas) {
    try {
        // Try the more compatible WebGL2 approach first
        if (typeof WebGLSimulationEngine !== 'undefined') {
            gpuEngine = new WebGLSimulationEngine(canvas, GRID_SIZE);
            simulationWorker = new SimulationWorker();
            useGPUAcceleration = true;
            window.gpuEngine = gpuEngine;
            console.log('WebGL GPU acceleration enabled');
            
            // Add GPU status indicator
            const statusElement = document.getElementById('gpuStatus');
            if (statusElement) {
                statusElement.textContent = 'GPU: WebGL2 Enabled';
                statusElement.className = 'text-green-600 font-medium';
            }
            
            return true;
        }
        
        // Fallback to compute shader approach if available
        if (typeof GPUSimulationEngine !== 'undefined') {
            gpuEngine = new GPUSimulationEngine(canvas, GRID_SIZE);
            simulationWorker = new SimulationWorker();
            useGPUAcceleration = true;
            window.gpuEngine = gpuEngine;
            console.log('Compute shader GPU acceleration enabled');
            
            const statusElement = document.getElementById('gpuStatus');
            if (statusElement) {
                statusElement.textContent = 'GPU: Compute Enabled';
                statusElement.className = 'text-green-600 font-medium';
            }
            
            return true;
        }
    } catch (error) {
        console.warn('GPU acceleration not available:', error.message);
        useGPUAcceleration = false;
        
        // Add GPU status indicator
        const statusElement = document.getElementById('gpuStatus');
        if (statusElement) {
            statusElement.textContent = 'GPU: Disabled (CPU fallback)';
            statusElement.className = 'text-orange-600 font-medium';
        }
    }
    return false;
}

// Color mapping function
function getColorForDensity(density, type = 'CHEMICAL') {
    const normalizedDensity = Math.min(1, Math.max(0, density / 255));
    
    // Base fluid color (light blue for water/air)
    const baseR = 235;
    const baseG = 245;
    const baseB = 255;
    
    if (normalizedDensity === 0) {
        return {
            color: `rgb(${baseR}, ${baseG}, ${baseB})`,
            type: null
        };
    }
    
    const pollutantType = POLLUTANT_TYPES[type];
    const pollutionColor = pollutantType.baseColor;
    
    // Blend between base fluid color and pollution color based on density
    const r = Math.floor(baseR + (pollutionColor.r - baseR) * normalizedDensity);
    const g = Math.floor(baseG + (pollutionColor.g - baseG) * normalizedDensity);
    const b = Math.floor(baseB + (pollutionColor.b - baseB) * normalizedDensity);
    return `rgb(${r}, ${g}, ${b})`;
}

// Helper function for interpolation
function getInterpolatedDensity(grid, r, c) {
    const r0 = Math.floor(r);
    const c0 = Math.floor(c);
    const r1 = r0 + 1;
    const c1 = c0 + 1;

    const fr = r - r0;
    const fc = c - c0;

    let val = 0;
    if (r0 >= 0 && r0 < GRID_SIZE && c0 >= 0 && c0 < GRID_SIZE) {
        val += grid[r0][c0] * (1 - fr) * (1 - fc);
    }
    if (r0 >= 0 && r0 < GRID_SIZE && c1 >= 0 && c1 < GRID_SIZE) {
        val += grid[r0][c1] * (1 - fr) * fc;
    }
    if (r1 >= 0 && r1 < GRID_SIZE && c0 >= 0 && c0 < GRID_SIZE) {
        val += grid[r1][c0] * fr * (1 - fc);
    }
    if (r1 >= 0 && r1 < GRID_SIZE && c1 >= 0 && c1 < GRID_SIZE) {
        val += grid[r1][c1] * fr * fc;
    }
    return val;
}

// Helper function for simulation
function moveAndDiffuse(r, c, amount, windVelX, windVelY, viscosity, diffusionRate, diffusionModifier) {
    // Scale wind velocity by viscosity
    const effectiveVelX = windVelX / Math.max(0.1, viscosity);
    const effectiveVelY = windVelY / Math.max(0.1, viscosity);
    
    // Calculate new position based on effective velocity
    const newR = r + effectiveVelY;
    const newC = c + effectiveVelX;
    
    // No-flux boundaries: clamp movement at edges and obstacles
    const r0 = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(newR)));
    const c0 = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(newC)));
    const r1 = Math.max(0, Math.min(GRID_SIZE - 1, r0 + 1));
    const c1 = Math.max(0, Math.min(GRID_SIZE - 1, c0 + 1));

    // If destination cells are obstacles, reduce movement into them
    const isObst = (rr, cc) => obstacleMask[rr]?.[cc] === 1;
    
    const fr = newR - Math.floor(newR);
    const fc = newC - Math.floor(newC);
    
    // Movement distribution with improved interpolation
    const movementAmount = amount * 0.9; // 90% moves with wind
    const stayAmount = amount * 0.1; // 10% stays for stability
    
    // Bilinear interpolation for smooth movement
    const w00 = (1 - fr) * (1 - fc);
    const w01 = (1 - fr) * fc;
    const w10 = fr * (1 - fc);
    const w11 = fr * fc;
    const scaleInto = (rr, cc, w) => (isObst(rr, cc) ? 0 : w);
    const w00s = scaleInto(r0, c0, w00);
    const w01s = scaleInto(r0, c1, w01);
    const w10s = scaleInto(r1, c0, w10);
    const w11s = scaleInto(r1, c1, w11);

    const moved = movementAmount * (w00s + w01s + w10s + w11s);
    newPollutantGrid[r0][c0] += movementAmount * w00s;
    newPollutantGrid[r0][c1] += movementAmount * w01s;
    newPollutantGrid[r1][c0] += movementAmount * w10s;
    newPollutantGrid[r1][c1] += movementAmount * w11s;
    
    // The rest stays in the current position
    newPollutantGrid[r][c] += stayAmount;
    
    // Apply diffusion with type-specific modifier
    const effectiveDiffusion = diffusionRate * diffusionModifier * 0.25;
    const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    for (const [dr, dc] of neighbors) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && !isObst(nr, nc)) {
            newPollutantGrid[nr][nc] += amount * effectiveDiffusion;
        } else {
            // reflect diffusion back into current cell on obstacle/edge
            newPollutantGrid[r][c] += amount * effectiveDiffusion;
        }
    }
}

// Main simulation step
function simulateStep() {
    // Get simulation parameters
    const windAngleRad = (window.windDirection || 0) * Math.PI / 180;
    const windVelX = (window.windSpeed || 0.5) * Math.cos(windAngleRad);
    const windVelY = (window.windSpeed || 0.5) * Math.sin(windAngleRad);
    const diffusionRate = window.diffusionRate || 0.1;
    const pollutantType = POLLUTANT_TYPES[pollutionSource.type];
    
    if (useGPUAcceleration && gpuEngine) {
        simulateStepGPU(windVelX, windVelY, diffusionRate, pollutantType);
    } else {
        simulateStepCPU(windVelX, windVelY, diffusionRate, pollutantType);
    }
}

// GPU-accelerated simulation step
function simulateStepGPU(windVelX, windVelY, diffusionRate, pollutantType) {
    try {
        // Convert grid to GPU textures and run compute shaders
        const deltaTime = 1.0 / 60.0; // Assuming 60 FPS
        
        // Update pollution source in CPU grid first
        if (pollutionSource && pollutionSource.x >= 0 && pollutionSource.y >= 0 &&
            pollutionSource.x < GRID_SIZE && pollutionSource.y < GRID_SIZE) {
            pollutantGrid[pollutionSource.y][pollutionSource.x] += window.releaseRate || 10;
        }
        
        // Set uniforms for GPU computation
        const uniforms = {
            u_deltaTime: deltaTime,
            u_gridSpacing: 1.0,
            u_gridSize: [GRID_SIZE, GRID_SIZE],
            u_windVelocity: [windVelX, windVelY],
            u_diffusionRate: diffusionRate * pollutantType.diffusionModifier,
            u_pollutantProperties: [
                pollutantType.diffusionModifier,
                pollutantType.behavior.reactivity || 0.1,
                pollutantType.behavior.sinkRate || 0.0,
                pollutantType.behavior.volatility || 0.0
            ],
            u_viscosity: pollutantType.behavior.viscosity || 1.0,
            u_sourcePosition: [pollutionSource.x, pollutionSource.y],
            u_sourceStrength: (window.releaseRate || 10) / 255.0,
            u_sourceRadius: 2.0
        };
        
    // Run GPU simulation step with throttled readback to reduce CPU-GPU transfers
    const shouldReadback = (gpuFrameTick % GPU_READBACK_INTERVAL) === 0;
    gpuEngine.simulateFrame(pollutantGrid, uniforms, { readback: shouldReadback });
    gpuFrameTick = (gpuFrameTick + 1) >>> 0;
        
        // Optional: Use web worker for additional background processing
        if (simulationWorker && Math.random() < 0.1) { // Every ~10 frames
            simulationWorker.computeInBackground('ANALYZE_DISPERSION', {
                grid: pollutantGrid,
                source: pollutionSource,
                type: pollutantType
            });
        }
        
    } catch (error) {
        console.warn('GPU simulation failed, falling back to CPU:', error);
        useGPUAcceleration = false;
        updatePerformanceDisplay(); // Update display to show CPU mode
        simulateStepCPU(windVelX, windVelY, diffusionRate, pollutantType);
    }
}

// CPU fallback simulation step
function simulateStepCPU(windVelX, windVelY, diffusionRate, pollutantType) {
    // Reset new grid
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            newPollutantGrid[r][c] = 0;
        }
    }
    
    // Add new pollutant at source
    if (pollutionSource && pollutionSource.x >= 0 && pollutionSource.y >= 0 &&
        pollutionSource.x < GRID_SIZE && pollutionSource.y < GRID_SIZE) {
        pollutantGrid[pollutionSource.y][pollutionSource.x] += window.releaseRate || 10;
    }
    
    // Process movement and diffusion for each cell
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (pollutantGrid[r][c] > 0) {
                moveAndDiffuse(
                    r, c,
                    pollutantGrid[r][c],
                    windVelX,
                    windVelY,
                    pollutantType.behavior.viscosity,
                    diffusionRate,
                    pollutantType.diffusionModifier
                );
            }
        }
    }
    
    // Update grid with decay
    const decayFactor = 0.995; // Slower decay for better visibility
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            pollutantGrid[r][c] = Math.min(255, newPollutantGrid[r][c] * decayFactor);
        }
    }
}

// Animation loop
function animate() {
    if (!isRunning) return;
    
    // Performance monitoring
    frameCount++;
    const currentTime = performance.now();
    if (currentTime - lastTime >= 1000) { // Update FPS every second
        currentFPS = Math.round((frameCount * 1000) / (currentTime - lastTime));
        updatePerformanceDisplay();
        frameCount = 0;
        lastTime = currentTime;
    }
    
    simulateStep();
    window.draw();
    animationFrameId = requestAnimationFrame(animate);
}

// Update performance display
function updatePerformanceDisplay() {
    const fpsDisplay = document.getElementById('fpsDisplay');
    const computeModeDisplay = document.getElementById('computeModeDisplay');
    
    if (fpsDisplay) {
        fpsDisplay.textContent = currentFPS;
        fpsDisplay.className = currentFPS > 30 ? 'text-green-600' : currentFPS > 15 ? 'text-yellow-600' : 'text-red-600';
    }
    
    if (computeModeDisplay) {
        computeModeDisplay.textContent = useGPUAcceleration ? 'GPU' : 'CPU';
        computeModeDisplay.className = useGPUAcceleration ? 'text-green-600 font-medium' : 'text-blue-600';
    }
}

// Toggle GPU acceleration
function toggleGPUAcceleration() {
    useGPUAcceleration = !useGPUAcceleration;
    
    // Update GPU toggle UI
    const toggle = document.getElementById('gpuToggle');
    if (toggle) {
        toggle.classList.toggle('active', useGPUAcceleration);
    }
    
    // Update status indicators
    updatePerformanceDisplay();
    
    const statusText = useGPUAcceleration ? 'GPU acceleration enabled' : 'GPU acceleration disabled';
    if (typeof showMessage === 'function') {
        showMessage(statusText, 'info', 2000);
    }
    
    console.log(statusText);
}

// Initialize simulation
function init() {
    initializeGrid();
    
    // Try to initialize GPU acceleration
    const canvas = document.getElementById('simulationCanvas');
    if (canvas) {
        initializeGPU(canvas);
    }
    
    window.getColorForDensity = getColorForDensity;
    window.pollutantGrid = pollutantGrid;
    window.pollutionSource = pollutionSource;
    window.isRunning = isRunning;
    window.animate = animate;
    window.POLLUTANT_TYPES = POLLUTANT_TYPES;
    window.toggleGPUAcceleration = toggleGPUAcceleration;
    window.obstacleMask = obstacleMask;
    window.obstaclesDirty = obstaclesDirty;
}

// Function to toggle GPU acceleration
function toggleGPUAcceleration() {
    if (gpuEngine) {
        useGPUAcceleration = !useGPUAcceleration;
        const statusElement = document.getElementById('gpuStatus');
        if (statusElement) {
            statusElement.textContent = useGPUAcceleration ? 'GPU: Enabled' : 'GPU: Disabled (CPU)';
            statusElement.className = useGPUAcceleration ? 'text-green-600 font-medium' : 'text-blue-600 font-medium';
        }
        console.log('GPU acceleration:', useGPUAcceleration ? 'enabled' : 'disabled');
        return useGPUAcceleration;
    }
    return false;
}

// Initialize when the script loads
init();
