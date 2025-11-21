import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { GRID_SIZE, POLLUTANT_TYPES } from '../types';
import { FluidDynamics } from '../physics/FluidDynamics';
import * as THREE from 'three';

const PARTICLE_COUNT = 5000;
const PARTICLE_SIZE = 0.15;

const getAQIEmoji = (aqi: number) => {
  if (aqi <= 50) return { emoji: '😊', label: 'Good', color: '#10b981' };
  if (aqi <= 100) return { emoji: '😐', label: 'Moderate', color: '#f59e0b' };
  if (aqi <= 150) return { emoji: '😷', label: 'Unhealthy', color: '#f97316' };
  if (aqi <= 200) return { emoji: '😨', label: 'Very Unhealthy', color: '#ef4444' };
  if (aqi <= 300) return { emoji: '☠️', label: 'Hazardous', color: '#991b1b' };
  return { emoji: '💀', label: 'Severe', color: '#7f1d1d' };
};

export const ThreeDSimulationCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const vectorGroupRef = useRef<THREE.Group | null>(null);
  const obstaclesGroupRef = useRef<THREE.Group | null>(null);
  const fluidDynamicsRef = useRef<FluidDynamics | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const planeRef = useRef<THREE.Mesh | null>(null);

  const { sources, parameters, isRunning, gpuEnabled, scientistMode, isDrawingObstacles, obstacles, actions } = useSimulationStore();
  const [currentAQI, setCurrentAQI] = useState(0);

  const initThreeJS = useCallback(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.Fog(0x0a0a1a, 10, 50);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 15, 25);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Grid helper
    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x444444, 0x222222);
    gridHelper.visible = scientistMode;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Vector field group
    const vectorGroup = new THREE.Group();
    vectorGroup.visible = scientistMode;
    scene.add(vectorGroup);
    vectorGroupRef.current = vectorGroup;

    // Obstacles group
    const obstaclesGroup = new THREE.Group();
    scene.add(obstaclesGroup);
    obstaclesGroupRef.current = obstaclesGroup;

    // Interaction plane (invisible)
    const planeGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
    const planeMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);
    planeRef.current = plane;

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // Create particles
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const lifetimes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Random initial positions
      positions[i3] = (Math.random() - 0.5) * GRID_SIZE;
      positions[i3 + 1] = Math.random() * 5;
      positions[i3 + 2] = (Math.random() - 0.5) * GRID_SIZE;

      // Initial colors (light blue)
      colors[i3] = 0.7;
      colors[i3 + 1] = 0.8;
      colors[i3 + 2] = 1.0;

      // Random velocities
      velocities[i3] = (Math.random() - 0.5) * 0.1;
      velocities[i3 + 1] = Math.random() * 0.05;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;

      lifetimes[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));

    const material = new THREE.PointsMaterial({
      size: PARTICLE_SIZE,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // Initialize fluid dynamics
    fluidDynamicsRef.current = new FluidDynamics(GRID_SIZE);
    fluidDynamicsRef.current.setGPUEnabled(gpuEnabled);

    console.log('Three.js scene initialized with', PARTICLE_COUNT, 'particles');
  }, [gpuEnabled]);

  const updateParticles = useCallback(() => {
    if (!particlesRef.current || !fluidDynamicsRef.current) return;

    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const colors = particlesRef.current.geometry.attributes.color.array as Float32Array;
    const velocities = particlesRef.current.geometry.attributes.velocity.array as Float32Array;
    const lifetimes = particlesRef.current.geometry.attributes.lifetime.array as Float32Array;

    const grid = fluidDynamicsRef.current.getDensity();
    const gridU = fluidDynamicsRef.current.getVelocityX();
    const gridV = fluidDynamicsRef.current.getVelocityY();
    const halfGrid = GRID_SIZE / 2;

    // Wind direction in radians (used for initial velocity)
    const windAngle = (parameters.windDirection * Math.PI) / 180;
    const windVelX = parameters.windSpeed * Math.cos(windAngle) * 0.05;
    const windVelZ = parameters.windSpeed * Math.sin(windAngle) * 0.05;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Update lifetime
      lifetimes[i] += 0.01;
      if (lifetimes[i] > 1.0) {
        // Respawn particle at a pollution source
        if (sources.length > 0) {
          const source = sources[Math.floor(Math.random() * sources.length)];
          positions[i3] = source.x - halfGrid + (Math.random() - 0.5) * 2;
          positions[i3 + 1] = Math.random() * 3;
          positions[i3 + 2] = source.y - halfGrid + (Math.random() - 0.5) * 2;
          lifetimes[i] = 0;

          // Reset velocity
          velocities[i3] = windVelX;
          velocities[i3 + 1] = 0.05 + Math.random() * 0.05;
          velocities[i3 + 2] = windVelZ;
        }
      }

      // Get grid position
      const gridX = Math.floor(positions[i3] + halfGrid);
      const gridZ = Math.floor(positions[i3 + 2] + halfGrid);

      // Sample fluid velocity field
      let fluidU = 0;
      let fluidV = 0;
      let density = 0;

      if (gridX >= 0 && gridX < GRID_SIZE && gridZ >= 0 && gridZ < GRID_SIZE) {
        fluidU = gridU[gridZ][gridX];
        fluidV = gridV[gridZ][gridX];
        density = grid[gridZ][gridX];
      }

      // Apply fluid velocity forces (Advection)
      // We blend the particle's current velocity with the fluid velocity
      velocities[i3] += (fluidU * 0.1 - velocities[i3] * 0.02);
      velocities[i3 + 2] += (fluidV * 0.1 - velocities[i3 + 2] * 0.02);

      // Update position
      positions[i3] += velocities[i3];
      positions[i3 + 1] += velocities[i3 + 1];
      positions[i3 + 2] += velocities[i3 + 2];

      // Apply turbulence
      positions[i3] += (Math.random() - 0.5) * 0.02;
      positions[i3 + 2] += (Math.random() - 0.5) * 0.02;

      // Determine dominant pollutant type at this location
      let dominantType = sources.length > 0 ? sources[0].type : 'CHEMICAL';
      if (sources.length > 1) {
        // Find closest source
        let minDist = Infinity;
        sources.forEach(source => {
          const dx = positions[i3] - (source.x - halfGrid);
          const dz = positions[i3 + 2] - (source.y - halfGrid);
          const dist = dx * dx + dz * dz;
          if (dist < minDist) {
            minDist = dist;
            dominantType = source.type;
          }
        });
      }

      // Apply vertical movement based on pollutant properties (Buoyancy/Gravity)
      const pollutantDef = POLLUTANT_TYPES[dominantType];
      // sinkRate > 0 means it sinks (gravity), < 0 means it rises (buoyancy)
      velocities[i3 + 1] -= pollutantDef.behavior.sinkRate * 0.005;
      
      // Floor collision
      if (positions[i3 + 1] < 0) {
        positions[i3 + 1] = 0;
        velocities[i3 + 1] *= -0.5; // Bounce
      }

      // Color based on density and pollutant type
      const normalizedDensity = Math.min(density / 255, 1.0);
      
      // Get base color from pollutant type
      let baseR = 0.5, baseG = 0.7, baseB = 1.0; // Default: clean air (light blue)
      
      if (normalizedDensity > 0.05) { // Only colorize if there's significant pollution
        const color = pollutantDef.baseColor;
        baseR = color.r / 255;
        baseG = color.g / 255;
        baseB = color.b / 255;
      }
      
      // Interpolate from clean air (light blue) to pollutant color based on density
      colors[i3] = baseR * normalizedDensity + 0.5 * (1 - normalizedDensity); // Red
      colors[i3 + 1] = baseG * normalizedDensity + 0.7 * (1 - normalizedDensity); // Green
      colors[i3 + 2] = baseB * normalizedDensity + 1.0 * (1 - normalizedDensity); // Blue

      // Wrap around boundaries
      if (positions[i3] < -halfGrid) positions[i3] = halfGrid;
      if (positions[i3] > halfGrid) positions[i3] = -halfGrid;
      if (positions[i3 + 2] < -halfGrid) positions[i3 + 2] = halfGrid;
      if (positions[i3 + 2] > halfGrid) positions[i3 + 2] = -halfGrid;
      if (positions[i3 + 1] < 0) positions[i3 + 1] = 10;
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    particlesRef.current.geometry.attributes.color.needsUpdate = true;
  }, [sources, parameters]);

  // Update scientist mode visuals
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = scientistMode;
    }
    if (vectorGroupRef.current) {
      vectorGroupRef.current.visible = scientistMode;
      
      // Update vectors if visible
      if (scientistMode) {
        // Clear existing
        while (vectorGroupRef.current.children.length > 0) {
          vectorGroupRef.current.remove(vectorGroupRef.current.children[0]);
        }

        const step = 8; // Every 8th cell
        const halfGrid = GRID_SIZE / 2;
        const windAngle = (parameters.windDirection * Math.PI) / 180;
        // Direction vector
        const dir = new THREE.Vector3(Math.cos(windAngle), 0, Math.sin(windAngle)).normalize();
        const length = Math.max(2, parameters.windSpeed * 3);
        const hex = 0xffff00; // Yellow arrows

        for (let x = 0; x < GRID_SIZE; x += step) {
          for (let z = 0; z < GRID_SIZE; z += step) {
            const origin = new THREE.Vector3(x - halfGrid, 2, z - halfGrid);
            const arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex, length * 0.3, length * 0.15);
            vectorGroupRef.current.add(arrowHelper);
          }
        }
      }
    }
  }, [scientistMode, parameters.windDirection, parameters.windSpeed]);

  // Handle mouse interaction for drawing obstacles
  useEffect(() => {
    if (!containerRef.current || !cameraRef.current || !planeRef.current) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!isDrawingObstacles) return;

      const rect = containerRef.current!.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current!);
      const intersects = raycasterRef.current.intersectObject(planeRef.current!);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        const halfGrid = GRID_SIZE / 2;
        const x = Math.floor(point.x + halfGrid);
        const y = Math.floor(point.z + halfGrid);

        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
          // Toggle obstacle
          if (obstacles[y][x]) {
            actions.removeObstacle(x, y);
          } else {
            actions.addObstacle(x, y);
          }
        }
      }
    };

    containerRef.current.addEventListener('mousedown', handleMouseDown);
    return () => {
      containerRef.current?.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isDrawingObstacles, obstacles, actions]);

  // Update obstacle visuals
  useEffect(() => {
    if (!obstaclesGroupRef.current) return;

    // Clear existing obstacles
    while (obstaclesGroupRef.current.children.length > 0) {
      obstaclesGroupRef.current.remove(obstaclesGroupRef.current.children[0]);
    }

    const geometry = new THREE.BoxGeometry(1, 5, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const halfGrid = GRID_SIZE / 2;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (obstacles[y][x]) {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x - halfGrid + 0.5, 2.5, y - halfGrid + 0.5);
          obstaclesGroupRef.current.add(mesh);
        }
      }
    }

    // Update fluid dynamics engine
    if (fluidDynamicsRef.current) {
      fluidDynamicsRef.current.setObstacles(obstacles);
    }
  }, [obstacles]);

  const animate = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    if (isRunning && fluidDynamicsRef.current) {
      // Run fluid dynamics simulation
      fluidDynamicsRef.current.step(parameters, sources);
      
      // Update particles based on simulation
      updateParticles();

      // Update scene background based on average pollution level
      const grid = fluidDynamicsRef.current.getDensity();
      let totalDensity = 0;
      let cellCount = 0;
      for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
          totalDensity += grid[i][j];
          cellCount++;
        }
      }
      const avgDensity = totalDensity / cellCount;
      const normalizedAvg = Math.min(avgDensity / 255, 1.0);
      
      // Calculate AQI for emoji display - more sensitive to pollution changes
      // Map average density directly to AQI scale (0-500)
      const aqi = Math.min(500, Math.floor(avgDensity * 2));
      setCurrentAQI(aqi);
      
      // Interpolate background from clean (dark blue) to polluted (murky brown/red)
      const cleanR = 0x0a / 255, cleanG = 0x0a / 255, cleanB = 0x1a / 255;
      const pollutedR = 0x3a / 255, pollutedG = 0x1a / 255, pollutedB = 0x1a / 255;
      
      const bgR = cleanR * (1 - normalizedAvg) + pollutedR * normalizedAvg;
      const bgG = cleanG * (1 - normalizedAvg) + pollutedG * normalizedAvg;
      const bgB = cleanB * (1 - normalizedAvg) + pollutedB * normalizedAvg;
      
      sceneRef.current.background = new THREE.Color(bgR, bgG, bgB);
      sceneRef.current.fog = new THREE.Fog(
        new THREE.Color(bgR, bgG, bgB).getHex(),
        10,
        50
      );

      // Rotate camera slightly for better view
      const time = Date.now() * 0.0001;
      cameraRef.current.position.x = Math.sin(time) * 30;
      cameraRef.current.position.z = Math.cos(time) * 30;
      cameraRef.current.lookAt(0, 0, 0);
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [isRunning, sources, parameters, updateParticles]);

  const handleResize = useCallback(() => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  }, []);

  useEffect(() => {
    initThreeJS();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [initThreeJS, handleResize]);

  useEffect(() => {
    animate();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  useEffect(() => {
    if (fluidDynamicsRef.current) {
      fluidDynamicsRef.current.setGPUEnabled(gpuEnabled);
    }
  }, [gpuEnabled]);

  useEffect(() => {
    if (!isRunning && fluidDynamicsRef.current) {
      fluidDynamicsRef.current.reset();
      setCurrentAQI(0);
    }
  }, [isRunning]);

  const aqiInfo = getAQIEmoji(currentAQI);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%)',
      }}
    >
      {/* Air Quality Emoji Overlay - Hidden in Scientist Mode */}
      {isRunning && !scientistMode && (
        <div className="canvas-aqi-indicator">
          <div className="canvas-aqi-emoji" style={{ 
            fontSize: '3rem',
            filter: `drop-shadow(0 0 10px ${aqiInfo.color})`
          }}>
            {aqiInfo.emoji}
          </div>
          <div className="canvas-aqi-label" style={{ color: aqiInfo.color }}>
            {aqiInfo.label}
          </div>
          <div className="canvas-aqi-value" style={{ color: aqiInfo.color }}>
            AQI: {currentAQI}
          </div>
        </div>
      )}
    </div>
  );
};
