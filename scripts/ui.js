// Get DOM elements
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');

// UI state
let settingSource = false;
let tooltips = new Map();

// UI parameters (exposed globally for simulation.js)
window.windDirection = 0;
window.windSpeed = 0.5;
window.diffusionRate = 0.1;
window.releaseRate = 10;

// Initialize tooltips
function initializeTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(element => {
        const tooltipText = element.getAttribute('data-tooltip');
        const tooltipPosition = element.getAttribute('data-tooltip-position');
        const tooltipType = element.getAttribute('data-tooltip-type');
        
        const tooltip = document.createElement('div');
        
        // Set tooltip class based on position
        if (tooltipPosition === 'bottom') {
            tooltip.className = 'tooltip-bottom';
        } else {
            tooltip.className = 'tooltip';
        }
        
        tooltip.textContent = tooltipText;
        element.appendChild(tooltip);
        element.style.position = 'relative';
        
        let tooltipTimeout;
        
        // Show tooltip on mouseenter
        element.addEventListener('mouseenter', () => {
            tooltip.style.opacity = '1';
            tooltip.style.visibility = 'visible';
            
            // Determine duration based on tooltip type
            let duration = 3000; // Default 3 seconds
            if (tooltipType === 'environment') {
                duration = 5000; // 5 seconds for environment tooltips
            }
            
            // Auto-hide after specified duration
            tooltipTimeout = setTimeout(() => {
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
            }, duration);
        });
        
        // Hide tooltip on mouseleave
        element.addEventListener('mouseleave', () => {
            clearTimeout(tooltipTimeout);
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
        });
    });
}

// Show message with modern styling
function showMessage(text, type = 'info', duration = 3000) {
    if (!messageBox) return;
    
    if (messageText) {
        messageText.textContent = text;
    }
    
    messageBox.style.display = 'block';
    messageBox.classList.remove('loading');
    
    // Add type-specific styling
    const messageTitle = messageBox.querySelector('div:first-child');
    if (messageTitle) {
        switch (type) {
            case 'success':
                messageTitle.textContent = 'Success';
                messageBox.style.borderLeft = '4px solid var(--color-success)';
                break;
            case 'warning':
                messageTitle.textContent = 'Warning';
                messageBox.style.borderLeft = '4px solid var(--color-warning)';
                break;
            case 'error':
                messageTitle.textContent = 'Error';
                messageBox.style.borderLeft = '4px solid var(--color-danger)';
                break;
            default:
                messageTitle.textContent = 'Information';
                messageBox.style.borderLeft = '4px solid var(--color-primary)';
        }
    }
    
    if (duration > 0) {
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, duration);
    }
}

// Hide message
function hideMessage() {
    messageBox.style.display = 'none';
}

// Canvas sizing with improved responsive behavior
function resizeCanvas() {
    const container = canvas.parentElement;
    const size = Math.min(container.offsetWidth, container.offsetHeight, 600);
    canvas.width = size;
    canvas.height = size;
    window.CELL_SIZE = canvas.width / GRID_SIZE;
    draw();
}

