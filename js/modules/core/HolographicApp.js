/**
 * =============================================================================
 * HOLOGRAPHIC-OMNI PREMIUM APPLICATION CONTROLLER
 * =============================================================================
 * Main entry point orchestrating WebGL, GSAP, Web Workers, and data-driven rendering
 * =============================================================================
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { RenderEngine } from './RenderEngine.js';
import { SceneGraph } from './SceneGraph.js';
import { AssetManager } from './AssetManager.js';
import { GSAPOrchestrator } from '../animations/GSAPOrchestrator.js';
import { ScrollController } from '../animations/ScrollController.js';
import { SpatialCursor } from '../interactions/SpatialCursor.js';
import { ParallaxField } from '../interactions/ParallaxField.js';
import { MagneticField } from '../interactions/MagneticField.js';
import { OmniSphere } from '../components/OmniSphere.js';
import { HolographicCard } from '../components/HolographicCard.js';
import { DataGrid } from '../components/DataGrid.js';
import { Navigation3D } from '../components/Navigation3D.js';
import { PortalTransition } from '../components/PortalTransition.js';
import { JSONRenderer } from '../data/JSONRenderer.js';
import { ContentEngine } from '../data/ContentEngine.js';
import { StateManager } from '../data/StateManager.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';
import { WebWorkerPool } from '../utils/WebWorkerPool.js';
import { ReducedMotionDetector } from '../utils/ReducedMotionDetector.js';

export class HolographicApp extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Rendering
      renderer: config.renderer || 'webgl2',
      antialias: config.antialias !== false,
      alpha: config.alpha !== false,
      preserveDrawingBuffer: config.preserveDrawingBuffer || false,
      powerPreference: config.powerPreference || 'high-performance',
      
      // Scene
      fov: config.fov || 60,
      near: config.near || 0.1,
      far: config.far || 10000,
      
      // Performance
      targetFPS: config.targetFPS || 60,
      enableWorkers: config.enableWorkers !== false,
      workerCount: config.workerCount || navigator.hardwareConcurrency || 4,
      particleBudget: config.particleBudget || 'auto',
      qualityLevel: config.qualityLevel || 'auto', // 'low', 'medium', 'high', 'ultra', 'auto'
      
      // Features
      enablePostProcessing: config.enablePostProcessing !== false,
      enableParticles: config.enableParticles !== false,
      enableOmniSpheres: config.enableOmniSpheres !== false,
      enableParallax: config.enableParallax !== false,
      enableMagnetic: config.enableMagnetic !== false,
      enableSpatialCursor: config.enableSpatialCursor !== false,
      enablePageTransitions: config.enablePageTransitions !== false,
      enableScrollSmoother: config.enableScrollSmoother !== false,
      
      // Page context
      pageId: config.pageId || document.body.dataset.pageId || 'unknown',
      pageType: config.pageType || document.body.dataset.pageType || 'generic',
      
      // Debug
      debug: config.debug || false,
      showStats: config.showStats || false,
      wireframe: config.wireframe || false,
    };
    
    // Core systems
    this.renderEngine = null;
    this.sceneGraph = null;
    this.assetManager = null;
    this.gsapOrchestrator = null;
    this.scrollController = null;
    
    // Interaction systems
    this.spatialCursor = null;
    this.parallaxField = null;
    this.magneticField = null;
    
    // Components
    this.components = new Map();
    this.omniSpheres = [];
    this.holographicCards = [];
    this.dataGrids = [];
    
    // Data layer
    this.jsonRenderer = null;
    this.contentEngine = null;
    this.stateManager = null;
    
    // Performance
    this.performance = null;
    this.workerPool = null;
    this.reducedMotion = new ReducedMotionDetector();
    
    // Page transition
    this.portalTransition = null;
    
    // State
    this.initialized = false;
    this.running = false;
    this.paused = false;
    this.frameId = null;
    this.lastTime = 0;
    
    // Auto-initialize
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }
  
  /**
   * Initialize all systems
   */
  async init() {
    if (this.initialized) return;
    
    this.log('Initializing Holographic-Omni Premium System...');
    const startTime = performance.now();
    
    try {
      // 1. Performance Monitor (first)
      this.performance = new PerformanceMonitor({
        targetFPS: this.config.targetFPS,
        onBudgetExceeded: this.handlePerformanceBudget.bind(this),
      });
      
      // 2. Web Worker Pool
      if (this.config.enableWorkers) {
        this.workerPool = new WebWorkerPool({
          workerCount: this.config.workerCount,
          tasks: ['physics', 'particles', 'morphing', 'layout'],
        });
      }
      
      // 3. Asset Manager
      this.assetManager = new AssetManager({
        basePath: '/assets/',
        workerPool: this.workerPool,
      });
      
      // 4. Render Engine (WebGL)
      this.renderEngine = new RenderEngine({
        canvas: this.getOrCreateCanvas(),
        antialias: this.config.antialias,
        alpha: this.config.alpha,
        powerPreference: this.config.powerPreference,
        fov: this.config.fov,
        near: this.config.near,
        far: this.config.far,
        assetManager: this.assetManager,
        workerPool: this.workerPool,
        qualityLevel: this.config.qualityLevel,
        debug: this.config.debug,
      });
      
      // 5. Scene Graph
      this.sceneGraph = new SceneGraph({
        renderEngine: this.renderEngine,
        assetManager: this.assetManager,
      });
      
      // 6. GSAP Orchestrator
      this.gsapOrchestrator = new GSAPOrchestrator({
        reducedMotion: this.reducedMotion.enabled,
        scrollController: null, // Set after creation
        eventBus: this,
      });
      
      // 7. Scroll Controller
      this.scrollController = new ScrollController({
        renderEngine: this.renderEngine,
        sceneGraph: this.sceneGraph,
        gsapOrchestrator: this.gsapOrchestrator,
        smoother: this.config.enableScrollSmoother,
        reducedMotion: this.reducedMotion.enabled,
      });
      
      // Link GSAP to scroll controller
      this.gsapOrchestrator.scrollController = this.scrollController;
      
      // 8. Data Layer
      this.stateManager = new StateManager({
        initialState: this.getInitialState(),
        persist: true,
      });
      
      this.contentEngine = new ContentEngine({
        stateManager: this.stateManager,
        assetManager: this.assetManager,
      });
      
      this.jsonRenderer = new JSONRenderer({
        contentEngine: this.contentEngine,
        sceneGraph: this.sceneGraph,
        renderEngine: this.renderEngine,
        gsapOrchestrator: this.gsapOrchestrator,
      });
      
      // 9. Interaction Systems
      if (this.config.enableSpatialCursor && !this.reducedMotion.enabled) {
        this.spatialCursor = new SpatialCursor({
          renderEngine: this.renderEngine,
          sceneGraph: this.sceneGraph,
        });
      }
      
      if (this.config.enableParallax && !this.reducedMotion.enabled) {
        this.parallaxField = new ParallaxField({
          renderEngine: this.renderEngine,
          sceneGraph: this.sceneGraph,
          scrollController: this.scrollController,
        });
      }
      
      if (this.config.enableMagnetic && !this.reducedMotion.enabled) {
        this.magneticField = new MagneticField({
          renderEngine: this.renderEngine,
          sceneGraph: this.sceneGraph,
        });
      }
      
      // 10. Components
      this.registerComponents();
      await this.initializeComponents();
      
      // 11. Page Transition
      if (this.config.enablePageTransitions) {
        this.portalTransition = new PortalTransition({
          eventBus: this,
          navigation: this.components.get('navigation'),
          reducedMotion: this.reducedMotion.enabled,
        });
      }
      
      // 12. Global Event Listeners
      this.bindGlobalEvents();
      
      // 13. Render Page Content
      await this.renderPageContent();
      
      // 14. Start Render Loop
      this.start();
      
      this.initialized = true;
      const initTime = performance.now() - startTime;
      this.log(`Initialization complete in ${initTime.toFixed(2)}ms`);
      
      this.emit('app:ready', {
        pageId: this.config.pageId,
        pageType: this.config.pageType,
        systems: this.getSystemStatus(),
        initTime,
      });
      
    } catch (error) {
      this.error('Initialization failed:', error);
      this.emit('app:error', { error, phase: 'initialization' });
    }
  }
  
  /**
   * Get or create WebGL canvas
   */
  getOrCreateCanvas() {
    let canvas = document.querySelector('#ho-webgl-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'ho-webgl-canvas';
      canvas.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        pointer-events: none;
        z-index: -10;
        display: block;
      `;
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    return canvas;
  }
  
  /**
   * Register all component types
   */
  registerComponents() {
    this.componentRegistry = {
      'omni-sphere': OmniSphere,
      'holographic-card': HolographicCard,
      'data-grid': DataGrid,
      'navigation-3d': Navigation3D,
      'portal-transition': PortalTransition,
    };
  }
  
  /**
   * Initialize components from DOM
   */
  async initializeComponents() {
    // Find all components with data-ho-component attribute
    const elements = document.querySelectorAll('[data-ho-component]');
    
    for (const el of elements) {
      const type = el.dataset.hoComponent;
      const ComponentClass = this.componentRegistry[type];
      
      if (ComponentClass) {
        try {
          const instance = new ComponentClass({
            element: el,
            app: this,
            renderEngine: this.renderEngine,
            sceneGraph: this.sceneGraph,
            gsapOrchestrator: this.gsapOrchestrator,
            scrollController: this.scrollController,
            config: JSON.parse(el.dataset.hoConfig || '{}'),
          });
          
          await instance.init();
          
          // Store reference
          if (!this.components.has(type)) {
            this.components.set(type, []);
          }
          this.components.get(type).push(instance);
          
          // Type-specific arrays
          if (type === 'omni-sphere') this.omniSpheres.push(instance);
          if (type === 'holographic-card') this.holographicCards.push(instance);
          if (type === 'data-grid') this.dataGrids.push(instance);
          
          this.log(`Component initialized: ${type}`);
        } catch (error) {
          this.error(`Failed to initialize component ${type}:`, error);
        }
      }
    }
  }
  
  /**
   * Render page content from JSON
   */
  async renderPageContent() {
    // Look for page data script
    const pageDataScript = document.querySelector('#ho-page-data');
    if (pageDataScript) {
      try {
        const pageData = JSON.parse(pageDataScript.textContent);
        await this.jsonRenderer.renderPage(pageData);
      } catch (error) {
        this.error('Failed to render page content:', error);
      }
    }
    
    // Also check for data-ho-page attribute on body
    const pageType = document.body.dataset.pageType;
    if (pageType && pageType !== 'generic') {
      await this.loadPageTypeConfig(pageType);
    }
  }
  
  /**
   * Load page-type specific configuration
   */
  async loadPageTypeConfig(pageType) {
    try {
      const response = await fetch(`/data/pages/${pageType}.json`);
      if (response.ok) {
        const config = await response.json();
        await this.jsonRenderer.applyPageConfig(config);
      }
    } catch (error) {
      this.warn(`Could not load page config for ${pageType}:`, error);
    }
  }
  
  /**
   * Bind global events
   */
  bindGlobalEvents() {
    // Resize
    window.addEventListener('resize', this.debouncedResize.bind(this), { passive: true });
    
    // Visibility
    document.addEventListener('visibilitychange', () => {
      this.setPaused(document.hidden);
    });
    
    // Reduced motion
    this.reducedMotion.onChange((enabled) => {
      this.onReducedMotionChange(enabled);
    });
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.emit('app:keydown', { event: e });
      if (e.key === 'Escape') this.emit('app:escape');
    });
    
    // Mouse/Pointer
    document.addEventListener('pointermove', (e) => {
      this.emit('app:pointermove', { 
        x: e.clientX, 
        y: e.clientY,
        normalized: {
          x: (e.clientX / window.innerWidth) * 2 - 1,
          y: -(e.clientY / window.innerHeight) * 2 + 1,
        }
      });
    }, { passive: true });
    
    // Page lifecycle
    window.addEventListener('beforeunload', () => this.destroy());
    
    // Error boundary
    window.addEventListener('error', (e) => {
      this.emit('app:error', { error: e.error, message: e.message });
    });
    
    window.addEventListener('unhandledrejection', (e) => {
      this.emit('app:error', { error: e.reason, message: 'Unhandled rejection' });
    });
  }
  
  /**
   * Start render loop
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.renderLoop.bind(this));
    this.performance?.start();
    this.emit('app:start');
  }
  
  /**
   * Main render loop
   */
  renderLoop(currentTime) {
    if (!this.running) return;
    
    if (!this.paused) {
      const deltaTime = Math.min(currentTime - this.lastTime, 100) / 1000; // Cap at 100ms
      this.lastTime = currentTime;
      
      // Update systems
      this.update(deltaTime, currentTime / 1000);
      
      // Render
      this.render();
    }
    
    this.frameId = requestAnimationFrame(this.renderLoop.bind(this));
  }
  
  /**
   * Update all systems
   */
  update(deltaTime, elapsedTime) {
    // Update performance monitor
    this.performance?.update(deltaTime);
    
    // Update render engine
    this.renderEngine?.update(deltaTime, elapsedTime);
    
    // Update scene graph
    this.sceneGraph?.update(deltaTime, elapsedTime);
    
    // Update scroll controller
    this.scrollController?.update(deltaTime);
    
    // Update GSAP orchestrator
    this.gsapOrchestrator?.update(deltaTime);
    
    // Update interactions
    this.spatialCursor?.update(deltaTime);
    this.parallaxField?.update(deltaTime);
    this.magneticField?.update(deltaTime);
    
    // Update components
    this.components.forEach((instances) => {
      instances.forEach((instance) => {
        if (instance.update) instance.update(deltaTime, elapsedTime);
      });
    });
    
    // Update omni-spheres
    this.omniSpheres.forEach((sphere) => {
      if (sphere.update) sphere.update(deltaTime, elapsedTime);
    });
    
    // Emit frame event
    this.emit('app:frame', { deltaTime, elapsedTime });
  }
  
  /**
   * Render frame
   */
  render() {
    this.renderEngine?.render();
    this.performance?.frameRendered();
  }
  
  /**
   * Handle performance budget exceeded
   */
  handlePerformanceBudget(metrics) {
    this.warn('Performance budget exceeded:', metrics);
    
    // Reduce quality progressively
    if (metrics.fps < this.config.targetFPS * 0.7) {
      this.renderEngine?.reduceQuality();
    }
    
    if (metrics.fps < this.config.targetFPS * 0.5) {
      this.parallaxField?.setEnabled(false);
      this.magneticField?.setEnabled(false);
      this.spatialCursor?.setEnabled(false);
      
      // Reduce particle counts
      this.components.forEach((instances) => {
        instances.forEach((instance) => {
          if (instance.reduceBudget) instance.reduceBudget();
        });
      });
    }
  }
  
  /**
   * Debounced resize handler
   */
  debouncedResize() {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.handleResize();
    }, 100);
  }
  
  /**
   * Handle resize
   */
  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.renderEngine?.resize(width, height);
    this.scrollController?.refresh();
    this.emit('app:resize', { width, height });
  }
  
  /**
   * Handle reduced motion change
   */
  onReducedMotionChange(enabled) {
    this.gsapOrchestrator?.setReducedMotion(enabled);
    this.scrollController?.setReducedMotion(enabled);
    this.spatialCursor?.setEnabled(!enabled);
    this.parallaxField?.setEnabled(!enabled);
    this.magneticField?.setEnabled(!enabled);
    this.portalTransition?.setReducedMotion(enabled);
    
    this.emit('app:reduced-motion', { enabled });
  }
  
  /**
   * Pause render loop
   */
  setPaused(paused) {
    this.paused = paused;
    this.performance?.setPaused(paused);
    this.emit('app:paused', { paused });
  }
  
  /**
   * Navigate to page with transition
   */
  async navigateTo(url, options = {}) {
    if (this.portalTransition) {
      return this.portalTransition.navigateTo(url, options);
    }
    // Fallback
    window.location.href = url;
  }
  
  /**
   * Get system status
   */
  getSystemStatus() {
    return {
      renderEngine: !!this.renderEngine,
      sceneGraph: !!this.sceneGraph,
      gsapOrchestrator: !!this.gsapOrchestrator,
      scrollController: !!this.scrollController,
      spatialCursor: !!this.spatialCursor,
      parallaxField: !!this.parallaxField,
      magneticField: !!this.magneticField,
      portalTransition: !!this.portalTransition,
      workerPool: !!this.workerPool,
      components: Object.fromEntries(
        Array.from(this.components.entries()).map(([k, v]) => [k, v.length])
      ),
    };
  }
  
  /**
   * Get initial state
   */
  getInitialState() {
    return {
      pageId: this.config.pageId,
      pageType: this.config.pageType,
      theme: 'holographic',
      quality: this.config.qualityLevel,
      reducedMotion: this.reducedMotion.enabled,
      scrollPosition: 0,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  }
  
  /**
   * Public API: Get system instance
   */
  getSystem(name) {
    const systems = {
      renderEngine: this.renderEngine,
      sceneGraph: this.sceneGraph,
      gsapOrchestrator: this.gsapOrchestrator,
      scrollController: this.scrollController,
      spatialCursor: this.spatialCursor,
      parallaxField: this.parallaxField,
      magneticField: this.magneticField,
      portalTransition: this.portalTransition,
      performance: this.performance,
      stateManager: this.stateManager,
      contentEngine: this.contentEngine,
      jsonRenderer: this.jsonRenderer,
    };
    return systems[name];
  }
  
  /**
   * Public API: Register custom component
   */
  registerComponent(type, ComponentClass) {
    this.componentRegistry[type] = ComponentClass;
  }
  
  /**
   * Public API: Create component instance
   */
  async createComponent(type, element, config = {}) {
    const ComponentClass = this.componentRegistry[type];
    if (!ComponentClass) {
      throw new Error(`Component type "${type}" not registered`);
    }
    
    const instance = new ComponentClass({
      element,
      app: this,
      renderEngine: this.renderEngine,
      sceneGraph: this.sceneGraph,
      gsapOrchestrator: this.gsapOrchestrator,
      scrollController: this.scrollController,
      config,
    });
    
    await instance.init();
    return instance;
  }
  
  /**
   * Destroy everything
   */
  destroy() {
    if (!this.initialized) return;
    
    this.log('Destroying Holographic-Omni Premium System...');
    
    // Stop render loop
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    
    // Destroy systems in reverse order
    this.portalTransition?.destroy();
    this.magneticField?.destroy();
    this.parallaxField?.destroy();
    this.spatialCursor?.destroy();
    this.scrollController?.destroy();
    this.gsapOrchestrator?.destroy();
    this.jsonRenderer?.destroy();
    this.contentEngine?.destroy();
    this.stateManager?.destroy();
    
    // Destroy components
    this.components.forEach((instances) => {
      instances.forEach((instance) => instance.destroy?.());
    });
    this.components.clear();
    
    this.sceneGraph?.destroy();
    this.renderEngine?.destroy();
    this.assetManager?.destroy();
    this.workerPool?.destroy();
    this.performance?.destroy();
    this.reducedMotion?.destroy();
    
    // Remove event listeners
    window.removeEventListener('resize', this.debouncedResize);
    this.removeAllListeners();
    
    this.initialized = false;
    this.log('Destruction complete');
  }
  
  // Logging
  log(...args) { if (this.config.debug) console.log('%c[HO]', 'color: #00ffff', ...args); }
  warn(...args) { console.warn('%c[HO] WARN', 'color: #ffd700', ...args); }
  error(...args) { console.error('%c[HO] ERROR', 'color: #ff00aa', ...args); }
}

// Global registration
if (typeof window !== 'undefined') {
  window.HolographicApp = HolographicApp;
  
  // Auto-init if data-ho-auto-init present
  if (document.body.dataset.hoAutoInit !== 'false') {
    document.addEventListener('DOMContentLoaded', () => {
      window.holographicApp = new HolographicApp({
        pageId: document.body.dataset.pageId,
        pageType: document.body.dataset.pageType,
        debug: document.body.dataset.hoDebug === 'true',
      });
    });
  }
}

export default HolographicApp;
