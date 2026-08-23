/**
 * =============================================================================
 * WEBGL RENDER ENGINE - Three.js Wrapper with Custom Shaders
 * =============================================================================
 * High-performance WebGL renderer with post-processing, shader management,
 * and automatic quality scaling
 * =============================================================================
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { EventEmitter } from '../utils/EventEmitter.js';
import { ShaderManager } from '../webgl/ShaderManager.js';
import { PostProcessing } from '../webgl/PostProcessing.js';

export class RenderEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      canvas: config.canvas,
      antialias: config.antialias !== false,
      alpha: config.alpha !== false,
      powerPreference: config.powerPreference || 'high-performance',
      fov: config.fov || 60,
      near: config.near || 0.1,
      far: config.far || 10000,
      assetManager: config.assetManager,
      workerPool: config.workerPool,
      qualityLevel: config.qualityLevel || 'auto',
      debug: config.debug || false,
    };
    
    // Three.js core
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.composer = null;
    
    // Shader management
    this.shaderManager = new ShaderManager();
    
    // Post-processing
    this.postProcessing = null;
    
    // Quality settings
    this.quality = 'high';
    this.pixelRatio = 1;
    this.targetFPS = 60;
    
    // Scene objects
    this.objects = new Map();
    this.lights = new Map();
    
    // Time
    this.time = 0;
    this.deltaTime = 0;
    
    // Initialize
    this.init();
  }
  
  init() {
    this.createRenderer();
    this.createScene();
    this.createCamera();
    this.createPostProcessing();
    this.setupQuality();
    this.loadShaders();
  }
  
  createRenderer() {
    const canvas = this.config.canvas;
    
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.config.antialias,
      alpha: this.config.alpha,
      powerPreference: this.config.powerPreference,
      preserveDrawingBuffer: false,
      logarithmicDepthBuffer: true,
    });
    
    // Settings
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = false; // We use custom shadows
    this.renderer.autoClear = false;
    
    // Store pixel ratio
    this.pixelRatio = this.renderer.getPixelRatio();
    
    this.log('Renderer created:', {
      pixelRatio: this.pixelRatio,
      size: this.renderer.getSize(new THREE.Vector2()),
    });
  }
  
  createScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020208);
    
    // Fog for depth
    this.scene.fog = new THREE.FogExp2(0x020208, 0.0005);
  }
  
  createCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      this.config.fov,
      aspect,
      this.config.near,
      this.config.far
    );
    
    this.camera.position.set(0, 0, 500);
    this.camera.lookAt(0, 0, 0);
  }
  
  createPostProcessing() {
    if (!this.config.enablePostProcessing) return;
    
    this.postProcessing = new PostProcessing({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      quality: this.quality,
    });
  }
  
  setupQuality() {
    const quality = this.config.qualityLevel;
    
    if (quality === 'auto') {
      // Auto-detect based on hardware
      const gpuTier = this.detectGPUTier();
      this.quality = gpuTier;
    } else {
      this.quality = quality;
    }
    
    this.applyQualitySettings(this.quality);
    this.log(`Quality level set to: ${this.quality}`);
  }
  
  detectGPUTier() {
    // Simple heuristic
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return 'low';
    
    const renderer = gl.getParameter(gl.RENDERER).toLowerCase();
    const vendor = gl.getParameter(gl.VENDOR).toLowerCase();
    
    // High-end GPUs
    if (renderer.includes('rtx') || renderer.includes('rx 6') || renderer.includes('rx 7') ||
        vendor.includes('nvidia') && (renderer.includes('30') || renderer.includes('40')) ||
        vendor.includes('amd') && (renderer.includes('6000') || renderer.includes('7000'))) {
      return 'ultra';
    }
    
    // Mid-range
    if (renderer.includes('gtx 16') || renderer.includes('rtx 20') || renderer.includes('rx 5') ||
        vendor.includes('intel') && renderer.includes('arc')) {
      return 'high';
    }
    
    // Integrated
    if (vendor.includes('intel') || vendor.includes('apple') || renderer.includes('integrated')) {
      return 'medium';
    }
    
    return 'medium';
  }
  
  applyQualitySettings(quality) {
    const settings = {
      ultra: {
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        particleMultiplier: 1.0,
        postProcessing: true,
        bloom: true,
        fxaa: true,
        shadows: true,
        maxLights: 8,
      },
      high: {
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        particleMultiplier: 0.75,
        postProcessing: true,
        bloom: true,
        fxaa: true,
        shadows: false,
        maxLights: 4,
      },
      medium: {
        pixelRatio: 1,
        particleMultiplier: 0.5,
        postProcessing: true,
        bloom: false,
        fxaa: true,
        shadows: false,
        maxLights: 2,
      },
      low: {
        pixelRatio: 1,
        particleMultiplier: 0.25,
        postProcessing: false,
        bloom: false,
        fxaa: false,
        shadows: false,
        maxLights: 1,
      },
    };
    
    const s = settings[quality] || settings.medium;
    
    this.renderer.setPixelRatio(s.pixelRatio);
    this.particleMultiplier = s.particleMultiplier;
    
    if (this.postProcessing) {
      this.postProcessing.setEnabled(s.postProcessing);
      this.postProcessing.setBloom(s.bloom);
      this.postProcessing.setFXAA(s.fxaa);
    }
  }
  
  reduceQuality() {
    const levels = ['ultra', 'high', 'medium', 'low'];
    const currentIndex = levels.indexOf(this.quality);
    if (currentIndex < levels.length - 1) {
      this.quality = levels[currentIndex + 1];
      this.applyQualitySettings(this.quality);
      this.log(`Quality reduced to: ${this.quality}`);
    }
  }
  
  async loadShaders() {
    // Load core shaders
    await Promise.all([
      this.shaderManager.load('holographic', '/shaders/holographic/'),
      this.shaderManager.load('omni-sphere', '/shaders/omni-sphere/'),
      this.shaderManager.load('particles', '/shaders/particles/'),
    ]);
    
    this.emit('shaders:loaded');
  }
  
  /**
   * Create holographic material
   */
  createHolographicMaterial(params = {}) {
    const uniforms = {
      uTime: { value: 0 },
      uIridescenceIntensity: { value: params.iridescenceIntensity || 0.6 },
      uIridescenceSpeed: { value: params.iridescenceSpeed || 0.1 },
      uViewPosition: { value: new THREE.Vector3() },
      uCameraPosition: { value: new THREE.Vector3() },
      uModelMatrix: { value: new THREE.Matrix4() },
      uViewMatrix: { value: new THREE.Matrix4() },
      uProjectionMatrix: { value: new THREE.Matrix4() },
      ...params.uniforms,
    };
    
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: this.shaderManager.get('holographic', 'vertex'),
      fragmentShader: this.shaderManager.get('holographic', 'fragment'),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    
    return material;
  }
  
  /**
   * Create omni-sphere material
   */
  createOmniSphereMaterial(params = {}) {
    const uniforms = {
      uTime: { value: 0 },
      uRotationSpeed: { value: params.rotationSpeed || 0.0005 },
      uRingCount: { value: params.ringCount || 8 },
      uGlowIntensity: { value: params.glowIntensity || 0.4 },
      uCameraPosition: { value: new THREE.Vector3() },
      ...params.uniforms,
    };
    
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: this.shaderManager.get('omni-sphere', 'vertex'),
      fragmentShader: this.shaderManager.get('omni-sphere', 'fragment'),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    
    return material;
  }
  
  /**
   * Add object to scene
   */
  addObject(name, object) {
    this.scene.add(object);
    this.objects.set(name, object);
    return object;
  }
  
  /**
   * Remove object from scene
   */
  removeObject(name) {
    const object = this.objects.get(name);
    if (object) {
      this.scene.remove(object);
      this.disposeObject(object);
      this.objects.delete(name);
    }
  }
  
  disposeObject(object) {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(m => m.dispose());
      } else {
        object.material.dispose();
      }
    }
    if (object.children) {
      object.children.forEach(child => this.disposeObject(child));
    }
  }
  
  /**
   * Update time uniforms
   */
  updateTime(elapsedTime) {
    this.time = elapsedTime;
    
    // Update all shader materials
    this.scene.traverse((object) => {
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material.uniforms) {
            if (material.uniforms.uTime) material.uniforms.uTime.value = elapsedTime;
            if (material.uniforms.uCameraPosition) material.uniforms.uCameraPosition.value.copy(this.camera.position);
            if (material.uniforms.uViewPosition) material.uniforms.uViewPosition.value.copy(this.camera.position);
            if (material.uniforms.uViewMatrix) material.uniforms.uViewMatrix.value.copy(this.camera.matrixWorldInverse);
            if (material.uniforms.uProjectionMatrix) material.uniforms.uProjectionMatrix.value.copy(this.camera.projectionMatrix);
          }
        });
      }
    });
  }
  
  /**
   * Update render loop
   */
  update(deltaTime, elapsedTime) {
    this.deltaTime = deltaTime;
    this.updateTime(elapsedTime);
    
    // Update camera matrices for shaders
    this.camera.updateMatrixWorld();
  }
  
  /**
   * Render frame
   */
  render() {
    if (this.postProcessing && this.postProcessing.enabled) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
  
  /**
   * Resize
   */
  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    
    if (this.postProcessing) {
      this.postProcessing.resize(width, height);
    }
    
    this.emit('resize', { width, height });
  }
  
  /**
   * Get render stats
   */
  getStats() {
    return {
      fps: this.renderer.info.render.fps || 0,
      frames: this.renderer.info.render.frame,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      points: this.renderer.info.render.points,
      lines: this.renderer.info.render.lines,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      pixelRatio: this.pixelRatio,
      quality: this.quality,
    };
  }
  
  /**
   * Destroy
   */
  destroy() {
    // Dispose all objects
    this.objects.forEach((object, name) => {
      this.disposeObject(object);
    });
    this.objects.clear();
    
    // Dispose post-processing
    this.postProcessing?.destroy();
    
    // Dispose renderer
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    
    // Remove canvas
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    
    this.removeAllListeners();
  }
}
