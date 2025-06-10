// Constants
const GRID_SIZE = 80; // Size of the simulation grid (80x80 cells)
let CELL_SIZE; // Will be calculated based on canvas size

// Simulation state
let pollutantGrid = [];
let newPollutantGrid = [];
let isRunning = false;
let animationFrameId = null;
let pollutionSource = { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) };

// Initialize grids
function initializeGrid() {
    pollutantGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    newPollutantGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
}

// Color mapping function
function getColorForDensity(density) {
    const normalizedDensity = Math.min(1, Math.max(0, density / 255));
    let r, g, b;

    if (normalizedDensity < 0.2) {
        // Light blue to medium blue
        r = Math.floor(66 + (20 * normalizedDensity / 0.2));
        g = Math.floor(135 + (20 * normalizedDensity / 0.2));
        b = Math.floor(245 - (10 * normalizedDensity / 0.2));
    } else if (normalizedDensity < 0.5) {
        // Medium blue to dark blue/purple
        r = Math.floor(86 + (80 * (normalizedDensity - 0.2) / 0.3));
        g = Math.floor(155 - (100 * (normalizedDensity - 0.2) / 0.3));
        b = Math.floor(235 - (150 * (normalizedDensity - 0.2) / 0.3));
    } else if (normalizedDensity < 0.8) {
        // Dark blue/purple to orange
        r = Math.floor(166 + (90 * (normalizedDensity - 0.5) / 0.3));
        g = Math.floor(55 + (150 * (normalizedDensity - 0.5) / 0.3));
        b = Math.floor(85 - (80 * (normalizedDensity - 0.5) / 0.3));
    } else {
        // Orange to red
        r = Math.floor(255);
        g = Math.floor(205 - (205 * (normalizedDensity - 0.8) / 0.2));
        b = Math.floor(5 - (5 * (normalizedDensity - 0.8) / 0.2));
    }
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

    // Add pollutant at source
    if (pollutionSource && pollutionSource.x >= 0 && pollutionSource.y >= 0 &&
        pollutionSource.x < GRID_SIZE && pollutionSource.y < GRID_SIZE) {
        pollutantGrid[pollutionSource.y][pollutionSource.x] += window.releaseRate || 10;
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
