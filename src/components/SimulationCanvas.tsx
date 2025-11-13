import React, { useRef, useEffect, useCallback } from 'react';
import { useSimulationStore } from '@/stores/simulationStore';
import { GRID_SIZE, POLLUTANT_TYPES, PollutionSource } from '@/types';

export const SimulationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { grid, sources, parameters, isRunning, actions } = useSimulationStore();

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
        if (density > 0) {
          ctx.fillStyle = getColorForDensity(density, sources[0]?.type);
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
  }, [grid, sources, getColorForDensity]);

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

  // Handle canvas click for setting source
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

    // Update first source position
    actions.removeSource(0);
    actions.addSource({
      x: gridX,
      y: gridY,
      type: sources[0]?.type || 'CHEMICAL'
    });
  }, [actions, sources]);

  // Simulation step (simplified for now)
  const simulateStep = useCallback(() => {
    if (!isRunning) return;

    const newGrid = grid.map((row: number[]) => [...row]);

    // Add pollution at sources
    sources.forEach((source: PollutionSource) => {
      if (source.active && source.x >= 0 && source.y >= 0 &&
          source.x < GRID_SIZE && source.y < GRID_SIZE) {
        newGrid[source.y][source.x] += parameters.releaseRate;
      }
    });

    // Simple advection and diffusion
    const windAngleRad = (parameters.windDirection * Math.PI) / 180;
    const windVelX = parameters.windSpeed * Math.cos(windAngleRad);
    const windVelY = parameters.windSpeed * Math.sin(windAngleRad);

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (newGrid[r][c] > 0) {
          // Simple advection
          const newR = Math.max(0, Math.min(GRID_SIZE - 1, r + windVelY));
          const newC = Math.max(0, Math.min(GRID_SIZE - 1, c + windVelX));

          // Simple diffusion
          const diffused = newGrid[r][c] * parameters.diffusionRate;
          newGrid[r][c] -= diffused;

          // Distribute to neighbors
          const neighbors = [
            [Math.floor(newR), Math.floor(newC)],
            [Math.floor(newR), Math.ceil(newC)],
            [Math.ceil(newR), Math.floor(newC)],
            [Math.ceil(newR), Math.ceil(newC)]
          ];

          neighbors.forEach(([nr, nc]) => {
            if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
              newGrid[nr][nc] += diffused / neighbors.length;
            }
          });
        }
      }
    }

    // Apply decay
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        newGrid[r][c] = Math.min(255, Math.max(0, newGrid[r][c] * parameters.decayFactor));
      }
    }

    actions.setGrid(newGrid);
  }, [grid, sources, parameters, isRunning, actions]);

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
    />
  );
};