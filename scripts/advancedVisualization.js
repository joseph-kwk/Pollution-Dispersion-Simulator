/**
 * Advanced Visualization and Analytics Module
 * Provides scientific-grade visualization and data analysis capabilities
 */

class AdvancedVisualization {
    constructor(canvas, simulation) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.simulation = simulation;
        this.animationId = null;
        
        // Visualization modes
        this.modes = {
            CONCENTRATION: 'concentration',
            VELOCITY_FIELD: 'velocity',
            STREAMLINES: 'streamlines',
            PARTICLE_TRACES: 'particles',
            ISOTHERMS: 'isotherms',
            RISK_ZONES: 'risk',
            MULTI_LAYER: 'multi'
        };
        
        this.currentMode = this.modes.CONCENTRATION;
        this.layerVisibility = {
            pollutant: true,
            velocity: false,
            streamlines: false,
            particles: false,
            grid: false,
            bathymetry: true,
            monitoring: true
        };
        
        // Visualization parameters
        this.colorMaps = {
            viridis: this.generateViridisColorMap(),
            plasma: this.generatePlasmaColorMap(),
            turbo: this.generateTurboColorMap(),
            custom: this.generateCustomColorMap()
        };
        
        this.currentColorMap = 'viridis';
        this.contourLevels = 10;
        this.arrowDensity = 8;
        this.particleCount = 500;
        
        // Analytics
        this.analytics = new DispersionAnalytics();
        this.realTimeMetrics = {};
        this.historicalData = [];
        
