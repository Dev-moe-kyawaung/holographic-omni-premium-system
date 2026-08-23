/**
 * =============================================================================
 * SPATIAL CURSOR - 3D Cursor with Magnetic Field Detection
 * =============================================================================
 */

import { EventEmitter } from '../utils/EventEmitter.js';

export class SpatialCursor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      renderEngine: config.renderEngine,
      sceneGraph: config.sceneGraph,
      enabled: true,
    };
    
    // DOM cursor
    this.cursor = null;
    this.cursorOuter = null;
    this.cursorInner = null;
    
    // 3D cursor
    this.cursor3D = null;
    this.cursorTrail = [];
    this.maxTrailLength = 20;
    
    // State
    this.position = { x: 0, y: 0 };
    this.normalized = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.targetScale = 1;
    this.currentScale = 1;
    
    // Magnetic targets
    this.magneticTargets = new Map();
    this.activeMagnetic = null;
    this.magneticStrength = 0;
    
    // Click ripple
    this.rippleElements = [];
    
    this.init();
  }
  
  init() {
    this.createDOMCursor();
    this.create3DCursor();
    this.bindEvents();
  }
  
  createDOMCursor() {
    // Outer ring
    this.cursorOuter = document.createElement('div');
    this.cursorOuter.className = 'ho-cursor__outer';
    this.cursorOuter.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 32px; height: 32px;
      border: 2px solid #00ffff;
      border-radius: 50%;
      pointer-events: none;
      z-index: 10000;
      transform: translate(-50%, -50%);
      transition: width 0.2s ease-out, height 0.2s ease-out, border-color 0.3s ease-out;
      mix-blend-mode: difference;
      animation: ho-cursor-pulse 2s ease-in-out infinite;
    `;
    
    // Inner dot
    this.cursorInner = document.createElement('div');
    this.cursorInner.className = 'ho-cursor__inner';
    this.cursorInner.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      width: 8px; height: 8px;
      background: #00ffff;
      border-radius: 50%;
      transform: translate(-50%, -50%);
    `;
    
    this.cursorOuter.appendChild(this.cursorInner);
    document.body.appendChild(this.cursorOuter);
    
    // Add keyframes
    this.addCursorStyles();
  }
  
  addCursorStyles() {
    if (document.getElementById('ho-cursor-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ho-cursor-styles';
    style.textContent = `
      @keyframes ho-cursor-pulse {
        0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
        50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.3; }
      }
      @keyframes ho-cursor-click {
        0% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(0.5); }
        100% { transform: translate(-50%, -50%) scale(1); }
      }
      .ho-cursor--magnetic .ho-cursor__outer {
        width: 64px !important;
        height: 64px !important;
        border-color: #ffd700 !important;
        animation: none !important;
      }
      .ho-cursor--magnetic .ho-cursor__inner {
        width: 16px !important;
        height: 16px !important;
        background: #ffd700 !important;
      }
      .ho-cursor--click .ho-cursor__outer {
        animation: ho-cursor-click 0.3s ease-out !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  create3DCursor() {
    if (!this.config.renderEngine) return;
    
    // Create 3D cursor particle
    const geometry = new THREE.SphereGeometry(2, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    
    this.cursor3D = new THREE.Mesh(geometry, material);
    this.config.sceneGraph.addObject('spatial-cursor', this.cursor3D);
    
    // Trail
    for (let i = 0; i < this.maxTrailLength; i++) {
      const trailGeo = new THREE.SphereGeometry(2 - i * 0.08, 8, 8);
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const trail = new THREE.Mesh(trailGeo, trailMat);
      this.cursorTrail.push(trail);
      this.config.sceneGraph.addObject(`spatial-cursor-trail-${i}`, trail);
    }
  }
  
  bindEvents() {
    // Mouse move
    document.addEventListener('mousemove', (e) => this.onMouseMove(e), { passive: true });
    
    // Mouse down/up
    document.addEventListener('mousedown', () => this.onMouseDown());
    document.addEventListener('mouseup', () => this.onMouseUp());
    
    // Touch
    document.addEventListener('touchmove', (e) => {
      if (e.touches[0]) this.onMouseMove(e.touches[0]);
    }, { passive: true });
    
    document.addEventListener('touchstart', () => this.onMouseDown());
    document.addEventListener('touchend', () => this.onMouseUp());
    
    // Magnetic element detection
    this.scanMagneticTargets();
    
    // Re-scan on DOM changes
    const observer = new MutationObserver(() => this.scanMagneticTargets());
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  scanMagneticTargets() {
    const magneticElements = document.querySelectorAll('[data-ho-magnetic], .ho-btn-magnetic, .ho-card--holographic, .ho-omni-sphere');
    
    magneticElements.forEach((el) => {
      if (!this.magneticTargets.has(el)) {
        this.magneticTargets.set(el, {
          element: el,
          rect: null,
          strength: parseFloat(el.dataset.hoMagneticStrength) || 1,
        });
      }
    });
    
    // Remove stale targets
    this.magneticTargets.forEach((data, el) => {
      if (!document.body.contains(el)) {
        this.magneticTargets.delete(el);
      }
    });
  }
  
  onMouseMove(event) {
    this.position.x = event.clientX;
    this.position.y = event.clientY;
    this.normalized.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.normalized.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update DOM cursor
    this.cursorOuter.style.transform = `translate(-50%, -50%) translate(${event.clientX}px, ${event.clientY}px)`;
    
    // Check magnetic targets
    this.checkMagneticTargets();
  }
  
  checkMagneticTargets() {
    let closestTarget = null;
    let closestDistance = Infinity;
    
    this.magneticTargets.forEach((data, el) => {
      const rect = el.getBoundingClientRect();
      data.rect = rect;
      
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const dx = this.position.x - centerX;
      const dy = this.position.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = Math.max(rect.width, rect.height) * data.strength;
      
      if (distance < maxDistance && distance < closestDistance) {
        closestDistance = distance;
        closestTarget = data;
      }
    });
    
    if (closestTarget) {
      this.activateMagnetic(closestTarget, closestDistance);
    } else {
      this.deactivateMagnetic();
    }
  }
  
  activateMagnetic(target, distance) {
    if (this.activeMagnetic !== target.element) {
      this.activeMagnetic = target.element;
      this.cursorOuter.classList.add('ho-cursor--magnetic');
      this.cursorInner.classList.add('ho-cursor--magnetic');
      this.emit('magnetic:enter', { element: target.element });
    }
    
    // Calculate influence
    const rect = target.rect;
    const maxDistance = Math.max(rect.width, rect.height) * target.strength;
    this.magneticStrength = 1 - distance / maxDistance;
    
    // Pull cursor toward target
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const pullX = (centerX - this.position.x) * this.magneticStrength * 0.3;
    const pullY = (centerY - this.position.y) * this.magneticStrength * 0.3;
    
    this.cursorOuter.style.transform = `translate(-50%, -50%) translate(${this.position.x + pullX}px, ${this.position.y + pullY}px)`;
    
    // Scale based on strength
    this.targetScale = 1 + this.magneticStrength * 1.5;
  }
  
  deactivateMagnetic() {
    if (this.activeMagnetic) {
      this.emit('magnetic:leave', { element: this.activeMagnetic });
      this.activeMagnetic = null;
    }
    
    this.magneticStrength = 0;
    this.targetScale = 1;
    this.cursorOuter.classList.remove('ho-cursor--magnetic');
    this.cursorInner.classList.remove('ho-cursor--magnetic');
  }
  
  onMouseDown() {
    this.cursorOuter.classList.add('ho-cursor--click');
    this.createRipple();
    
    setTimeout(() => {
      this.cursorOuter.classList.remove('ho-cursor--click');
    }, 300);
  }
  
  onMouseUp() {
    // Handled by timeout in mousedown
  }
  
  createRipple() {
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: fixed;
      top: ${this.position.y}px;
      left: ${this.position.x}px;
      width: 0; height: 0;
      border: 2px solid #00ffff;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      animation: ho-ripple 0.6s ease-out forwards;
    `;
    
    document.body.appendChild(ripple);
    
    // Cleanup
    setTimeout(() => ripple.remove(), 600);
  }
  
  update(deltaTime) {
    if (!this.config.enabled) return;
    
    // Smooth scale
    this.currentScale += (this.targetScale - this.currentScale) * 0.15;
    this.cursorOuter.style.transform = this.cursorOuter.style.transform.replace(/scale([^)]*)/, '') + ` scale(${this.currentScale})`;
    
    // Update 3D cursor
    if (this.cursor3D && this.config.renderEngine) {
      const { camera } = this.config.renderEngine;
      
      // Convert screen to world
      const vector = new THREE.Vector3(this.normalized.x, this.normalized.y, 0.5);
      vector.unproject(camera);
      
      const dir = vector.sub(camera.position).normalize();
      const distance = 100;
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));
      
      this.cursor3D.position.lerp(pos, 0.2);
      
      // Update trail
      this.cursorTrail.forEach((trail, i) => {
        const targetPos = this.cursor3D.position.clone();
        trail.position.lerp(targetPos, 0.1 * (i + 1));
        trail.material.opacity = (1 - i / this.maxTrailLength) * 0.5;
        trail.scale.setScalar(1 - i / this.maxTrailLength);
      });
    }
  }
  
  setEnabled(enabled) {
    this.config.enabled = enabled;
    this.cursorOuter.style.display = enabled ? 'block' : 'none';
    
    if (this.cursor3D) {
      this.cursor3D.visible = enabled;
      this.cursorTrail.forEach(t => t.visible = enabled);
    }
  }
  
  destroy() {
    this.cursorOuter?.remove();
    this.cursorTrail.forEach(t => {
      this.config.sceneGraph?.removeObject(t.name);
    });
    this.config.sceneGraph?.removeObject('spatial-cursor');
    this.removeAllListeners();
  }
}
