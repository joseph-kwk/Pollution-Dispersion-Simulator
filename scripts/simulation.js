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

// Main simulation step
function simulateStep() {
    // Clear the new grid
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            newPollutantGrid[r][c] = 0;
        }
    }

    // Add pollutant at source with type-specific behavior
    if (pollutionSource && pollutionSource.x >= 0 && pollutionSource.y >= 0 &&
        pollutionSource.x < GRID_SIZE && pollutionSource.y < GRID_SIZE) {
        const pollutantType = POLLUTANT_TYPES[pollutionSource.type];
        const releaseAmount = window.releaseRate || 10;
        
        // Apply type-specific release behavior
        pollutantGrid[pollutionSource.y][pollutionSource.x] += releaseAmount;
        
        // Type-specific initial dispersion
        const { behavior } = pollutantType;
        
        // Handle vertical movement (sinking/floating)
        if (behavior.sinkRate !== 0) {
            const verticalOffset = Math.round(behavior.sinkRate * 2);
            const newRow = Math.max(0, Math.min(GRID_SIZE - 1, pollutionSource.y + verticalOffset));
            if (newRow !== pollutionSource.y) {
                pollutantGrid[newRow][pollutionSource.x] += releaseAmount * 0.3;
            }
        }
        
        // Handle surface spread for floating pollutants (like oil)
        if (behavior.sinkRate < 0) {
            const spreadRadius = Math.abs(Math.round(behavior.sinkRate * 3));
            for (let i = -spreadRadius; i <= spreadRadius; i++) {
                const col = pollutionSource.x + i;
                if (col >= 0 && col < GRID_SIZE) {
                    pollutantGrid[pollutionSource.y][col] += releaseAmount * 0.1;
                }
            }
        }
    }

    // Calculate wind vector components
    const windAngleRad = (window.windDirection || 0) * Math.PI / 180;
    const windVelX = (window.windSpeed || 0.5) * Math.cos(windAngleRad);
    const windVelY = (window.windSpeed || 0.5) * Math.sin(windAngleRad);
    const diffusionRate = window.diffusionRate || 0.1;

    // Advection and Diffusion
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            // Advection
            const prev_r = r - windVelY;
            const prev_c = c - windVelX;
            
            const advectedDensity = getInterpolatedDensity(pollutantGrid, prev_r, prev_c);
            newPollutantGrid[r][c] = advectedDensity;

            // Diffusion
            const diffusionFactor = 0.25 * diffusionRate; // Split among 4 neighbors
            if (r > 0) newPollutantGrid[r-1][c] += pollutantGrid[r][c] * diffusionFactor;
            if (r < GRID_SIZE-1) newPollutantGrid[r+1][c] += pollutantGrid[r][c] * diffusionFactor;
            if (c > 0) newPollutantGrid[r][c-1] += pollutantGrid[r][c] * diffusionFactor;
            if (c < GRID_SIZE-1) newPollutantGrid[r][c+1] += pollutantGrid[r][c] * diffusionFactor;
            newPollutantGrid[r][c] += pollutantGrid[r][c] * (1 - diffusionRate);
        }
    }

    // Apply decay and update grid
    const decayFactor = 0.99;
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            pollutantGrid[r][c] = Math.min(255, newPollutantGrid[r][c] * decayFactor);
        }
    }
}

// Animation loop
function animate() {
    if (!isRunning) {
        return;
    }

    simulateStep();
    window.draw(); // Call the draw function from ui.js
    animationFrameId = requestAnimationFrame(animate);
}

// Initialize simulation
function init() {
    initializeGrid();
    window.getColorForDensity = getColorForDensity; // Expose for ui.js
    window.pollutantGrid = pollutantGrid; // Expose for ui.js
    window.pollutionSource = pollutionSource; // Expose for ui.js
    window.isRunning = isRunning; // Expose for ui.js
    window.animate = animate; // Expose for ui.js
}