        this.initializeVisualization();
    }
    
    initializeVisualization() {
        this.setupOffscreenCanvas();
        this.setupParticleSystem();
        this.setupStreamlineTracer();
        this.setupContourExtractor();
        this.createVisualizationControls();
    }
    
    setupOffscreenCanvas() {
        // High-resolution rendering buffer
        this.offscreenCanvas = new OffscreenCanvas(
            this.canvas.width * 2, 
            this.canvas.height * 2
        );
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    }
    
    setupParticleSystem() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.simulation.gridSize,
                y: Math.random() * this.simulation.gridSize,
                history: [],
                age: 0,
                maxAge: 100 + Math.random() * 200
            });
        }
    }
    
    setupStreamlineTracer() {
        this.streamlines = [];
        this.streamlineSeeds = this.generateStreamlineSeeds();
    }
    
    setupContourExtractor() {
        this.contourExtractor = new ContourExtractor();
    }
    
    // Main rendering function
    render() {
        this.clearCanvas();
        
        switch (this.currentMode) {
            case this.modes.CONCENTRATION:
                this.renderConcentrationField();
                break;
            case this.modes.VELOCITY_FIELD:
                this.renderVelocityField();
                break;
            case this.modes.STREAMLINES:
                this.renderStreamlines();
                break;
            case this.modes.PARTICLE_TRACES:
                this.renderParticleTraces();
                break;
            case this.modes.ISOTHERMS:
                this.renderIsotherms();
                break;
            case this.modes.RISK_ZONES:
                this.renderRiskZones();
                break;
            case this.modes.MULTI_LAYER:
                this.renderMultiLayer();
                break;
        }
        
        // Always render overlays
        this.renderOverlays();
        this.renderAnalytics();
        this.renderLegend();
        
        this.animationId = requestAnimationFrame(() => this.render());
    }
    
    renderConcentrationField() {
        const imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        const gridSize = this.simulation.gridSize;
        const cellWidth = this.canvas.width / gridSize;
        const cellHeight = this.canvas.height / gridSize;
        
        // High-quality interpolation for smooth visualization
        for (let x = 0; x < this.canvas.width; x++) {
            for (let y = 0; y < this.canvas.height; y++) {
                const gridX = x / cellWidth;
                const gridY = y / cellHeight;
                
                const concentration = this.interpolateConcentration(gridX, gridY);
                const normalizedConc = Math.min(1, concentration / 255);
                
                const color = this.getColorFromMap(normalizedConc, this.currentColorMap);
                const pixelIndex = (y * this.canvas.width + x) * 4;
                
                data[pixelIndex] = color.r;
                data[pixelIndex + 1] = color.g;
                data[pixelIndex + 2] = color.b;
                data[pixelIndex + 3] = 255;
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
        
        // Add contour lines
        if (this.layerVisibility.grid) {
            this.renderContourLines();
        }
    }
    
    renderVelocityField() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 1;
        
        const step = Math.floor(this.simulation.gridSize / this.arrowDensity);
        const scale = 50; // Arrow length scale
        
        for (let i = 0; i < this.simulation.gridSize; i += step) {
            for (let j = 0; j < this.simulation.gridSize; j += step) {
                const velocity = this.simulation.getVelocityAt(i, j);
                if (velocity.magnitude > 0.01) {
                    const x = (j / this.simulation.gridSize) * this.canvas.width;
                    const y = (i / this.simulation.gridSize) * this.canvas.height;
                    
                    this.drawVelocityArrow(x, y, velocity.u * scale, velocity.v * scale);
                }
            }
        }
    }
    
    renderStreamlines() {
        this.updateStreamlines();
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.lineWidth = 2;
        
        this.streamlines.forEach(streamline => {
            if (streamline.points.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(streamline.points[0].x, streamline.points[0].y);
                
                for (let i = 1; i < streamline.points.length; i++) {
                    this.ctx.lineTo(streamline.points[i].x, streamline.points[i].y);
                }
                
                this.ctx.stroke();
            }
        });
    }
    
    renderParticleTraces() {
        this.updateParticles();
        
        this.particles.forEach(particle => {
            this.ctx.strokeStyle = `rgba(255, 255, 0, ${1 - particle.age / particle.maxAge})`;
            this.ctx.lineWidth = 1;
            
            if (particle.history.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(particle.history[0].x, particle.history[0].y);
                
                for (let i = 1; i < particle.history.length; i++) {
                    this.ctx.lineTo(particle.history[i].x, particle.history[i].y);
                }
                
                this.ctx.stroke();
            }
            
            // Draw particle
            this.ctx.fillStyle = 'yellow';
            this.ctx.beginPath();
            this.ctx.arc(
                (particle.x / this.simulation.gridSize) * this.canvas.width,
                (particle.y / this.simulation.gridSize) * this.canvas.height,
                2, 0, Math.PI * 2
            );
            this.ctx.fill();
        });
    }
    
    renderIsotherms() {
        const contours = this.contourExtractor.extract(
            this.simulation.pollutantGrid,
            this.contourLevels
        );
        
        contours.forEach((contour, level) => {
            const intensity = level / this.contourLevels;
            this.ctx.strokeStyle = `rgba(255, ${255 * (1 - intensity)}, 0, 0.8)`;
            this.ctx.lineWidth = 2;
            
            contour.forEach(line => {
                this.ctx.beginPath();
                this.ctx.moveTo(line[0].x, line[0].y);
                for (let i = 1; i < line.length; i++) {
                    this.ctx.lineTo(line[i].x, line[i].y);
                }
                this.ctx.stroke();
            });
        });
    }
    
    renderRiskZones() {
        const riskZones = this.analytics.calculateRiskZones(this.simulation.pollutantGrid);
        
        riskZones.forEach(zone => {
            const alpha = zone.riskLevel * 0.3;
            this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
            
            this.ctx.beginPath();
            this.ctx.arc(
                (zone.x / this.simulation.gridSize) * this.canvas.width,
                (zone.y / this.simulation.gridSize) * this.canvas.height,
                zone.radius,
                0, Math.PI * 2
            );
            this.ctx.fill();
        });
    }
    
    renderMultiLayer() {
        // Render all enabled layers
        if (this.layerVisibility.pollutant) {
            this.renderConcentrationField();
        }
        
        if (this.layerVisibility.velocity) {
            this.renderVelocityField();
        }
        
        if (this.layerVisibility.streamlines) {
            this.renderStreamlines();
        }
        
        if (this.layerVisibility.particles) {
            this.renderParticleTraces();
        }
    }
    
    renderOverlays() {
        // Bathymetry contours
        if (this.layerVisibility.bathymetry) {
            this.renderBathymetryContours();
        }
        
        // Monitoring stations
        if (this.layerVisibility.monitoring) {
            this.renderMonitoringStations();
        }
        
        // Scale bar and north arrow
        this.renderScaleBar();
        this.renderNorthArrow();
    }
    
    renderAnalytics() {
        this.updateRealTimeMetrics();
        
        // Analytics overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 200, 150);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('Real-time Analytics', 20, 30);
        this.ctx.fillText(`Max Concentration: ${this.realTimeMetrics.maxConcentration.toFixed(2)}`, 20, 50);
        this.ctx.fillText(`Dispersion Rate: ${this.realTimeMetrics.dispersionRate.toFixed(3)}`, 20, 70);
        this.ctx.fillText(`Affected Area: ${this.realTimeMetrics.affectedArea.toFixed(1)} km²`, 20, 90);
        this.ctx.fillText(`Risk Level: ${this.realTimeMetrics.riskLevel}`, 20, 110);
        this.ctx.fillText(`Forecast Confidence: ${(this.realTimeMetrics.confidence * 100).toFixed(1)}%`, 20, 130);
    }
    
    renderLegend() {
        const legendWidth = 200;
        const legendHeight = 30;
        const x = this.canvas.width - legendWidth - 20;
        const y = this.canvas.height - legendHeight - 20;
        
        // Legend background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(x, y, legendWidth, legendHeight);
        
        // Color gradient
        const gradient = this.ctx.createLinearGradient(x + 10, y, x + legendWidth - 10, y);
        this.addColorStopsToGradient(gradient, this.currentColorMap);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x + 10, y + 5, legendWidth - 20, 10);
        
        // Labels
        this.ctx.fillStyle = 'white';
        this.ctx.font = '10px Arial';
        this.ctx.fillText('0', x + 10, y + 28);
        this.ctx.fillText('Max', x + legendWidth - 30, y + 28);
    }
    
    // Color map generation
    generateViridisColorMap() {
        return [
            { r: 68, g: 1, b: 84 },
            { r: 59, g: 82, b: 139 },
            { r: 33, g: 145, b: 140 },
            { r: 94, g: 201, b: 98 },
            { r: 253, g: 231, b: 37 }
        ];
    }
    
    generatePlasmaColorMap() {
        return [
            { r: 13, g: 8, b: 135 },
            { r: 75, g: 3, b: 161 },
            { r: 125, g: 3, b: 168 },
            { r: 168, g: 34, b: 150 },
            { r: 208, g: 73, b: 123 },
            { r: 240, g: 120, b: 87 },
            { r: 253, g: 180, b: 47 },
            { r: 240, g: 249, b: 33 }
        ];
    }
    
    generateTurboColorMap() {
        return [
            { r: 48, g: 18, b: 59 },
            { r: 61, g: 82, b: 161 },
            { r: 72, g: 146, b: 165 },
            { r: 114, g: 197, b: 122 },
            { r: 179, g: 226, b: 81 },
            { r: 253, g: 231, b: 37 }
        ];
    }
    
    generateCustomColorMap() {
        // Pollution-specific color map
        return [
            { r: 240, g: 248, b: 255 }, // Clean water (light blue)
            { r: 173, g: 216, b: 230 }, // Light pollution
            { r: 255, g: 255, b: 0 },   // Moderate pollution (yellow)
            { r: 255, g: 165, b: 0 },   // High pollution (orange)
            { r: 255, g: 0, b: 0 },     // Critical pollution (red)
            { r: 139, g: 0, b: 0 }      // Extreme pollution (dark red)
        ];
    }
    
    getColorFromMap(value, mapName) {
        const colorMap = this.colorMaps[mapName];
        const scaledValue = value * (colorMap.length - 1);
        const index = Math.floor(scaledValue);
        const fraction = scaledValue - index;
        
        if (index >= colorMap.length - 1) {
            return colorMap[colorMap.length - 1];
        }
        
        const color1 = colorMap[index];
        const color2 = colorMap[index + 1];
        
        return {
            r: Math.round(color1.r + (color2.r - color1.r) * fraction),
            g: Math.round(color1.g + (color2.g - color1.g) * fraction),
            b: Math.round(color1.b + (color2.b - color1.b) * fraction)
        };
    }
    
    // Analytics and metrics
    updateRealTimeMetrics() {
        this.realTimeMetrics = this.analytics.calculateRealTimeMetrics(
            this.simulation.pollutantGrid,
            this.simulation.velocityField,
            this.simulation.environmentalData
        );
        
        this.historicalData.push({
            timestamp: Date.now(),
            metrics: { ...this.realTimeMetrics }
        });
        
        // Keep only last 1000 data points
        if (this.historicalData.length > 1000) {
            this.historicalData.shift();
        }
    }
    
    // Export capabilities
    exportVisualization(format = 'png') {
        switch (format) {
            case 'png':
                return this.canvas.toDataURL('image/png');
            case 'svg':
                return this.exportToSVG();
            case 'data':
                return this.exportSimulationData();
            default:
                return this.canvas.toDataURL('image/png');
        }
    }
    
    exportToSVG() {
        // Create SVG representation of current visualization
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', this.canvas.width);
        svg.setAttribute('height', this.canvas.height);
        
        // Add visualization elements to SVG
        // ... (detailed SVG export implementation)
        
        return new XMLSerializer().serializeToString(svg);
    }
    
    exportSimulationData() {
        return {
            timestamp: new Date().toISOString(),
            gridSize: this.simulation.gridSize,
            pollutantData: this.simulation.pollutantGrid,
            velocityData: this.simulation.velocityField,
            environmentalConditions: this.simulation.environmentalData,
            analytics: this.realTimeMetrics,
            historicalMetrics: this.historicalData
        };
    }
    
    // Interactive features
    setupInteractions() {
        this.canvas.addEventListener('click', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width;
            const y = (event.clientY - rect.top) / rect.height;
            
            this.onCanvasClick(x, y);
        });
        
        this.canvas.addEventListener('mousemove', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width;
            const y = (event.clientY - rect.top) / rect.height;
            
            this.onCanvasHover(x, y);
        });
    }
    
    onCanvasClick(x, y) {
        // Handle click events (e.g., place monitoring stations, sample points)
        const gridX = Math.floor(x * this.simulation.gridSize);
        const gridY = Math.floor(y * this.simulation.gridSize);
        
        const concentration = this.simulation.pollutantGrid[gridY][gridX];
        const velocity = this.simulation.getVelocityAt(gridY, gridX);
        
        this.showDataTooltip(x, y, {
            concentration,
            velocity,
            coordinates: { gridX, gridY }
        });
    }
    
    onCanvasHover(x, y) {
        // Update real-time data display on hover
        this.updateHoverInfo(x, y);
    }
    
    showDataTooltip(x, y, data) {
        // Create and show tooltip with detailed data
        console.log('Data at clicked location:', data);
    }
}

