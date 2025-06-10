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

    // Draw grid cells
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const density = window.pollutantGrid[r][c];
            if (density > 0) {
                ctx.fillStyle = window.getColorForDensity(density);
                ctx.fillRect(
                    c * window.CELL_SIZE,
                    r * window.CELL_SIZE,
                    window.CELL_SIZE,
                    window.CELL_SIZE
                );
            }
        }
    }

    // Draw source
    if (window.pollutionSource) {
        ctx.fillStyle = 'red';
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

// Initialize color legend
function initColorLegend() {
    const legend = document.getElementById('colorLegend');
    const steps = 5;
    for (let i = 0; i < steps; i++) {
        const density = (255 * i) / (steps - 1);
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.style.backgroundColor = window.getColorForDensity(density);
        legend.appendChild(div);
    }
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
