import { GRID_SIZE, SimulationParameters, PollutionSource } from '@/types';

export class WebGLSimulationEngine {
  private canvas: HTMLCanvasElement;
  private gridSize: number;
  private gl: WebGL2RenderingContext | null = null;
  private programs: { [key: string]: WebGLProgram } = {};
  private framebuffers: { [key: string]: WebGLFramebuffer } = {};
  private textures: { [key: string]: WebGLTexture } = {};
  private quadBuffer: WebGLBuffer | null = null;

  constructor(canvas: HTMLCanvasElement, gridSize: number = GRID_SIZE) {
    this.canvas = canvas;
    this.gridSize = gridSize;
    this.initializeWebGL();
    this.createShaderPrograms();
    this.createTextures();
    this.createQuadBuffer();
    console.log('WebGL GPU simulation engine initialized');
  }

  private initializeWebGL(): void {
    this.gl = this.canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    }) as WebGL2RenderingContext;

    if (!this.gl) {
      throw new Error('WebGL2 not supported');
    }

    // Check for floating point texture support
    const floatExt = this.gl.getExtension('EXT_color_buffer_float');
    if (!floatExt) {
      console.warn('Floating point textures not supported');
    }

    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.BLEND);
    this.gl.viewport(0, 0, this.gridSize, this.gridSize);
  }

  private createShaderPrograms(): void {
    // Vertex shader (same for all programs)
    const vertexShader = `#version 300 es
      in vec2 a_position;
      out vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Advection fragment shader (obstacle-aware)
    const advectionFragment = `#version 300 es
      precision highp float;
      uniform sampler2D u_pollutantTexture;
      uniform sampler2D u_velocityTexture;
      uniform sampler2D u_obstacleTexture;
      uniform float u_deltaTime;
      uniform vec2 u_gridSize;
      uniform vec2 u_texelSize;
      in vec2 v_texCoord;
      out vec4 fragColor;

      vec4 bilinearSample(sampler2D tex, vec2 coord) {
        return texture(tex, coord);
      }

      void main() {
        float obstHere = texture(u_obstacleTexture, v_texCoord).r;
        if (obstHere > 0.5) { fragColor = vec4(0.0); return; }

        vec2 velocity = texture(u_velocityTexture, v_texCoord).xy;
        vec2 prevPos = v_texCoord - velocity * u_deltaTime * u_texelSize;
        prevPos = clamp(prevPos, u_texelSize * 0.5, vec2(1.0) - u_texelSize * 0.5);

        float obstPrev = texture(u_obstacleTexture, prevPos).r;
        vec4 pollutant = (obstPrev > 0.5)
          ? bilinearSample(u_pollutantTexture, v_texCoord)
          : bilinearSample(u_pollutantTexture, prevPos);

        fragColor = pollutant;
      }
    `;

    // Diffusion fragment shader (obstacle-aware, reflective boundaries)
    const diffusionFragment = `#version 300 es
      precision highp float;
      uniform sampler2D u_pollutantTexture;
      uniform sampler2D u_obstacleTexture;
      uniform float u_diffusionRate;
      uniform float u_deltaTime;
      uniform vec2 u_texelSize;
      in vec2 v_texCoord;
      out vec4 fragColor;

      void main() {
        float obstHere = texture(u_obstacleTexture, v_texCoord).r;
        if (obstHere > 0.5) { fragColor = vec4(0.0); return; }

        vec4 center = texture(u_pollutantTexture, v_texCoord);
        vec4 left = texture(u_pollutantTexture, v_texCoord + vec2(-u_texelSize.x, 0.0));
        vec4 right = texture(u_pollutantTexture, v_texCoord + vec2(u_texelSize.x, 0.0));
        vec4 bottom = texture(u_pollutantTexture, v_texCoord + vec2(0.0, -u_texelSize.y));
        vec4 top = texture(u_pollutantTexture, v_texCoord + vec2(0.0, u_texelSize.y));

        float obstL = texture(u_obstacleTexture, v_texCoord + vec2(-u_texelSize.x, 0.0)).r;
        float obstR = texture(u_obstacleTexture, v_texCoord + vec2(u_texelSize.x, 0.0)).r;
        float obstB = texture(u_obstacleTexture, v_texCoord + vec2(0.0, -u_texelSize.y)).r;
        float obstT = texture(u_obstacleTexture, v_texCoord + vec2(0.0, u_texelSize.y)).r;

        if (obstL > 0.5) left = center;
        if (obstR > 0.5) right = center;
        if (obstB > 0.5) bottom = center;
        if (obstT > 0.5) top = center;

        vec4 laplacian = (left + right + bottom + top - 4.0 * center);
        vec4 result = center + u_diffusionRate * u_deltaTime * laplacian;
        fragColor = max(vec4(0.0), result);
      }
    `;

    // Source injection fragment shader (skip obstacles)
    const sourceFragment = `#version 300 es
      precision highp float;
      uniform sampler2D u_pollutantTexture;
      uniform sampler2D u_obstacleTexture;
      uniform vec2 u_sourcePosition;
      uniform float u_sourceStrength;
      uniform float u_sourceRadius;
      uniform vec2 u_gridSize;
      in vec2 v_texCoord;
      out vec4 fragColor;

      void main() {
        vec4 pollutant = texture(u_pollutantTexture, v_texCoord);
        vec2 gridPos = v_texCoord * u_gridSize;
        float dist = distance(gridPos, u_sourcePosition);

        if (dist <= u_sourceRadius) {
          float falloff = 1.0 - (dist / u_sourceRadius);
          float obst = texture(u_obstacleTexture, v_texCoord).r;
          if (obst < 0.5) {
            pollutant.r += u_sourceStrength * falloff;
          }
        }

        fragColor = pollutant;
      }
    `;

    this.programs.advection = this.createProgram(vertexShader, advectionFragment);
    this.programs.diffusion = this.createProgram(vertexShader, diffusionFragment);
    this.programs.source = this.createProgram(vertexShader, sourceFragment);

    // Display shader to render pollutant texture to the canvas
    const displayFragment = `#version 300 es
      precision highp float;
      uniform sampler2D u_pollutantTexture;
      uniform vec3 u_pollutantColor;
      uniform vec3 u_baseColor;
      in vec2 v_texCoord;
      out vec4 fragColor;

      void main() {
        float conc = texture(u_pollutantTexture, v_texCoord).r;
        vec3 color = mix(u_baseColor, u_pollutantColor, clamp(conc, 0.0, 1.0));
        fragColor = vec4(color, 1.0);
      }
    `;
    this.programs.display = this.createProgram(vertexShader, displayFragment);
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    if (!this.gl) throw new Error('WebGL context not initialized');

    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + this.gl.getProgramInfoLog(program));
    }

    return program;
  }

  private compileShader(type: number, source: string): WebGLShader {
    if (!this.gl) throw new Error('WebGL context not initialized');

    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('Shader compilation error: ' + this.gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  private createTextures(): void {
    if (!this.gl) return;

    this.textures.pollutant = this.createTexture();
    this.textures.pollutantTemp = this.createTexture();
    this.textures.velocity = this.createTexture();
    this.textures.obstacles = this.createMaskTexture();

    // Create framebuffers for render-to-texture
    this.framebuffers.pollutant = this.createFramebuffer(this.textures.pollutant);
    this.framebuffers.pollutantTemp = this.createFramebuffer(this.textures.pollutantTemp);
  }

  private createTexture(): WebGLTexture {
    if (!this.gl) throw new Error('WebGL context not initialized');

    const texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA32F,
      this.gridSize, this.gridSize, 0,
      this.gl.RGBA, this.gl.FLOAT, null
    );

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    return texture;
  }

  private createMaskTexture(): WebGLTexture {
    if (!this.gl) throw new Error('WebGL context not initialized');

    const texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA8,
      this.gridSize, this.gridSize, 0,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, null
    );

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    return texture;
  }

  private createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
    if (!this.gl) throw new Error('WebGL context not initialized');

    const framebuffer = this.gl.createFramebuffer()!;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture, 0
    );

    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer not complete');
    }

    return framebuffer;
  }

  private createQuadBuffer(): void {
    if (!this.gl) return;

    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);

    this.quadBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
  }

  // Main simulation method
  simulateFrame(
    pollutantGrid: number[][],
    parameters: SimulationParameters,
    sources: PollutionSource[],
    obstacles: boolean[][],
    options: { readback?: boolean } = { readback: true }
  ): void {
    if (!this.gl) return;

    try {
      // Upload current pollutant data
      this.uploadGrid(pollutantGrid, this.textures.pollutant);

      // Upload obstacle mask
      this.uploadObstacleMask(obstacles);

      // Set up velocity field from wind parameters
      const windAngleRad = (parameters.windDirection * Math.PI) / 180;
      const windVelocity = [
        parameters.windSpeed * Math.cos(windAngleRad),
        parameters.windSpeed * Math.sin(windAngleRad)
      ];
      this.setupVelocityField(windVelocity);

      // Run simulation steps
      this.runAdvection(parameters);
      this.runDiffusion(parameters);

      // Handle sources
      sources.forEach(source => {
        if (source.active) {
          this.runSourceInjection(source, parameters);
        }
      });

      // Apply decay
      this.applyDecay(parameters.decayFactor);

      // Render to canvas
      this.runDisplay();

      // Download result only when requested
      if (options.readback) {
        this.downloadGrid(this.textures.pollutant, pollutantGrid);
      }

    } catch (error) {
      console.error('WebGL simulation frame failed:', error);
      throw error;
    }
  }

  private runDisplay(): void {
    if (!this.gl) return;

    // Render pollutant texture to default framebuffer (the canvas)
    const prevFramebuffer = this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING);
    const prevViewport = this.gl.getParameter(this.gl.VIEWPORT);

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.useProgram(this.programs.display);

    // Default colors
    const pollutantColor = [1.0, 0.3, 0.3]; // Red
    const baseColor = [0.92, 0.96, 1.0]; // Light blue

    const pollutantColorLoc = this.gl.getUniformLocation(this.programs.display, 'u_pollutantColor');
    const baseColorLoc = this.gl.getUniformLocation(this.programs.display, 'u_baseColor');

    if (pollutantColorLoc) {
      this.gl.uniform3f(pollutantColorLoc, pollutantColor[0], pollutantColor[1], pollutantColor[2]);
    }
    if (baseColorLoc) {
      this.gl.uniform3f(baseColorLoc, baseColor[0], baseColor[1], baseColor[2]);
    }

    // Bind pollutant texture for display
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.pollutant);
    const textureLoc = this.gl.getUniformLocation(this.programs.display, 'u_pollutantTexture');
    if (textureLoc) {
      this.gl.uniform1i(textureLoc, 0);
    }

    this.drawQuad(this.programs.display);

    // Restore framebuffer and viewport
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, prevFramebuffer);
    this.gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);
  }

  private uploadGrid(grid: number[][], texture: WebGLTexture): void {
    if (!this.gl) return;

    const data = new Float32Array(this.gridSize * this.gridSize * 4);

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const index = (y * this.gridSize + x) * 4;
        const value = grid[y][x] / 255.0;
        data[index] = value;     // R - pollutant concentration
        data[index + 1] = 0;     // G
        data[index + 2] = 0;     // B
        data[index + 3] = 1;     // A
      }
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texSubImage2D(
      this.gl.TEXTURE_2D, 0, 0, 0,
      this.gridSize, this.gridSize,
      this.gl.RGBA, this.gl.FLOAT, data
    );
  }

  private uploadObstacleMask(maskGrid: boolean[][]): void {
    if (!this.gl) return;

    const data = new Uint8Array(this.gridSize * this.gridSize * 4);
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const index = (y * this.gridSize + x) * 4;
        const v = maskGrid[y][x] ? 255 : 0;
        data[index] = v;     // R
        data[index + 1] = 0; // G
        data[index + 2] = 0; // B
        data[index + 3] = 255; // A
      }
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.obstacles);
    this.gl.texSubImage2D(
      this.gl.TEXTURE_2D, 0, 0, 0,
      this.gridSize, this.gridSize,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, data
    );
  }

  private downloadGrid(texture: WebGLTexture, grid: number[][]): void {
    if (!this.gl) return;

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.createFramebuffer(texture));

    const data = new Float32Array(this.gridSize * this.gridSize * 4);
    this.gl.readPixels(
      0, 0, this.gridSize, this.gridSize,
      this.gl.RGBA, this.gl.FLOAT, data
    );

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const index = (y * this.gridSize + x) * 4;
        grid[y][x] = Math.max(0, Math.min(255, data[index] * 255));
      }
    }
  }

  private setupVelocityField(windVelocity: number[]): void {
    if (!this.gl) return;

    const data = new Float32Array(this.gridSize * this.gridSize * 4);

    for (let i = 0; i < this.gridSize * this.gridSize; i++) {
      const index = i * 4;
      data[index] = windVelocity[0];
      data[index + 1] = windVelocity[1];
      data[index + 2] = 0;
      data[index + 3] = 0;
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.velocity);
    this.gl.texSubImage2D(
      this.gl.TEXTURE_2D, 0, 0, 0,
      this.gridSize, this.gridSize,
      this.gl.RGBA, this.gl.FLOAT, data
    );
  }

  private runAdvection(_parameters: SimulationParameters): void {
    if (!this.gl) return;

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers.pollutantTemp);
    this.gl.useProgram(this.programs.advection);

    // Set uniforms
    const deltaTimeLoc = this.gl.getUniformLocation(this.programs.advection, 'u_deltaTime');
    const gridSizeLoc = this.gl.getUniformLocation(this.programs.advection, 'u_gridSize');
    const texelSizeLoc = this.gl.getUniformLocation(this.programs.advection, 'u_texelSize');

    if (deltaTimeLoc) this.gl.uniform1f(deltaTimeLoc, 0.016); // ~60fps
    if (gridSizeLoc) this.gl.uniform2f(gridSizeLoc, this.gridSize, this.gridSize);
    if (texelSizeLoc) this.gl.uniform2f(texelSizeLoc, 1.0/this.gridSize, 1.0/this.gridSize);

    // Bind textures
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.pollutant);
    const pollutantLoc = this.gl.getUniformLocation(this.programs.advection, 'u_pollutantTexture');
    if (pollutantLoc) this.gl.uniform1i(pollutantLoc, 0);

    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.velocity);
    const velocityLoc = this.gl.getUniformLocation(this.programs.advection, 'u_velocityTexture');
    if (velocityLoc) this.gl.uniform1i(velocityLoc, 1);

    this.gl.activeTexture(this.gl.TEXTURE2);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.obstacles);
    const obstacleLoc = this.gl.getUniformLocation(this.programs.advection, 'u_obstacleTexture');
    if (obstacleLoc) this.gl.uniform1i(obstacleLoc, 2);

    this.drawQuad(this.programs.advection);

    // Swap textures
    [this.textures.pollutant, this.textures.pollutantTemp] = [this.textures.pollutantTemp, this.textures.pollutant];
    [this.framebuffers.pollutant, this.framebuffers.pollutantTemp] = [this.framebuffers.pollutantTemp, this.framebuffers.pollutant];
  }

  private runDiffusion(parameters: SimulationParameters): void {
    if (!this.gl) return;

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers.pollutantTemp);
    this.gl.useProgram(this.programs.diffusion);

    const diffusionRateLoc = this.gl.getUniformLocation(this.programs.diffusion, 'u_diffusionRate');
    const deltaTimeLoc = this.gl.getUniformLocation(this.programs.diffusion, 'u_deltaTime');
    const texelSizeLoc = this.gl.getUniformLocation(this.programs.diffusion, 'u_texelSize');

    if (diffusionRateLoc) this.gl.uniform1f(diffusionRateLoc, parameters.diffusionRate);
    if (deltaTimeLoc) this.gl.uniform1f(deltaTimeLoc, 0.016);
    if (texelSizeLoc) this.gl.uniform2f(texelSizeLoc, 1.0/this.gridSize, 1.0/this.gridSize);

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.pollutant);
    const pollutantLoc = this.gl.getUniformLocation(this.programs.diffusion, 'u_pollutantTexture');
    if (pollutantLoc) this.gl.uniform1i(pollutantLoc, 0);

    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.obstacles);
    const obstacleLoc = this.gl.getUniformLocation(this.programs.diffusion, 'u_obstacleTexture');
    if (obstacleLoc) this.gl.uniform1i(obstacleLoc, 1);

    this.drawQuad(this.programs.diffusion);

    // Swap textures
    [this.textures.pollutant, this.textures.pollutantTemp] = [this.textures.pollutantTemp, this.textures.pollutant];
    [this.framebuffers.pollutant, this.framebuffers.pollutantTemp] = [this.framebuffers.pollutantTemp, this.framebuffers.pollutant];
  }

  private runSourceInjection(source: PollutionSource, parameters: SimulationParameters): void {
    if (!this.gl) return;

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers.pollutantTemp);
    this.gl.useProgram(this.programs.source);

    const sourcePosLoc = this.gl.getUniformLocation(this.programs.source, 'u_sourcePosition');
    const sourceStrengthLoc = this.gl.getUniformLocation(this.programs.source, 'u_sourceStrength');
    const sourceRadiusLoc = this.gl.getUniformLocation(this.programs.source, 'u_sourceRadius');
    const gridSizeLoc = this.gl.getUniformLocation(this.programs.source, 'u_gridSize');

    if (sourcePosLoc) this.gl.uniform2f(sourcePosLoc, source.x, source.y);
    if (sourceStrengthLoc) this.gl.uniform1f(sourceStrengthLoc, parameters.releaseRate / 255.0);
    if (sourceRadiusLoc) this.gl.uniform1f(sourceRadiusLoc, 2.0);
    if (gridSizeLoc) this.gl.uniform2f(gridSizeLoc, this.gridSize, this.gridSize);

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.pollutant);
    const pollutantLoc = this.gl.getUniformLocation(this.programs.source, 'u_pollutantTexture');
    if (pollutantLoc) this.gl.uniform1i(pollutantLoc, 0);

    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.obstacles);
    const obstacleLoc = this.gl.getUniformLocation(this.programs.source, 'u_obstacleTexture');
    if (obstacleLoc) this.gl.uniform1i(obstacleLoc, 1);

    this.drawQuad(this.programs.source);

    // Swap textures
    [this.textures.pollutant, this.textures.pollutantTemp] = [this.textures.pollutantTemp, this.textures.pollutant];
    [this.framebuffers.pollutant, this.framebuffers.pollutantTemp] = [this.framebuffers.pollutantTemp, this.framebuffers.pollutant];
  }

  private applyDecay(_decayFactor: number): void {
    if (!this.gl) return;

    // Simple decay shader would go here, but for now we'll handle decay in CPU
    // This could be optimized with a GPU shader in the future
  }

  private drawQuad(program: WebGLProgram): void {
    if (!this.gl || !this.quadBuffer) return;

    const positionLocation = this.gl.getAttribLocation(program, 'a_position');

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  cleanup(): void {
    if (!this.gl) return;

    // Clean up WebGL resources
    Object.values(this.textures).forEach(texture => this.gl!.deleteTexture(texture));
    Object.values(this.framebuffers).forEach(fb => this.gl!.deleteFramebuffer(fb));
    Object.values(this.programs).forEach(program => this.gl!.deleteProgram(program));
    if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer);
  }

  // Check if WebGL2 is supported
  static isSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2'));
    } catch {
      return false;
    }
  }
}