// Dispersion Analytics Class
class DispersionAnalytics {
    calculateRealTimeMetrics(pollutantGrid, velocityField, environmentalData) {
        const maxConcentration = this.getMaxConcentration(pollutantGrid);
        const dispersionRate = this.calculateDispersionRate(pollutantGrid);
        const affectedArea = this.calculateAffectedArea(pollutantGrid);
        const riskLevel = this.assessRiskLevel(maxConcentration, affectedArea);
        const confidence = this.calculateForecastConfidence(environmentalData);
        
        return {
            maxConcentration,
            dispersionRate,
            affectedArea,
            riskLevel,
            confidence
        };
    }
    
    getMaxConcentration(grid) {
        let max = 0;
        for (let i = 0; i < grid.length; i++) {
            for (let j = 0; j < grid[i].length; j++) {
                max = Math.max(max, grid[i][j]);
            }
        }
        return max;
    }
    
    calculateDispersionRate(grid) {
        // Calculate rate of change in pollution spread
        // Implementation would compare with previous frames
        return 0.15; // Placeholder
    }
    
    calculateAffectedArea(grid) {
        let affectedCells = 0;
        const threshold = 1; // Minimum concentration to consider "affected"
        
        for (let i = 0; i < grid.length; i++) {
            for (let j = 0; j < grid[i].length; j++) {
                if (grid[i][j] > threshold) {
                    affectedCells++;
                }
            }
        }
        
        // Convert to km² (assuming each cell represents 100m²)
        return (affectedCells * 0.01);
    }
    