// Draw function with enhanced modern visuals
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create modern gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#e0f2fe');
    gradient.addColorStop(0.5, '#bae6fd');
    gradient.addColorStop(1, '#7dd3fc');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle animated water pattern
    const time = Date.now() / 2000;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const y = (i * canvas.height / 10) + Math.sin(time + i) * 5;
        ctx.moveTo(0, y);
        for (let x = 0; x <= canvas.width; x += 10) {
            const waveY = y + Math.sin(time + x / 50 + i) * 2;
            ctx.lineTo(x, waveY);
        }
    }
    ctx.stroke();

    // Draw grid cells with enhanced pollution effects
    const currentType = window.pollutionSource.type;
    const pollutantType = window.POLLUTANT_TYPES[currentType];

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const density = window.pollutantGrid[r][c];
            if (density > 0) {
                const x = c * window.CELL_SIZE;
                const y = r * window.CELL_SIZE;
                const normalizedDensity = Math.min(1, density / 255);
                
                // Create radial gradient for pollution cells
                const cellGradient = ctx.createRadialGradient(
                    x + window.CELL_SIZE / 2, y + window.CELL_SIZE / 2, 0,
                    x + window.CELL_SIZE / 2, y + window.CELL_SIZE / 2, window.CELL_SIZE / 2
                );
                
                const color = window.getColorForDensity(density, currentType);
                const rgba = hexToRgba(color, normalizedDensity * 0.9);
                const rgbaLight = hexToRgba(color, normalizedDensity * 0.3);
                
                cellGradient.addColorStop(0, rgba);
                cellGradient.addColorStop(1, rgbaLight);
                
                ctx.fillStyle = cellGradient;
                ctx.fillRect(x, y, window.CELL_SIZE, window.CELL_SIZE);
                
                // Add type-specific visual effects
                addPollutionEffects(ctx, x, y, density, pollutantType, time);
            }
        }
    }

    // Draw pollution source with pulsing effect
    if (window.pollutionSource) {
        const sourceX = window.pollutionSource.x * window.CELL_SIZE;
        const sourceY = window.pollutionSource.y * window.CELL_SIZE;
        const pulse = 0.8 + 0.2 * Math.sin(time * 3);
        
        // Outer glow
        const glowGradient = ctx.createRadialGradient(
            sourceX + window.CELL_SIZE / 2, sourceY + window.CELL_SIZE / 2, 0,
            sourceX + window.CELL_SIZE / 2, sourceY + window.CELL_SIZE / 2, window.CELL_SIZE * 2
        );
        glowGradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
        glowGradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        
        ctx.fillStyle = glowGradient;
        ctx.fillRect(
            sourceX - window.CELL_SIZE, sourceY - window.CELL_SIZE,
            window.CELL_SIZE * 3, window.CELL_SIZE * 3
        );
        
        // Source marker
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.fillRect(sourceX, sourceY, window.CELL_SIZE, window.CELL_SIZE);
        
        // Source icon
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `${window.CELL_SIZE * 0.5}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠', sourceX + window.CELL_SIZE / 2, sourceY + window.CELL_SIZE / 2);
    }
    
    // Draw wind indicator
    drawWindIndicator();
    
    // Reset context state
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
}

// Helper function to convert hex color to rgba
function hexToRgba(hex, alpha) {
    if (hex.startsWith('rgb')) {
        // Extract RGB values from rgb() string
        const matches = hex.match(/\d+/g);
        if (matches && matches.length >= 3) {
            return `rgba(${matches[0]}, ${matches[1]}, ${matches[2]}, ${alpha})`;
        }
    }
    return `rgba(128, 128, 128, ${alpha})`; // fallback
}

// Add pollution-specific visual effects
function addPollutionEffects(ctx, x, y, density, pollutantType, time) {
    const normalizedDensity = Math.min(1, density / 255);
    
    if (pollutantType.behavior.sinkRate < 0) {
        // Surface sheen effect for floating pollutants (oil)
        const shimmer = 0.3 + 0.2 * Math.sin(time * 2 + x / 20);
        ctx.fillStyle = `rgba(255, 255, 255, ${normalizedDensity * shimmer * 0.4})`;
        ctx.fillRect(x, y, window.CELL_SIZE, window.CELL_SIZE / 3);
    }
    
    if (pollutantType.effects.includes('algaeGrowth') && density > 100) {
        // Organic growth effect
        const growth = Math.sin(time + x / 30 + y / 30) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(34, 197, 94, ${normalizedDensity * 0.3 * growth})`;
        ctx.beginPath();
        ctx.arc(
            x + window.CELL_SIZE / 2,
            y + window.CELL_SIZE / 2,
            window.CELL_SIZE / 3 * growth,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
    
    if (pollutantType.effects.includes('temperature')) {
        // Heat distortion effect
        const heatIntensity = normalizedDensity * 0.4;
        const waveOffset = Math.sin(time * 3 + x / 10) * 2;
        ctx.fillStyle = `rgba(255, 140, 0, ${heatIntensity})`;
        ctx.fillRect(x, y + waveOffset, window.CELL_SIZE, window.CELL_SIZE / 4);
    }
}

// Show wind direction indicator
function drawWindIndicator() {
    const size = 60;
    const x = canvas.width - size - 20;
    const y = 20;
    
    // Background circle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Wind arrow
    const angle = (window.windDirection - 90) * Math.PI / 180;
    const centerX = x + size/2;
    const centerY = y + size/2;
    const arrowLength = size/3;
    
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(angle) * arrowLength,
        centerY + Math.sin(angle) * arrowLength
    );
    ctx.stroke();
    
    // Arrow head
    const headAngle1 = angle - Math.PI / 6;
    const headAngle2 = angle + Math.PI / 6;
    const headLength = arrowLength / 3;
    const tipX = centerX + Math.cos(angle) * arrowLength;
    const tipY = centerY + Math.sin(angle) * arrowLength;
    
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
        tipX - Math.cos(headAngle1) * headLength,
        tipY - Math.sin(headAngle1) * headLength
    );
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
        tipX - Math.cos(headAngle2) * headLength,
        tipY - Math.sin(headAngle2) * headLength
    );
    ctx.stroke();
}

