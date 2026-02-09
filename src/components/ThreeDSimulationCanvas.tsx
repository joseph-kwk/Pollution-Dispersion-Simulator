import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { GRID_SIZE, POLLUTANT_TYPES } from '../types';
import { FluidDynamics } from '../physics/FluidDynamics';
import * as THREE from 'three';
// @ts-ignore
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
// @ts-ignore
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
// @ts-ignore
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { Camera, Play, Pause, RotateCcw } from 'lucide-react';
import { SimulationCommentary } from './SimulationCommentary';

const PARTICLE_COUNT = 15000; // Increased for better volume
const PARTICLE_SIZE = 4.0; // Much larger for smoke effect

// Helper to create a soft smoke-like texture
const createSmokeTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Radial gradient for soft puff
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // Bright center
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Transparent edge

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);

  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
};

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
  const composerRef = useRef<EffectComposer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const vectorGroupRef = useRef<THREE.Group | null>(null);
  const obstaclesGroupRef = useRef<THREE.Group | null>(null);
  const fluidDynamicsRef = useRef<FluidDynamics | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const planeRef = useRef<THREE.Mesh | null>(null);

  // Throttle store updates
  const frameCounterRef = useRef<number>(0);

  const { sources, parameters, isRunning, gpuEnabled, scientistMode, isDrawingObstacles, obstacles, dynamicWeather, actions } = useSimulationStore();
  const [currentAQI, setCurrentAQI] = useState(0);

  const captureScreenshot = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    // Render one more frame to ensure latest state
    rendererRef.current.render(sceneRef.current, cameraRef.current);

    // Get the canvas as data URL
    const canvas = rendererRef.current.domElement;
    const dataURL = canvas.toDataURL('image/png');

    // Download it
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `pollution-simulation-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const initThreeJS = useCallback(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.Fog(0x0a0a1a, 10, 60);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 20, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Post-processing (Bloom)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(containerRef.current.clientWidth, containerRef.current.clientHeight),
      1.5,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    // Adjust bloom parameters for aesthetics
    bloomPass.strength = 0.8; // Reduced slighty for smoke clarity
    bloomPass.radius = 0.5;
    bloomPass.threshold = 0.2;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

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
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // Create particles
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const lifetimes = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT); // Per-particle size

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Random initial positions
      positions[i3] = (Math.random() - 0.5) * GRID_SIZE;
      positions[i3 + 1] = Math.random() * 5;
      positions[i3 + 2] = (Math.random() - 0.5) * GRID_SIZE;

      // Initial colors (light blue)
      colors[i3] = 0.1;
      colors[i3 + 1] = 0.3;
      colors[i3 + 2] = 0.5;

      // Random velocities
      velocities[i3] = (Math.random() - 0.5) * 0.1;
      velocities[i3 + 1] = Math.random() * 0.05;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;

      lifetimes[i] = Math.random();
      sizes[i] = 1.0; // Initial scale
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute('pSize', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material for per-particle sizing or standard PointsMaterial
    // Using standard PointsMaterial with size attenuation is easier but uniform size.
    // To have variable size per particle efficiently without custom shader, we can use simple size attenuation
    // but typically Points have one 'size' uniform. 
    // However, for smoke, consistent large puffs work well. We'll stick to PointsMaterial with a texture.

    const smokeTexture = createSmokeTexture();

    const material = new THREE.PointsMaterial({
      size: PARTICLE_SIZE,
      map: smokeTexture || undefined, // Use texture if generated
      vertexColors: true,
      transparent: true,
      opacity: 0.15, // Low opacity for accumulation effect
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

    console.log('Three.js scene initialized with', PARTICLE_COUNT, 'smoke particles');
  }, [gpuEnabled]);

  // Handle Medium changes (Background, Fog, and Grid Visibility)
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    if (parameters.medium === 'water') {
      // Deep aquatic blue
      scene.background = new THREE.Color(0x001a2e);
      scene.fog = new THREE.Fog(0x001a2e, 10, 80);
    } else {
      // Midnight air
      scene.background = new THREE.Color(0x0a0a1a);
      scene.fog = new THREE.Fog(0x0a0a1a, 10, 60);
    }
  }, [parameters.medium]);

  // Adjust particle visibility based on modes
  useEffect(() => {
    if (particlesRef.current) {
      const material = particlesRef.current.material as THREE.PointsMaterial;
      // Dim particles in Scientist Mode to see vectors clearly
      material.opacity = scientistMode ? 0.05 : 0.15; // Even lower in scientist mode
      material.size = scientistMode ? PARTICLE_SIZE * 0.7 : PARTICLE_SIZE;
      material.needsUpdate = true;
    }
  }, [scientistMode]);

  const updateParticles = useCallback((currentWindDir: number, currentWindSpeed: number) => {
    if (!particlesRef.current || !fluidDynamicsRef.current) return;

    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const colors = particlesRef.current.geometry.attributes.color.array as Float32Array;
    const velocities = particlesRef.current.geometry.attributes.velocity.array as Float32Array;
    const lifetimes = particlesRef.current.geometry.attributes.lifetime.array as Float32Array;
    // We aren't using pSize attribute with standard material, but we update positions/colors.

    const grid = fluidDynamicsRef.current.getDensity();
    const gridU = fluidDynamicsRef.current.getVelocityX();
    const gridV = fluidDynamicsRef.current.getVelocityY();
    const halfGrid = GRID_SIZE / 2;

    // Wind direction in radians (used for initial velocity)
    const windAngle = (currentWindDir * Math.PI) / 180;
    const windVelX = currentWindSpeed * Math.cos(windAngle) * 0.05;
    const windVelZ = currentWindSpeed * Math.sin(windAngle) * 0.05;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Update lifetime
      lifetimes[i] += 0.01;

      // Improve respawn logic to create continuous flow
      if (lifetimes[i] > 1.0 || positions[i3 + 1] < 0) {
        if (sources.length > 0) {
          const source = sources[Math.floor(Math.random() * sources.length)];
          // Spawn in a small radius around source
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 1.5;
          positions[i3] = source.x - halfGrid + Math.cos(angle) * r;
          positions[i3 + 1] = 1.0 + Math.random(); // Start slighty above ground
          positions[i3 + 2] = source.y - halfGrid + Math.sin(angle) * r;

          lifetimes[i] = 0;

          // Initial velocity matches wind + upward thermal
          velocities[i3] = windVelX + (Math.random() - 0.5) * 0.02;
          velocities[i3 + 1] = 0.05 + Math.random() * 0.05; // Thermal rise
          velocities[i3 + 2] = windVelZ + (Math.random() - 0.5) * 0.02;
        } else {
          // Ambient background dust if no sources
          positions[i3] = (Math.random() - 0.5) * GRID_SIZE;
          positions[i3 + 1] = Math.random() * 10;
          positions[i3 + 2] = (Math.random() - 0.5) * GRID_SIZE;
          lifetimes[i] = 0;
        }
      }

      // Get grid position
      const gridX = Math.floor(positions[i3] + halfGrid);
      const gridZ = Math.floor(positions[i3 + 2] + halfGrid);

      // Fluid dynamics advection
      let fluidU = 0, fluidV = 0, density = 0;
      if (gridX >= 0 && gridX < GRID_SIZE && gridZ >= 0 && gridZ < GRID_SIZE) {
        fluidU = gridU[gridZ][gridX];
        fluidV = gridV[gridZ][gridX];
        density = grid[gridZ][gridX];
      }

      // Advection: Particles follow flow
      velocities[i3] += (fluidU * 0.15 - velocities[i3] * 0.02);
      velocities[i3 + 2] += (fluidV * 0.15 - velocities[i3 + 2] * 0.02);

      // Movement
      positions[i3] += velocities[i3];
      positions[i3 + 1] += velocities[i3 + 1];
      positions[i3 + 2] += velocities[i3 + 2];

      // Buoyancy/Gravity based on pollutant type
      let dominantType = sources.length > 0 ? sources[0].type : 'CO2';
      // (Simplified source finding for perf)
      const pollutantDef = POLLUTANT_TYPES[dominantType];
      velocities[i3 + 1] -= pollutantDef.behavior.sinkRate * 0.003;

      // Floor interaction
      if (positions[i3 + 1] < 0.1) {
        positions[i3 + 1] = 0.1;
        velocities[i3 + 1] *= -0.2; // Damping bounce
      }

      // Coloring Logic
      // Normalize density 0-255 maps to 0-1 opacity/intensity
      const normalizedDensity = Math.min(density / 150, 1.0);

      if (normalizedDensity > 0.01) {
        const base = pollutantDef.baseColor;
        // Tint based on density: White (low) -> Color (high)
        // Actually usually Smoke is Thin (Alpha low) -> Thick (Alpha high)
        // With additive blending, we want Bright colors.

        // Interpolate white -> baseColor
        const r = 1.0 * (1 - normalizedDensity) + (base.r / 255) * normalizedDensity;
        const g = 1.0 * (1 - normalizedDensity) + (base.g / 255) * normalizedDensity;
        const b = 1.0 * (1 - normalizedDensity) + (base.b / 255) * normalizedDensity;

        colors[i3] = r;
        colors[i3 + 1] = g;
        colors[i3 + 2] = b;
      } else {
        // Faint ambient dust
        colors[i3] = 0.05;
        colors[i3 + 1] = 0.05;
        colors[i3 + 2] = 0.1;
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    particlesRef.current.geometry.attributes.color.needsUpdate = true;
  }, [sources]);

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

  const obstaclesRef = useRef(obstacles);

  // Keep obstaclesRef in sync
  useEffect(() => {
    obstaclesRef.current = obstacles;
  }, [obstacles]);

  // Handle mouse interaction for drawing obstacles
  useEffect(() => {
    if (!containerRef.current || !cameraRef.current || !planeRef.current) return;

    let isDragging = false;
    let dragMode: 'add' | 'remove' | null = null;

    const getGridPos = (event: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      mouseRef.current.set(x, y);
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current!);
      const intersects = raycasterRef.current.intersectObject(planeRef.current!);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        const halfGrid = GRID_SIZE / 2;
        const gridX = Math.floor(point.x + halfGrid);
        const gridY = Math.floor(point.z + halfGrid);
        return { x: gridX, y: gridY };
      }
      return null;
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!isDrawingObstacles) return;
      isDragging = true;

      const pos = getGridPos(event);
      if (pos && pos.x >= 0 && pos.x < GRID_SIZE && pos.y >= 0 && pos.y < GRID_SIZE) {
        // Determine mode based on starting cell, using Ref to avoid stale state
        dragMode = obstaclesRef.current[pos.y][pos.x] ? 'remove' : 'add';

        // Execute initial action
        if (dragMode === 'add') actions.addObstacle(pos.x, pos.y);
        else actions.removeObstacle(pos.x, pos.y);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDrawingObstacles || !isDragging || !dragMode) return;

      const pos = getGridPos(event);
      if (pos && pos.x >= 0 && pos.x < GRID_SIZE && pos.y >= 0 && pos.y < GRID_SIZE) {
        // Apply consistent action
        // Check against Ref to see if we actually need to change it
        const currentVal = obstaclesRef.current[pos.y][pos.x];

        if (dragMode === 'add' && !currentVal) {
          actions.addObstacle(pos.x, pos.y);
        } else if (dragMode === 'remove' && currentVal) {
          actions.removeObstacle(pos.x, pos.y);
        }
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
      dragMode = null;
    };

    const container = containerRef.current;
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    // Removed 'obstacles' from dependency array to prevent effect churn
  }, [isDrawingObstacles, actions]);

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
    if (!sceneRef.current || !cameraRef.current || (!rendererRef.current && !composerRef.current)) return;

    if (isRunning && fluidDynamicsRef.current) {
      // Calculate dynamic wind
      let windDir = parameters.windDirection;
      let windSpeed = parameters.windSpeed;

      if (dynamicWeather) {
        const time = Date.now() * 0.0005;
        // Vary direction by +/- 45 degrees
        windDir += Math.sin(time) * 45;
        // Vary speed by +/- 0.3
        windSpeed += Math.sin(time * 1.3) * 0.3;
        windSpeed = Math.max(0.1, windSpeed);
      }

      // Create temporary parameters with dynamic wind
      const currentParams = { ...parameters, windDirection: windDir, windSpeed: windSpeed };

      // Run fluid dynamics simulation
      fluidDynamicsRef.current.step(currentParams, sources);

      // Update particles based on simulation
      updateParticles(windDir, windSpeed);

      // Sync Grid to Store every 30 frames (approx 0.5s)
      frameCounterRef.current++;
      if (frameCounterRef.current % 30 === 0) {
        actions.setGrid(fluidDynamicsRef.current.getDensity());
      }

      // Update scene background based on pollution level
      const grid = fluidDynamicsRef.current.getDensity();
      let totalDensity = 0;
      let maxDensity = 0;
      let cellCount = 0;
      for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
          const val = grid[i][j];
          totalDensity += val;
          if (val > maxDensity) maxDensity = val;
          cellCount++;
        }
      }
      // Use max density for background intensity to show "peak" pollution
      const normalizedAvg = Math.min(maxDensity / 255, 1.0);

      // Calculate AQI for emoji display - Use MAX density for localized impact
      // Map max density (0-255) to AQI scale (0-500)
      const aqi = Math.min(500, Math.floor(maxDensity * 2));
      setCurrentAQI(aqi);

      // Interpolate background from clean (dark blue) to polluted (murky brown/red)
      // Darker background for bloom contrast
      const cleanR = 0x05 / 255, cleanG = 0x05 / 255, cleanB = 0x10 / 255;
      const pollutedR = 0x2a / 255, pollutedG = 0x10 / 255, pollutedB = 0x10 / 255;

      const bgR = cleanR * (1 - normalizedAvg) + pollutedR * normalizedAvg;
      const bgG = cleanG * (1 - normalizedAvg) + pollutedG * normalizedAvg;
      const bgB = cleanB * (1 - normalizedAvg) + pollutedB * normalizedAvg;

      sceneRef.current.background = new THREE.Color(bgR, bgG, bgB);
      sceneRef.current.fog = new THREE.Fog(
        new THREE.Color(bgR, bgG, bgB).getHex(),
        10,
        60
      );

      // Rotate camera slightly for better view
      const time = Date.now() * 0.0001;
      cameraRef.current.position.x = Math.sin(time) * 35;
      cameraRef.current.position.z = Math.cos(time) * 35;
      cameraRef.current.lookAt(0, 0, 0);
    }

    if (composerRef.current) {
      composerRef.current.render();
    } else {
      rendererRef.current!.render(sceneRef.current, cameraRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [isRunning, sources, parameters, updateParticles, dynamicWeather, actions]);

  const handleResize = useCallback(() => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
    if (composerRef.current) {
      composerRef.current.setSize(width, height);
    }
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
      // Clean up composer passes if needed
      composerRef.current = null;
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
      actions.setGrid(fluidDynamicsRef.current.getDensity()); // Sync reset grid
    }
  }, [isRunning, actions]);

  const aqiInfo = getAQIEmoji(currentAQI);

  return (
    <div
      ref={containerRef}
      data-tour="simulation-canvas"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%)',
        cursor: isDrawingObstacles ? 'crosshair' : 'default',
      }}
    >
      {/* Screenshot Button */}
      <button
        onClick={captureScreenshot}
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          background: 'rgba(139, 92, 246, 0.2)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(139, 92, 246, 0.4)',
          borderRadius: '8px',
          padding: '8px 12px',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          fontWeight: 600,
          zIndex: 100,
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.3)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
        title="Capture simulation screenshot"
      >
        <Camera size={16} />
        <span>Capture</span>
      </button>

      {/* Real-time Commentary Overlay */}
      {/* Real-time Commentary Overlay */}
      <div style={{
        // Allow CSS to handle positioning (main.css .simulation-commentary)
        zIndex: 50,
        pointerEvents: 'none', // Allow clicking through to canvas
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingBottom: '2rem'
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <SimulationCommentary />
        </div>
      </div>

      <div className="tour-playback-controls" style={{
        position: 'absolute',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '12px',
        padding: '6px 12px',
        display: 'flex',
        gap: '8px',
        zIndex: 100,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <button
          onClick={isRunning ? actions.pause : actions.start}
          title={isRunning ? "Pause Simulation" : "Start Simulation"}
          style={{
            background: isRunning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            border: `1px solid ${isRunning ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
            color: isRunning ? '#ef4444' : '#10b981',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>

        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        <button
          onClick={actions.reset}
          title="Reset Simulation"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#e2e8f0';
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Air Quality Emoji Overlay - Hidden in Scientist Mode */}
      {isRunning && !scientistMode && (
        <div className="canvas-aqi-indicator">
          <div className="canvas-aqi-emoji" style={{
            fontSize: '3rem',
            filter: `drop-shadow(0 0 10px ${aqiInfo.color})`,
            textShadow: `0 0 20px ${aqiInfo.color}`
          }}>
            {aqiInfo.emoji}
          </div>
          <div className="canvas-aqi-label" style={{ color: aqiInfo.color, fontWeight: 'bold' }}>
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