    assessRiskLevel(concentration, area) {
        if (concentration > 200 || area > 50) return 'CRITICAL';
        if (concentration > 100 || area > 20) return 'HIGH';
        if (concentration > 50 || area > 10) return 'MODERATE';
        return 'LOW';
    }
    
    calculateForecastConfidence(environmentalData) {
        // Assess confidence based on data quality and weather stability
        let confidence = 1.0;
        
        if (!environmentalData || !environmentalData.weather) {
            confidence *= 0.5; // Reduced confidence without real weather data
        }
        
        return confidence;
    }
    
    calculateRiskZones(grid) {
        const zones = [];
        const threshold = 100;
        
        for (let i = 0; i < grid.length; i++) {
            for (let j = 0; j < grid[i].length; j++) {
                if (grid[i][j] > threshold) {
                    zones.push({
                        x: j,
                        y: i,
                        riskLevel: Math.min(1, grid[i][j] / 255),
                        radius: Math.sqrt(grid[i][j] / 255) * 20
                    });
                }
            }
        }
        
        return zones;
    }
}

// Contour Extraction Class
class ContourExtractor {
    extract(grid, levels) {
        const contours = [];
        const maxValue = Math.max(...grid.flat());
        
        for (let level = 1; level <= levels; level++) {
            const threshold = (level / levels) * maxValue;
            const contour = this.marchingSquares(grid, threshold);
            contours.push(contour);
        }
        
        return contours;
    }
    
