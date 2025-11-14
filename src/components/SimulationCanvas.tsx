import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { GRID_SIZE, POLLUTANT_TYPES, PollutionSource } from '../types';
import { FluidDynamics } from '../physics/FluidDynamics';
import { WebGLRenderer } from '../physics/WebGLRenderer';

export const SimulationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const { grid, sources, parameters, isRunning, obstacles, gpuEnabled, actions } = useSimulationStore();

  const fluidDynamics = useMemo(() => new FluidDynamics(GRID_SIZE), []);
  const rendererRef = useRef<WebGLRenderer | null>(null);

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Clear overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw obstacles
    ctx.fillStyle = '#666';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (obstacles[r][c]) {
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
          cellSize / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
        
        // Add a white border for visibility
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, [sources, obstacles]);

  const draw = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.updateDensity(grid);
      rendererRef.current.draw();
    } else {
      console.warn('WebGLRenderer not initialized yet');
    }
    drawOverlay();
  }, [grid, drawOverlay]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!canvas || !overlayCanvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const size = Math.min(container.offsetWidth, container.offsetHeight);
    canvas.width = size;
    canvas.height = size;
    overlayCanvas.width = size;
    overlayCanvas.height = size;

    if (rendererRef.current) {
      rendererRef.current.resize();
    }
    draw();
  }, [draw]);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      try {
        console.log('Initializing WebGLRenderer...');
        rendererRef.current = new WebGLRenderer(canvasRef.current);
        console.log('WebGLRenderer initialized successfully');
        resizeCanvas();
      } catch (error) {
        console.error("Failed to initialize WebGLRenderer:", error);
      }
    }
  }, [resizeCanvas]);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const gridX = Math.floor(x / (canvas.width / GRID_SIZE));
    const gridY = Math.floor(y / (canvas.height / GRID_SIZE));

    if (event.ctrlKey) {
      const newObstacles = obstacles.map((row, r) =>
        row.map((cell, c) => (r === gridY && c === gridX) ? !cell : cell)
      );
      actions.setObstacles(newObstacles);
    } else {
      const inactiveSourceIndex = sources.findIndex(source => !source.active);
      if (inactiveSourceIndex !== -1) {
        actions.removeSource(inactiveSourceIndex);
        actions.addSource({
          x: gridX,
          y: gridY,
          type: sources[inactiveSourceIndex]?.type || 'CHEMICAL'
        });
      } else {
        actions.addSource({
          x: gridX,
          y: gridY,
          type: 'CHEMICAL'
        });
      }
    }
  }, [actions, sources, obstacles]);

  const simulateStep = useCallback(() => {
    if (!isRunning) return;

    fluidDynamics.step(parameters, sources);
    const newGrid = fluidDynamics.getDensity();
    actions.setGrid(newGrid);
    
    // Log density to verify simulation is working
    const totalDensity = newGrid.reduce((sum, row) => 
      sum + row.reduce((rowSum, cell) => rowSum + cell, 0), 0
    );
    if (totalDensity > 0) {
      console.log('Simulation active - Total density:', totalDensity.toFixed(2));
    }
  }, [isRunning, sources, parameters, actions, fluidDynamics]);

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

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    fluidDynamics.setObstacles(obstacles);
  }, [fluidDynamics, obstacles]);

  useEffect(() => {
    fluidDynamics.setGPUEnabled(gpuEnabled);
  }, [fluidDynamics, gpuEnabled]);

  useEffect(() => {
    if (!isRunning) {
      fluidDynamics.reset();
    }
  }, [fluidDynamics, isRunning]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        className="simulation-canvas"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />
      <canvas
        ref={overlayCanvasRef}
        className="simulation-canvas"
        onClick={handleCanvasClick}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          cursor: 'crosshair',
          pointerEvents: 'auto'
        }}
        title="Click to place pollution source, Ctrl+Click to toggle obstacle"
      />
    </div>
  );
};
