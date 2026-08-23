/**
 * =============================================================================
 * OMNI-SPHERE COMPONENT - Holographic 3D Sphere with Interaction Rings
 * =============================================================================
 */

import { EventEmitter } from '../utils/EventEmitter.js';

export class OmniSphere extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      element: config.element,
      app: config.app,
      renderEngine: config.renderEngine,
      sceneGraph: config.sceneGraph,
      gsapOrchestrator: config.gsapOrchestrator,
      scrollController: config.scrollController,
      config: config.config || {},
    };
    
    // Sphere properties
    this.radius = this.config.config.radius || 120;
    this.segments = this.config.config.segments || 64;
    this.ringCount = this.config.config.rings || 8;
    this.rotationSpeed = this.config.config.rotationSpeed || { x: 0.0003, y: 0.0005, z: 0.0002 };
    this.glowIntensity = this.config.config.glowIntensity || 0.4;
    this.interactive = this.config.config.interactive !== false;
    
    // Three.js objects
    this.mesh = null;
    this.rings = [];
    this.core = null;
    this.material = null;
    this.ringMaterial = null;
    
    // Interaction
    this.mouseInfluence = { x: 0, y: 0, strength: 0 };
    this.targetRotation = { x: 0, y: 0, z: 0 };
    this.currentRotation = { x: 0, y: 0, z: 0 };
    
    // Animation
    this.animating = false;
    this.introTimeline = null;
  }
  
  async init() {
    this.createSphere();
    this.setupInteraction();
    this.animateIn();
  }
  
  createSphere() {
    const { renderEngine } = this.config;
    if (!renderEngine) return;
    
    // Create material
    this.material = renderEngine.createOmniSphereMaterial({
      ringCount: this.ringCount,
      rotationSpeed: this.rotationSpeed.y,
      glowIntensity: this.glowIntensity,
    });
    
    // Create ring material
    this.ringMaterial = renderEngine.createOmniSphereMaterial({
      ringCount: this.ringCount,
      rotationSpeed: this.rotationSpeed.y * 1.5,
      glowIntensity: this.glowIntensity * 0.6,
    });
    
    // Core geometry
    const coreGeometry = new THREE.SphereGeometry(this.radius, this.segments, this.segments);
    this.core = new THREE.Mesh(coreGeometry, this.material);
    
    // Rings
    for (let i = 0; i < this.ringCount; i++) {
      const ringRadius = this.radius * (1 + (i + 1) * 0.12);
      const ringGeometry = new THREE.RingGeometry(
        ringRadius - 2,
        ringRadius + 2,
        this.segments * 2
      );
      
      const ring = new THREE.Mesh(ringGeometry, this.ringMaterial.clone());
      ring.rotation.x = -Math.PI / 2;
      ring.rotation.z = (i % 2) * Math.PI / 4;
      this.rings.push(ring);
      this.core.add(ring);
    }
    
    // Add to scene
    this.config.sceneGraph.addObject(`omni-sphere-${this.config.element.id}`, this.core);
    
    // Position from element
    this.syncPosition();
  }
  
  syncPosition() {
    const el = this.config.element;
    if (!el || !this.core) return;
    
    const rect = el.getBoundingClientRect();
    const { renderEngine } = this.config;
    
    // Convert to 3D space
    const x = (rect.left + rect.width / 2 - window.innerWidth / 2);
    const y = -(rect.top + rect.height / 2 - window.innerHeight / 2);
    const z = -200; // Depth into screen
    
    this.core.position.set(x, y, z);
  }
  
  setupInteraction() {
    if (!this.interactive) return;
    
    const el = this.config.element;
    
    // Mouse enter/leave
    el.addEventListener('mouseenter', () => this.onMouseEnter());
    el.addEventListener('mouseleave', () => this.onMouseLeave());
    
    // Mouse move
    el.addEventListener('mousemove', (e) => this.onMouseMove(e));
    
    // Scroll parallax
    if (this.config.scrollController) {
      this.config.scrollController.on('scroll', (data) => this.onScroll(data));
    }
    
    // Resize
    window.addEventListener('resize', () => this.syncPosition());
  }
  
  onMouseEnter() {
    this.mouseInfluence.strength = 1;
    this.emit('hover:enter');
  }
  
  onMouseLeave() {
    this.mouseInfluence.strength = 0;
    this.emit('hover:leave');
  }
  
  onMouseMove(event) {
    const rect = this.config.element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    this.mouseInfluence.x = (event.clientX - centerX) / (rect.width / 2);
    this.mouseInfluence.y = -(event.clientY - centerY) / (rect.height / 2);
  }
  
  onScroll(data) {
    // Parallax effect based on scroll
    const progress = data.progress || 0;
    this.targetRotation.y += 0.0001 * progress;
  }
  
  animateIn() {
    if (!this.config.gsapOrchestrator) return;
    
    this.introTimeline = this.config.gsapOrchestrator.timeline({
      onComplete: () => this.animating = false,
    });
    
    // Core scale
    this.introTimeline.fromTo(this.core.scale,
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1, duration: 1.2, ease: 'expo.out' }
    );
    
    // Rings stagger
    this.rings.forEach((ring, i) => {
      this.introTimeline.fromTo(ring.scale,
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(1.5)' },
        i * 0.08
      );
    });
    
    // Material opacity
    this.introTimeline.fromTo(this.material.uniforms.uGlowIntensity,
      { value: 0 },
      { value: this.glowIntensity, duration: 1, ease: 'expo.out' },
      0
    );
  }
  
  update(deltaTime, elapsedTime) {
    if (!this.core) return;
    
    // Auto rotation
    this.currentRotation.x += this.rotationSpeed.x * deltaTime * 60;
    this.currentRotation.y += this.rotationSpeed.y * deltaTime * 60;
    this.currentRotation.z += this.rotationSpeed.z * deltaTime * 60;
    
    // Mouse influence
    this.currentRotation.x += (this.mouseInfluence.y * 0.1 - this.currentRotation.x) * 0.05;
    this.currentRotation.y += (this.mouseInfluence.x * 0.1 - this.currentRotation.y) * 0.05;
    
    // Apply rotation
    this.core.rotation.x = this.currentRotation.x;
    this.core.rotation.y = this.currentRotation.y;
    this.core.rotation.z = this.currentRotation.z;
    
    // Ring counter-rotation
    this.rings.forEach((ring, i) => {
      const speed = this.rotationSpeed.y * (1 + i * 0.2) * (i % 2 === 0 ? 1 : -1);
      ring.rotation.z += speed * deltaTime * 60;
    });
    
    // Sync position with element (for scroll)
    this.syncPosition();
  }
  
  reduceBudget() {
    // Reduce ring count
    if (this.rings.length > 4) {
      const toRemove = this.rings.splice(4);
      toRemove.forEach(ring => {
        this.core.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
      });
    }
    
    // Reduce segments
    if (this.segments > 32) {
      this.segments = 32;
      // Would need to recreate geometry
    }
  }
  
  destroy() {
    this.introTimeline?.kill();
    
    if (this.core) {
      this.rings.forEach(ring => {
        ring.geometry.dispose();
        ring.material.dispose();
      });
      this.core.geometry.dispose();
      this.core.material.dispose();
      this.config.sceneGraph.removeObject(`omni-sphere-${this.config.element.id}`);
    }
    
    this.removeAllListeners();
  }
}
