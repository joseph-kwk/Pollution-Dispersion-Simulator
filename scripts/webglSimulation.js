/**
 * WebGL2-based GPU acceleration for pollution simulation
 * Uses fragment shaders for parallel computation (wider browser support than compute shaders)
 */

class WebGLSimulationEngine {
    constructor(canvas, gridSize) {
        this.canvas = canvas;
        this.gridSize = gridSize;
        this.gl = null;
        this.programs = {};
        this.framebuffers = {};
        this.textures = {};
        this.quadBuffer = null;
        
        this.initializeWebGL();
        this.createShaderPrograms();
        this.createTextures();
        this.createQuadBuffer();
        
        console.log('WebGL GPU simulation engine initialized');
    }
    
    initializeWebGL() {
        this.gl = this.canvas.getContext('webgl2', {
            antialias: false,
            alpha: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        });
        
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
    
    createShaderPrograms() {
        // Vertex shader (same for all programs)
        const vertexShader = `#version 300 es
            in vec2 a_position;
            out vec2 v_texCoord;
            
            void main() {
                v_texCoord = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;
        
        // Advection fragment shader
        const advectionFragment = `#version 300 es
            precision highp float;
            
            uniform sampler2D u_pollutantTexture;
            uniform sampler2D u_velocityTexture;
            uniform float u_deltaTime;
            uniform vec2 u_gridSize;
            uniform vec2 u_texelSize;
            
            in vec2 v_texCoord;
            out vec4 fragColor;
            
            vec4 bilinearSample(sampler2D tex, vec2 coord) {
                return texture(tex, coord);
            }
            
            void main() {
                vec2 velocity = texture(u_velocityTexture, v_texCoord).xy;
                
                // Semi-Lagrangian advection
                vec2 prevPos = v_texCoord - velocity * u_deltaTime * u_texelSize;
                
                // Clamp to texture boundaries
                prevPos = clamp(prevPos, u_texelSize * 0.5, vec2(1.0) - u_texelSize * 0.5);
                
                // Sample pollutant at previous position
                vec4 pollutant = bilinearSample(u_pollutantTexture, prevPos);
                
                fragColor = pollutant;
            }
        `;
        
        // Diffusion fragment shader
        const diffusionFragment = `#version 300 es
            precision highp float;
            
            uniform sampler2D u_pollutantTexture;
            uniform float u_diffusionRate;
            uniform float u_deltaTime;
            uniform vec2 u_texelSize;
            
            in vec2 v_texCoord;
            out vec4 fragColor;
            
            void main() {
                vec4 center = texture(u_pollutantTexture, v_texCoord);
                vec4 left = texture(u_pollutantTexture, v_texCoord + vec2(-u_texelSize.x, 0.0));
                vec4 right = texture(u_pollutantTexture, v_texCoord + vec2(u_texelSize.x, 0.0));
                vec4 bottom = texture(u_pollutantTexture, v_texCoord + vec2(0.0, -u_texelSize.y));
                vec4 top = texture(u_pollutantTexture, v_texCoord + vec2(0.0, u_texelSize.y));
                
                // Laplacian operator for diffusion
                vec4 laplacian = (left + right + bottom + top - 4.0 * center);
                
                // Apply diffusion
                vec4 result = center + u_diffusionRate * u_deltaTime * laplacian;
                
                // Clamp to valid range
                fragColor = max(vec4(0.0), result);
            }
        `;
        
        // Source injection fragment shader
        const sourceFragment = `#version 300 es
            precision highp float;
            
            uniform sampler2D u_pollutantTexture;
            uniform vec2 u_sourcePosition;
            uniform float u_sourceStrength;
            uniform float u_sourceRadius;
            uniform vec2 u_gridSize;
            
            in vec2 v_texCoord;
            out vec4 fragColor;
            
            void main() {
                vec4 pollutant = texture(u_pollutantTexture, v_texCoord);
                
                // Convert to grid coordinates
                vec2 gridPos = v_texCoord * u_gridSize;
                
                // Calculate distance from source
                float dist = distance(gridPos, u_sourcePosition);
                
                // Add pollutant if within source radius
                if (dist <= u_sourceRadius) {
                    float falloff = 1.0 - (dist / u_sourceRadius);
                    pollutant.r += u_sourceStrength * falloff;
                }
                
                fragColor = pollutant;
            }
        `;
        
        this.programs.advection = this.createProgram(vertexShader, advectionFragment);
        this.programs.diffusion = this.createProgram(vertexShader, diffusionFragment);
        this.programs.source = this.createProgram(vertexShader, sourceFragment);
    }
    
    createProgram(vertexSource, fragmentSource) {
        const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error('Program link error: ' + this.gl.getProgramInfoLog(program));
        }
        
        return program;
    }
    
    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw new Error('Shader compilation error: ' + this.gl.getShaderInfoLog(shader));
        }
        
        return shader;
    }
    
    createTextures() {
        this.textures.pollutant = this.createTexture();
        this.textures.pollutantTemp = this.createTexture();
        this.textures.velocity = this.createTexture();
        
        // Create framebuffers for render-to-texture
        this.framebuffers.pollutant = this.createFramebuffer(this.textures.pollutant);
        this.framebuffers.pollutantTemp = this.createFramebuffer(this.textures.pollutantTemp);
    }
    
    createTexture() {
        const texture = this.gl.createTexture();
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
    
    createFramebuffer(texture) {
        const framebuffer = this.gl.createFramebuffer();
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
    
    createQuadBuffer() {
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
    
    simulateFrame(pollutantGrid, uniforms) {
        try {
            // Upload current pollutant data
            this.uploadGrid(pollutantGrid, this.textures.pollutant);
            
            // Set up velocity field
            this.setupVelocityField(uniforms.u_windVelocity);
            
            // Run simulation steps
            this.runAdvection(uniforms);
            this.runDiffusion(uniforms);
            this.runSourceInjection(uniforms);
            
            // Download result
            this.downloadGrid(this.textures.pollutant, pollutantGrid);
            
        } catch (error) {
            console.error('WebGL simulation frame failed:', error);
            throw error;
        }
    }
    
    uploadGrid(grid, texture) {
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
    
    downloadGrid(texture, grid) {
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
    
    setupVelocityField(windVelocity) {
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
    
    runAdvection(uniforms) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers.pollutantTemp);
        this.gl.useProgram(this.programs.advection);
        
        // Set uniforms
        this.gl.uniform1f(this.gl.getUniformLocation(this.programs.advection, 'u_deltaTime'), uniforms.u_deltaTime);
        this.gl.uniform2f(this.gl.getUniformLocation(this.programs.advection, 'u_gridSize'), this.gridSize, this.gridSize);
        this.gl.uniform2f(this.gl.getUniformLocation(this.programs.advection, 'u_texelSize'), 1.0/this.gridSize, 1.0/this.gridSize);
        
        // Bind textures
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.pollutant);
        this.gl.uniform1i(this.gl.getUniformLocation(this.programs.advection, 'u_pollutantTexture'), 0);
        
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.velocity);
        this.gl.uniform1i(this.gl.getUniformLocation(this.programs.advection, 'u_velocityTexture'), 1);
        
        this.drawQuad(this.programs.advection);
        
        // Swap textures
        [this.textures.pollutant, this.textures.pollutantTemp] = [this.textures.pollutantTemp, this.textures.pollutant];
        [this.framebuffers.pollutant, this.framebuffers.pollutantTemp] = [this.framebuffers.pollutantTemp, this.framebuffers.pollutant];
    }
    
    runDiffusion(uniforms) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers.pollutantTemp);
        this.gl.useProgram(this.programs.diffusion);
        
        this.gl.uniform1f(this.gl.getUniformLocation(this.programs.diffusion, 'u_diffusionRate'), uniforms.u_diffusionRate);
        this.gl.uniform1f(this.gl.getUniformLocation(this.programs.diffusion, 'u_deltaTime'), uniforms.u_deltaTime);
        this.gl.uniform2f(this.gl.getUniformLocation(this.programs.diffusion, 'u_texelSize'), 1.0/this.gridSize, 1.0/this.gridSize);
        
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.pollutant);
        this.gl.uniform1i(this.gl.getUniformLocation(this.programs.diffusion, 'u_pollutantTexture'), 0);
        
        this.drawQuad(this.programs.diffusion);
        
        // Swap textures
        [this.textures.pollutant, this.textures.pollutantTemp] = [this.textures.pollutantTemp, this.textures.pollutant];
        [this.framebuffers.pollutant, this.framebuffers.pollutantTemp] = [this.framebuffers.pollutantTemp, this.framebuffers.pollutant];
    }
    
    runSourceInjection(uniforms) {
        // Only run if we have a pollution source
        if (!uniforms.u_sourcePosition) return;
        
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers.pollutantTemp);
        this.gl.useProgram(this.programs.source);
        
        this.gl.uniform2f(this.gl.getUniformLocation(this.programs.source, 'u_sourcePosition'), 
                         uniforms.u_sourcePosition[0], uniforms.u_sourcePosition[1]);
        this.gl.uniform1f(this.gl.getUniformLocation(this.programs.source, 'u_sourceStrength'), uniforms.u_sourceStrength || 0.1);
        this.gl.uniform1f(this.gl.getUniformLocation(this.programs.source, 'u_sourceRadius'), uniforms.u_sourceRadius || 2.0);
        this.gl.uniform2f(this.gl.getUniformLocation(this.programs.source, 'u_gridSize'), this.gridSize, this.gridSize);
        
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.pollutant);
        this.gl.uniform1i(this.gl.getUniformLocation(this.programs.source, 'u_pollutantTexture'), 0);
        
        this.drawQuad(this.programs.source);
        
        // Swap textures
        [this.textures.pollutant, this.textures.pollutantTemp] = [this.textures.pollutantTemp, this.textures.pollutant];
        [this.framebuffers.pollutant, this.framebuffers.pollutantTemp] = [this.framebuffers.pollutantTemp, this.framebuffers.pollutant];
    }
    
    drawQuad(program) {
        const positionLocation = this.gl.getAttribLocation(program, 'a_position');
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
        
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
    
    cleanup() {
        // Clean up WebGL resources
        Object.values(this.textures).forEach(texture => this.gl.deleteTexture(texture));
        Object.values(this.framebuffers).forEach(fb => this.gl.deleteFramebuffer(fb));
        Object.values(this.programs).forEach(program => this.gl.deleteProgram(program));
        this.gl.deleteBuffer(this.quadBuffer);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WebGLSimulationEngine };
} else {
    window.WebGLSimulationEngine = WebGLSimulationEngine;
}
