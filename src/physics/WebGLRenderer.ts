import { GRID_SIZE } from '../types';

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;

  void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_densityTexture;

  // Base fluid color (light blue for water/air)
  vec3 baseColor = vec3(0.92, 0.96, 1.0);

  // Pollutant color (dark red for chemical)
  // This can be expanded to support multiple pollutant types
  vec3 pollutionColor = vec3(0.54, 0.0, 0.0);

  void main() {
    float density = texture2D(u_densityTexture, v_texCoord).r;
    float normalizedDensity = clamp(density / 255.0, 0.0, 1.0);

    // Blend between base fluid color and pollution color
    vec3 finalColor = mix(baseColor, pollutionColor, normalizedDensity);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export class WebGLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;
  private densityTexture: WebGLTexture;
  private densityData: Uint8Array;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;

    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
    this.positionBuffer = this.createPositionBuffer();
    this.densityTexture = this.createDensityTexture();
    this.densityData = new Uint8Array(GRID_SIZE * GRID_SIZE);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Could not create shader');
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Could not compile shader: ${info}`);
    }
    return shader;
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    const program = this.gl.createProgram();
    if (!program) throw new Error('Could not create program');
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`Could not link program: ${info}`);
    }
    return program;
  }

  private createPositionBuffer(): WebGLBuffer {
    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error('Could not create buffer');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    const positions = [-1, -1, 1, -1, -1, 1, 1, 1];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
    return buffer;
  }

  private createDensityTexture(): WebGLTexture {
    const texture = this.gl.createTexture();
    if (!texture) throw new Error('Could not create texture');
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    return texture;
  }

  public updateDensity(grid: number[][]) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        this.densityData[r * GRID_SIZE + c] = grid[r][c];
      }
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.densityTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.LUMINANCE,
      GRID_SIZE,
      GRID_SIZE,
      0,
      this.gl.LUMINANCE,
      this.gl.UNSIGNED_BYTE,
      this.densityData
    );
  }

  public draw() {
    this.gl.clearColor(0.92, 0.96, 1.0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.useProgram(this.program);

    const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    const textureLocation = this.gl.getUniformLocation(this.program, 'u_densityTexture');
    this.gl.uniform1i(textureLocation, 0);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  public resize() {
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
  }
}
