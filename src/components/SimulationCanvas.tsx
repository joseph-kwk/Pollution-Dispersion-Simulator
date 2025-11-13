import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useSimulationStore } from '@/stores/simulationStore';
import { GRID_SIZE, POLLUTANT_TYPES, PollutionSource } from '@/types';
import { FluidDynamics } from '@/physics/FluidDynamics';

export const SimulationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { grid, sources, parameters, isRunning, obstacles, actions } = useSimulationStore();

  // Initialize fluid dynamics engine
  const fluidDynamics = useMemo(() => new FluidDynamics(), []);

  // Color mapping function
  const getColorForDensity = useCallback((density: number, type: keyof typeof POLLUTANT_TYPES = 'CHEMICAL') => {
    const normalizedDensity = Math.min(1, Math.max(0, density / 255));
    const pollutantType = POLLUTANT_TYPES[type];

    // Base fluid color (light blue for water/air)
    const baseR = 235;
    const baseG = 245;
    const baseB = 255;

    if (normalizedDensity === 0) {
      return `rgb(${baseR}, ${baseG}, ${baseB})`;
    }

    const pollutionColor = pollutantType.baseColor;

    // Blend between base fluid color and pollution color based on density
    const r = Math.floor(baseR + (pollutionColor.r - baseR) * normalizedDensity);
    const g = Math.floor(baseG + (pollutionColor.g - baseG) * normalizedDensity);
    const b = Math.floor(baseB + (pollutionColor.b - baseB) * normalizedDensity);
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const density = grid[r][c];
        if (obstacles[r][c]) {
          // Draw obstacles
          ctx.fillStyle = '#666';
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        } else if (density > 0) {
          // Use the type of the nearest active source for coloring
          let nearestType: keyof typeof POLLUTANT_TYPES = 'CHEMICAL';
          let minDistance = Infinity;

          sources.forEach(source => {
            if (source.active) {
              const distance = Math.sqrt((source.x - c) ** 2 + (source.y - r) ** 2);
              if (distance < minDistance) {
                minDistance = distance;
                nearestType = source.type;
              }
            }
          });

          ctx.fillStyle = getColorForDensity(density, nearestType);
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw pollution sources
    sources.forEach((source: PollutionSource) => {
      if (source.active) {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(
          source.x * cellSize + cellSize / 2,
          source.y * cellSize + cellSize / 2,
          cellSize / 3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });
  }, [grid, sources, getColorForDensity, obstacles]);

  // Resize canvas
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const size = Math.min(container.offsetWidth, container.offsetHeight);
    canvas.width = size;
    canvas.height = size;
    draw();
  }, [draw]);

  // Handle canvas click for setting source or obstacle
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const gridX = Math.floor(x / (canvas.width / GRID_SIZE));
    const gridY = Math.floor(y / (canvas.height / GRID_SIZE));

    if (event.ctrlKey) {
      // Ctrl+click to toggle obstacle
      const newObstacles = obstacles.map((row, r) =>
        row.map((cell, c) => (r === gridY && c === gridX) ? !cell : cell)
      );
      actions.setObstacles(newObstacles);
    } else {
      // Regular click to move the first inactive source or add a new one
      const inactiveSourceIndex = sources.findIndex(source => !source.active);
      if (inactiveSourceIndex !== -1) {
        // Activate and move an inactive source
        actions.removeSource(inactiveSourceIndex);
        actions.addSource({
          x: gridX,
          y: gridY,
          type: sources[inactiveSourceIndex]?.type || 'CHEMICAL'
        });
      } else {
        // Add a new source
        actions.addSource({
          x: gridX,
          y: gridY,
          type: 'CHEMICAL'
        });
      }
    }
  }, [actions, sources, obstacles]);

  // Simulation step using fluid dynamics
  const simulateStep = useCallback(() => {
    if (!isRunning) return;

    // Add pollution at sources
    sources.forEach((source: PollutionSource) => {
      if (source.active && source.x >= 0 && source.y >= 0 &&
          source.x < GRID_SIZE && source.y < GRID_SIZE) {
        fluidDynamics.addDensitySource(source.x, source.y, parameters.releaseRate);
      }
    });

    // Step the fluid dynamics simulation
    fluidDynamics.step(parameters);

    // Update the store with the new density grid
    const newGrid = fluidDynamics.getDensity();
    actions.setGrid(newGrid);
  }, [isRunning, sources, parameters, actions, fluidDynamics]);

  // Animation loop
  useEffect(() => {
    if (!isRunning) return;

    const animate = () => {
      simulateStep();
      draw();
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isRunning, simulateStep, draw]);

  // Initial setup
  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Sync obstacles with fluid dynamics
  useEffect(() => {
    fluidDynamics.setObstacles(obstacles);
  }, [fluidDynamics, obstacles]);

  // Reset fluid dynamics when simulation resets
  useEffect(() => {
    if (!isRunning) {
      fluidDynamics.reset();
    }
  }, [fluidDynamics, isRunning]);

  // Redraw when grid changes
  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="simulation-canvas"
      onClick={handleCanvasClick}
      style={{ cursor: 'crosshair' }}
      title="Click to place pollution source, Ctrl+Click to toggle obstacle"
    />
  );
};