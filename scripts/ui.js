// Get DOM elements
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const messageBox = document.getElementById('messageBox');

// UI state
let settingSource = false;

// UI parameters (exposed globally for simulation.js)
window.windDirection = 0;
window.windSpeed = 0.5;
window.diffusionRate = 0.1;
window.releaseRate = 10;

// Canvas sizing
function resizeCanvas() {
    const size = Math.min(canvas.parentElement.offsetWidth, canvas.parentElement.offsetHeight);
    canvas.width = size;
    canvas.height = size;
    window.CELL_SIZE = canvas.width / GRID_SIZE;
    draw();
}

// Draw function
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base water effect
    ctx.fillStyle = 'rgb(235, 245, 255)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw wave pattern
    const time = Date.now() / 1000;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 20) {
        for (let y = 0; y < canvas.height; y += 20) {
            const offsetX = Math.sin(y * 0.02 + time) * 5;
            const offsetY = Math.cos(x * 0.02 + time) * 5;
            ctx.moveTo(x + offsetX, y);
            ctx.lineTo(x + offsetX + 10, y + offsetY);
        }
    }
    ctx.stroke();

    // Draw grid cells with pollution effects
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const density = window.pollutantGrid[r][c];
            if (density > 0) {
                const pollutantType = POLLUTANT_TYPES[window.pollutionSource.type];
                const color = window.getColorForDensity(density, window.pollutionSource.type).color;
                
                // Draw main pollutant
                ctx.fillStyle = color;
                ctx.globalAlpha = Math.min(0.9, density / 255);
                ctx.fillRect(
                    c * window.CELL_SIZE,
                    r * window.CELL_SIZE,
                    window.CELL_SIZE,
                    window.CELL_SIZE
                );
                
                // Add type-specific visual effects
                if (pollutantType.behavior.sinkRate < 0) {
                    // Surface sheen effect for floating pollutants
                    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.3, density / 255)})`;
                    ctx.fillRect(
                        c * window.CELL_SIZE,
                        r * window.CELL_SIZE,
                        window.CELL_SIZE,
                        window.CELL_SIZE / 4
                    );
                }
                
                if (pollutantType.effects.includes('algaeGrowth') && density > 100) {
                    // Add algae effect for organic pollution
                    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
                    ctx.beginPath();
                    ctx.arc(
                        c * window.CELL_SIZE + window.CELL_SIZE / 2,
                        r * window.CELL_SIZE + window.CELL_SIZE / 2,
                        window.CELL_SIZE / 3,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
                
                if (pollutantType.effects.includes('temperature')) {
                    // Heat distortion effect
                    ctx.fillStyle = 'rgba(255, 140, 0, 0.1)';
                    const waveOffset = Math.sin(Date.now() / 1000 + r + c) * window.CELL_SIZE / 4;
                    ctx.fillRect(
                        c * window.CELL_SIZE + waveOffset,
                        r * window.CELL_SIZE,
                        window.CELL_SIZE,
                        window.CELL_SIZE
                    );
                }
                
                ctx.globalAlpha = 1.0;
            }
            
            // Add subtle grid lines for better visualization
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(
                c * window.CELL_SIZE,
                r * window.CELL_SIZE,
                window.CELL_SIZE,
                window.CELL_SIZE
            );
        }
    }

    // Draw source
    if (window.pollutionSource) {
        const type = window.POLLUTANT_TYPES[window.pollutionSource.type];
        ctx.fillStyle = `rgb(${type.baseColor.r}, ${type.baseColor.g}, ${type.baseColor.b})`;
        ctx.beginPath();
        ctx.arc(
            window.pollutionSource.x * window.CELL_SIZE + window.CELL_SIZE / 2,
            window.pollutionSource.y * window.CELL_SIZE + window.CELL_SIZE / 2,
            window.CELL_SIZE / 2,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
}

// Message display
function showMessage(message, duration = 2000) {
    messageBox.textContent = message;
    messageBox.classList.remove('hidden');
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, duration);
}

// Event listeners
document.getElementById('startButton').addEventListener('click', () => {
    if (!window.isRunning) {
        window.isRunning = true;
        window.animate();
        showMessage("Simulation started!", 1500);
    }
});

document.getElementById('pauseButton').addEventListener('click', () => {
    if (window.isRunning) {
        window.isRunning = false;
        cancelAnimationFrame(window.animationFrameId);
        showMessage("Simulation paused.", 1500);
    }
});

document.getElementById('resetButton').addEventListener('click', () => {
    window.isRunning = false;
    cancelAnimationFrame(window.animationFrameId);
    window.init();
    draw();
    showMessage("Simulation reset.", 1500);
});

document.getElementById('setSourceButton').addEventListener('click', () => {
    settingSource = !settingSource;
    const button = document.getElementById('setSourceButton');
    if (settingSource) {
        button.textContent = "Click on canvas to place source";
        button.classList.remove('btn-secondary');
        button.classList.add('bg-purple-500', 'hover:bg-purple-600', 'text-white');
        showMessage("Click on the canvas to set the pollution source.", 3000);
    } else {
        button.textContent = "Set Source";
        button.classList.add('btn-secondary');
        button.classList.remove('bg-purple-500', 'hover:bg-purple-600', 'text-white');
    }
});

canvas.addEventListener('click', (event) => {
    if (settingSource) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        window.pollutionSource = {
            x: Math.floor(x / window.CELL_SIZE),
            y: Math.floor(y / window.CELL_SIZE)
        };
        draw();
        showMessage("Pollution source placed!", 1500);
    }
});

// Slider event listeners
document.getElementById('windDirection').addEventListener('input', (event) => {
    window.windDirection = parseInt(event.target.value);
    document.getElementById('windDirectionValue').textContent = window.windDirection;
});

document.getElementById('windSpeed').addEventListener('input', (event) => {
    window.windSpeed = parseFloat(event.target.value);
    document.getElementById('windSpeedValue').textContent = window.windSpeed.toFixed(1);
});

document.getElementById('diffusionRate').addEventListener('input', (event) => {
    window.diffusionRate = parseFloat(event.target.value);
    document.getElementById('diffusionRateValue').textContent = window.diffusionRate.toFixed(2);
});

document.getElementById('releaseRate').addEventListener('input', (event) => {
    window.releaseRate = parseInt(event.target.value);
    document.getElementById('releaseRateValue').textContent = window.releaseRate;
});

// Pollution type selection
document.getElementById('pollutionTypeSelect').addEventListener('change', (event) => {
    window.pollutionSource.type = event.target.value;
});

// Initialize color legend with tooltips
function initColorLegend() {
    const legend = document.getElementById('colorLegend');
    legend.innerHTML = ''; // Clear existing items

    Object.entries(window.POLLUTANT_TYPES).forEach(([key, type]) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item relative group cursor-help';
        legendItem.style.backgroundColor = `rgb(${type.baseColor.r}, ${type.baseColor.g}, ${type.baseColor.b})`;

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10';
        tooltip.innerHTML = `<strong>${type.name}</strong><br>${type.description}`;

        // Arrow
        const arrow = document.createElement('div');
        arrow.className = 'absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900';

        tooltip.appendChild(arrow);
        legendItem.appendChild(tooltip);
        legend.appendChild(legendItem);
    });
}

// Initialize on window load
window.onload = () => {
    window.init(); // Initialize simulation
    resizeCanvas();
    initColorLegend();
    draw();
    
    // Add resize listener
    window.addEventListener('resize', resizeCanvas);
    
    // Expose draw function for simulation.js
    window.draw = draw;
};