    marchingSquares(grid, threshold) {
        // Simplified marching squares algorithm
        const contour = [];
        
        for (let i = 0; i < grid.length - 1; i++) {
            for (let j = 0; j < grid[i].length - 1; j++) {
                const square = [
                    grid[i][j] > threshold ? 1 : 0,
                    grid[i][j + 1] > threshold ? 1 : 0,
                    grid[i + 1][j + 1] > threshold ? 1 : 0,
                    grid[i + 1][j] > threshold ? 1 : 0
                ];
                
                const config = square[0] + square[1] * 2 + square[2] * 4 + square[3] * 8;
                
                if (config !== 0 && config !== 15) {
                    const line = this.getContourLine(i, j, config);
                    if (line.length > 0) {
                        contour.push(line);
                    }
                }
            }
        }
        
        return contour;
    }
    
    getContourLine(i, j, config) {
        // Return line segments based on marching squares configuration
        // Simplified implementation
        return [
            { x: j * 5, y: i * 5 },
            { x: (j + 1) * 5, y: (i + 1) * 5 }
        ];
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdvancedVisualization, DispersionAnalytics, ContourExtractor };
} else {
    window.AdvancedVisualization = AdvancedVisualization;
    window.DispersionAnalytics = DispersionAnalytics;
    window.ContourExtractor = ContourExtractor;
}