// Event handlers and initialization
// Event handlers and initialization
function setupEventHandlers() {
    // Button event listeners
    document.getElementById('startButton').addEventListener('click', () => {
        if (!window.isRunning) {
            window.isRunning = true;
            window.animate();
            showMessage("Simulation started!", 'success', 1500);
        }
    });

    document.getElementById('pauseButton').addEventListener('click', () => {
        if (window.isRunning) {
            window.isRunning = false;
            cancelAnimationFrame(window.animationFrameId);
            showMessage("Simulation paused.", 'info', 1500);
        }
    });

    document.getElementById('resetButton').addEventListener('click', () => {
        window.isRunning = false;
        cancelAnimationFrame(window.animationFrameId);
        window.init();
        draw();
        showMessage("Simulation reset.", 'info', 1500);
    });

    document.getElementById('setSourceButton').addEventListener('click', () => {
        settingSource = !settingSource;
        const button = document.getElementById('setSourceButton');
        if (settingSource) {
            button.innerHTML = '<i data-lucide="crosshair" style="width: 16px; height: 16px;"></i>Click Canvas';
            button.classList.remove('btn-secondary');
            button.classList.add('btn-primary');
            showMessage("Click on the canvas to set the pollution source.", 'info', 3000);
        } else {
            button.innerHTML = '<i data-lucide="map-pin" style="width: 16px; height: 16px;"></i>Set Source';
            button.classList.add('btn-secondary');
            button.classList.remove('btn-primary');
        }
        lucide.createIcons();
    });

    // Canvas click handler
    canvas.addEventListener('click', (event) => {
        if (settingSource) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;

            window.pollutionSource = {
                x: Math.floor(x / window.CELL_SIZE),
                y: Math.floor(y / window.CELL_SIZE),
                type: document.getElementById('pollutionTypeSelect').value
            };
            
            settingSource = false;
            const button = document.getElementById('setSourceButton');
            button.innerHTML = '<i data-lucide="map-pin" style="width: 16px; height: 16px;"></i>Set Source';
            button.classList.add('btn-secondary');
            button.classList.remove('btn-primary');
            lucide.createIcons();
            
            draw();
            showMessage("Pollution source placed!", 'success', 1500);
        }
    });

    // Range input listeners with real-time updates
    document.getElementById('windDirection').addEventListener('input', (event) => {
        window.windDirection = parseInt(event.target.value);
        document.getElementById('windDirectionValue').textContent = window.windDirection + '°';
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
        updateCurrentTypeGradient();
        showMessage(`Changed to ${window.POLLUTANT_TYPES[event.target.value].name}`, 'info', 1500);
    });
}

// Initialize color legend with modern styling
function initColorLegend() {
    const legend = document.getElementById('colorLegend');
    legend.innerHTML = '';
    
    // Create legend items for each pollution type
    Object.entries(window.POLLUTANT_TYPES).forEach(([key, type]) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.style.backgroundColor = `rgb(${type.baseColor.r}, ${type.baseColor.g}, ${type.baseColor.b})`;
        legendItem.setAttribute('data-tooltip', `${type.name}: ${type.description}`);
        
        legend.appendChild(legendItem);
    });

    updateCurrentTypeGradient();
}

// Update density gradient for current pollution type
function updateCurrentTypeGradient() {
    const currentType = window.pollutionSource.type;
    const type = window.POLLUTANT_TYPES[currentType];
    const gradient = document.querySelector('.density-gradient');
    
    if (gradient) {
        gradient.style.background = `linear-gradient(to right, 
            rgba(${type.baseColor.r}, ${type.baseColor.g}, ${type.baseColor.b}, 0.3), 
            rgba(${type.baseColor.r}, ${type.baseColor.g}, ${type.baseColor.b}, 0.6), 
            rgba(${type.baseColor.r}, ${type.baseColor.g}, ${type.baseColor.b}, 0.9)
        )`;
    }
}

// Initialize on window load
window.addEventListener('load', () => {
    // Initialize simulation
    if (typeof window.init === 'function') {
        window.init();
    }
    
    // Initialize tooltips
    initializeTooltips();
    
    // Set initial pollution type
    const typeSelect = document.getElementById('pollutionTypeSelect');
    if (typeSelect && window.pollutionSource) {
        window.pollutionSource.type = typeSelect.value;
    }
    
    // Initialize GPU
    if (typeof initializeGPU === 'function') {
        initializeGPU(canvas);
    }
    
    // Setup UI
    setupEventHandlers();
    resizeCanvas();
    initColorLegend();
    draw();
    
    // Add resize listener
    window.addEventListener('resize', resizeCanvas);
    
    // Expose draw function for simulation.js
    window.draw = draw;
});
