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
let isRunning = false;
let animationFrameId = null;
let pollutionSource = { 
    x: Math.floor(GRID_SIZE / 2), 
    y: Math.floor(GRID_SIZE / 2),
    type: 'CHEMICAL' // Default pollution type
};

// Initialize grids
function initializeGrid() {
    pollutantGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    newPollutantGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
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
    // Calculate new position based on wind and viscosity
    const newR = r + windVelY * (1 / viscosity);
    const newC = c + windVelX * (1 / viscosity);
    
    // Boundary check
    if (newR >= 0 && newR < GRID_SIZE - 1 && newC >= 0 && newC < GRID_SIZE - 1) {
        // Bilinear interpolation for smooth movement
        const r0 = Math.floor(newR);
        const c0 = Math.floor(newC);
        const r1 = r0 + 1;
        const c1 = c0 + 1;
        
        const fr = newR - r0;
        const fc = newC - c0;
        
        // Movement distribution
        const movementAmount = amount * 0.8; // 80% moves, 20% stays for stability
        newPollutantGrid[r0][c0] += movementAmount * (1 - fr) * (1 - fc);
        newPollutantGrid[r0][c1] += movementAmount * (1 - fr) * fc;
        newPollutantGrid[r1][c0] += movementAmount * fr * (1 - fc);
        newPollutantGrid[r1][c1] += movementAmount * fr * fc;
        
        // The rest stays in current position
        newPollutantGrid[r][c] += amount * 0.2;
    } else {
        // If outside bounds, keep in current position
        newPollutantGrid[r][c] += amount;
    }
    
    // Apply diffusion
    const effectiveDiffusion = diffusionRate * diffusionModifier * 0.25;
    const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    for (const [dr, dc] of neighbors) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
            newPollutantGrid[nr][nc] += amount * effectiveDiffusion;
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
    simulateStep();
    window.draw();
    animationFrameId = requestAnimationFrame(animate);
}

// Initialize simulation
function init() {
    initializeGrid();
    window.getColorForDensity = getColorForDensity;
    window.pollutantGrid = pollutantGrid;
    window.pollutionSource = pollutionSource;
    window.isRunning = isRunning;
    window.animate = animate;
    window.POLLUTANT_TYPES = POLLUTANT_TYPES;
}

// Initialize when the script loads
init();
