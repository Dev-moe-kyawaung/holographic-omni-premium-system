/**
 * =============================================================================
 * GSAP ORCHESTRATOR - Centralized Animation Management
 * =============================================================================
 * Registers, sequences, and orchestrates all GSAP animations with ScrollTrigger
 * =============================================================================
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { EventEmitter } from '../utils/EventEmitter.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

export class GSAPOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      reducedMotion: config.reducedMotion || false,
      scrollController: config.scrollController,
      defaultDuration: 0.8,
      defaultEase: 'expo.out',
    };
    
    this.animations = new Map();
    this.timelines = new Map();
    this.activeAnimations = new Map();
    this.scrollTriggers = [];
    
    // Register built-in animations
    this.registerBuiltins();
  }
  
  registerBuiltins() {
    // Reveal animations
    this.register('fade-up', (el, options) => this.createReveal(el, { y: 60, ...options }));
    this.register('fade-down', (el, options) => this.createReveal(el, { y: -60, ...options }));
    this.register('fade-left', (el, options) => this.createReveal(el, { x: -60, ...options }));
    this.register('fade-right', (el, options) => this.createReveal(el, { x: 60, ...options }));
    this.register('scale-up', (el, options) => this.createReveal(el, { scale: 0.8, ...options }));
    this.register('scale-down', (el, options) => this.createReveal(el, { scale: 1.2, ...options }));
    this.register('rotate-in', (el, options) => this.createReveal(el, { rotation: -15, ...options }));
    this.register('flip-x', (el, options) => this.createReveal(el, { rotateX: -90, transformOrigin: 'center bottom', ...options }));
    this.register('flip-y', (el, options) => this.createReveal(el, { rotateY: 90, transformOrigin: 'center right', ...options }));
    
    // Text animations
    this.register('text-reveal', (el, options) => this.createTextReveal(el, options));
    this.register('text-reveal-lines', (el, options) => this.createTextReveal(el, { ...options, splitType: 'lines' }));
    this.register('text-reveal-words', (el, options) => this.createTextReveal(el, { ...options, splitType: 'words' }));
    this.register('text-reveal-chars', (el, options) => this.createTextReveal(el, { ...options, splitType: 'chars' }));
    this.register('text-scramble', (el, options) => this.createTextScramble(el, options));
    this.register('text-typewriter', (el, options) => this.createTypewriter(el, options));
    
    // Stagger
    this.register('stagger', (container, options) => this.createStagger(container, options));
    this.register('stagger-grid', (container, options) => this.createStaggerGrid(container, options));
    
    // UI animations
    this.register('slide-panel', (el, options) => this.createSlidePanel(el, options));
    this.register('modal-enter', (el, options) => this.createModalEnter(el, options));
    this.register('tooltip-show', (el, options) => this.createTooltip(el, options));
    this.register('dropdown-open', (el, options) => this.createDropdown(el, options));
    
    // Holographic specific
    this.register('hologram-materialize', (el, options) => this.createHologramMaterialize(el, options));
    this.register('prism-shift', (el, options) => this.createPrismShift(el, options));
    this.register('volumetric-glow', (el, options) => this.createVolumetricGlow(el, options));
    this.register('data-count', (el, options) => this.createDataCount(el, options));
    this.register('progress-ring', (el, options) => this.createProgressRing(el, options));
    
    // Looping
    this.register('float', (el, options) => this.createFloat(el, options));
    this.register('pulse', (el, options) => this.createPulse(el, options));
    this.register('orbit', (el, options) => this.createOrbit(el, options));
    this.register('morph', (el, options) => this.createMorph(el, options));
  }
  
  /**
   * Create reveal animation
   */
  createReveal(element, options = {}) {
    const {
      y = 0, x = 0, scale = 1, rotation = 0, rotateX = 0, rotateY = 0,
      opacity = 0,
      duration = this.config.defaultDuration,
      ease = this.config.defaultEase,
      delay = 0,
      transformOrigin = 'center center',
      scrollTrigger = true,
      ...rest
    } = options;
    
    const fromVars = { opacity, transformOrigin };
    if (y !== 0) fromVars.y = y;
    if (x !== 0) fromVars.x = x;
    if (scale !== 1) fromVars.scale = scale;
    if (rotation !== 0) fromVars.rotation = rotation;
    if (rotateX !== 0) fromVars.rotateX = rotateX;
    if (rotateY !== 0) fromVars.rotateY = rotateY;
    
    const toVars = {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      rotation: 0,
      rotateX: 0,
      rotateY: 0,
      duration,
      ease,
      delay,
      ...rest,
    };
    
    if (scrollTrigger && !this.config.reducedMotion) {
      toVars.scrollTrigger = this.createScrollTrigger(element, options.scrollTrigger);
    } else if (this.config.reducedMotion) {
      toVars.duration = 0;
    }
    
    return gsap.fromTo(element, fromVars, toVars);
  }
  
  /**
   * Create text reveal with SplitText
   */
  createTextReveal(element, options = {}) {
    const {
      splitType = 'chars',
      duration = 0.6,
      ease = 'expo.out',
      stagger = 0.02,
      delay = 0,
      y = '100%',
      opacity = 0,
      rotateX = 0,
      scrollTrigger = true,
      ...rest
    } = options;
    
    // Split text
    const split = new SplitText(element, { 
      type: splitType,
      linesClass: 'ho-split-line',
      wordsClass: 'ho-split-word',
      charsClass: 'ho-split-char',
    });
    
    const targets = split[splitType === 'chars' ? 'chars' : splitType === 'words' ? 'words' : 'lines'];
    
    const fromVars = { opacity, y, rotateX };
    const toVars = {
      opacity: 1,
      y: 0,
      rotateX: 0,
      duration,
      ease,
      stagger: {
        each: stagger,
        from: 'start',
        grid: 'auto',
      },
      delay,
      ...rest,
    };
    
    if (scrollTrigger && !this.config.reducedMotion) {
      toVars.scrollTrigger = this.createScrollTrigger(element, options.scrollTrigger);
    } else if (this.config.reducedMotion) {
      toVars.duration = 0;
      toVars.stagger = 0;
    }
    
    return gsap.fromTo(targets, fromVars, toVars);
  }
  
  /**
   * Create text scramble
   */
  createTextScramble(element, options = {}) {
    const { text, duration = 1, ease = 'none', delay = 0, chars = '!@#$%^&*()_+-=[]{}|;:,.<>?' } = options;
    const originalText = element.textContent;
    
    return gsap.to(element, {
      duration,
      ease,
      delay,
      scrambleText: { text: text || originalText, chars, revealDelay: 0.3 },
      scrollTrigger: this.createScrollTrigger(element, options.scrollTrigger),
    });
  }
  
  /**
   * Create typewriter effect
   */
  createTypewriter(element, options = {}) {
    const { duration = 2, ease = 'none', delay = 0, cursor = '|' } = options;
    const text = element.textContent;
    element.textContent = '';
    
    return gsap.to(element, {
      duration,
      ease,
      delay,
      text: { value: text, delimiter: '', cursor },
      scrollTrigger: this.createScrollTrigger(element, options.scrollTrigger),
    });
  }
  
  /**
   * Create stagger animation
   */
  createStagger(container, options = {}) {
    const {
      selector = '[data-ho-stagger], > *',
      y = 40,
      opacity = 0,
      duration = 0.6,
      ease = 'expo.out',
      stagger = 0.08,
      delay = 0,
      scrollTrigger = true,
      ...rest
    } = options;
    
    const children = container.querySelectorAll(selector);
    if (!children.length) return gsap.timeline();
    
    const fromVars = { y, opacity };
    const toVars = {
      y: 0,
      opacity: 1,
      duration,
      ease,
      stagger: {
        each: stagger,
        from: 'start',
      },
      delay,
      ...rest,
    };
    
    if (scrollTrigger && !this.config.reducedMotion) {
      toVars.scrollTrigger = this.createScrollTrigger(container, options.scrollTrigger);
    } else if (this.config.reducedMotion) {
      toVars.duration = 0;
      toVars.stagger = 0;
    }
    
    return gsap.fromTo(children, fromVars, toVars);
  }
  
  /**
   * Create grid stagger
   */
  createStaggerGrid(container, options = {}) {
    const optionsWithGrid = {
      ...options,
      stagger: {
        each: options.stagger || 0.08,
        from: 'center',
        grid: 'auto',
      },
    };
    return this.createStagger(container, optionsWithGrid);
  }
  
  /**
   * Create hologram materialize
   */
  createHologramMaterialize(element, options = {}) {
    const { duration = 1.2, ease = 'expo.out', delay = 0, scanLines = true } = options;
    
    const tl = gsap.timeline({ delay });
    
    // Scale from 0 with rotation
    tl.fromTo(element,
      { scale: 0.1, rotationX: -90, opacity: 0 },
      { scale: 1, rotationX: 0, opacity: 1, duration, ease, transformOrigin: 'center center' }
    );
    
    // Scan line effect
    if (scanLines) {
      const scanLine = document.createElement('div');
      scanLine.style.cssText = `
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, #00ffff, transparent);
        pointer-events: none;
        z-index: 10;
      `;
      element.style.position = 'relative';
      element.appendChild(scanLine);
      
      tl.fromTo(scanLine,
        { y: '-100%', opacity: 0 },
        { y: '100%', opacity: 1, duration: duration * 0.8, ease: 'none' },
        0
      ).to(scanLine, { opacity: 0, duration: 0.2 }, '>-0.2');
    }
    
    // Glow pulse
    tl.fromTo(element,
      { filter: 'drop-shadow(0 0 0 #00ffff)' },
      { filter: 'drop-shadow(0 0 30px #00ffff)', duration: duration * 0.5, yoyo: true, repeat: 1 },
      0
    );
    
    return tl;
  }
  
  /**
   * Create prism color shift
   */
  createPrismShift(element, options = {}) {
    const { duration = 3, ease = 'none', repeat = -1 } = options;
    
    return gsap.to(element, {
      '--ho-iridescence-shift': '360deg',
      duration,
      ease,
      repeat,
    });
  }
  
  /**
   * Create volumetric glow pulse
   */
  createVolumetricGlow(element, options = {}) {
    const { duration = 2, ease = 'sine.inOut', repeat = -1, color = '#00ffff', maxSpread = 60 } = options;
    
    return gsap.to(element, {
      boxShadow: `0 0 ${maxSpread}px ${color}, 0 0 ${maxSpread * 2}px ${color}`,
      duration,
      ease,
      yoyo: true,
      repeat,
    });
  }
  
  /**
   * Create data counter
   */
  createDataCount(element, options = {}) {
    const { to = 100, from = 0, duration = 1.5, ease = 'expo.out', decimals = 0, prefix = '', suffix = '', formatter } = options;
    
    const obj = { value: from };
    
    return gsap.to(obj, {
      value: to,
      duration,
      ease,
      scrollTrigger: this.createScrollTrigger(element, options.scrollTrigger),
      onUpdate: () => {
        const formatted = formatter ? formatter(obj.value) : obj.value.toFixed(decimals);
        element.textContent = prefix + formatted + suffix;
      },
      onComplete: () => {
        const formatted = formatter ? formatter(to) : to.toFixed(decimals);
        element.textContent = prefix + formatted + suffix;
      },
    });
  }
  
  /**
   * Create progress ring
   */
  createProgressRing(element, options = {}) {
    const { to = 100, duration = 1.2, ease = 'expo.out', strokeWidth = 4, color = '#00ffff' } = options;
    
    // Create SVG if not exists
    let svg = element.querySelector('svg');
    let circle = element.querySelector('circle');
    
    if (!svg) {
      const size = 60;
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
      svg.style.transform = 'rotate(-90deg)';
      
      circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', size / 2);
      circle.setAttribute('cy', size / 2);
      circle.setAttribute('r', size / 2 - strokeWidth);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', strokeWidth);
      circle.setAttribute('stroke-linecap', 'round');
      circle.style.strokeDasharray = 2 * Math.PI * (size / 2 - strokeWidth);
      circle.style.strokeDashoffset = circle.style.strokeDasharray;
      
      svg.appendChild(circle);
      element.appendChild(svg);
    }
    
    const circumference = parseFloat(circle.style.strokeDasharray);
    
    return gsap.to(circle, {
      strokeDashoffset: circumference * (1 - to / 100),
      duration,
      ease,
      scrollTrigger: this.createScrollTrigger(element, options.scrollTrigger),
    });
  }
  
  /**
   * Create float animation
   */
  createFloat(element, options = {}) {
    const { y = -20, x = 0, duration = 3, ease = 'sine.inOut', repeat = -1, yoyo = true } = options;
    
    return gsap.to(element, {
      y, x,
      duration,
      ease,
      repeat,
      yoyo,
    });
  }
  
  /**
   * Create pulse animation
   */
  createPulse(element, options = {}) {
    const { scale = 1.05, duration = 1.5, ease = 'sine.inOut', repeat = -1, yoyo = true } = options;
    
    return gsap.to(element, {
      scale,
      duration,
      ease,
      repeat,
      yoyo,
    });
  }
  
  /**
   * Create orbit animation
   */
  createOrbit(element, options = {}) {
    const { radius = 100, duration = 10, ease = 'none', repeat = -1, angle = 0 } = options;
    
    return gsap.to(element, {
      motionPath: {
        path: [
          { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
          { x: Math.cos(angle + Math.PI/2) * radius, y: Math.sin(angle + Math.PI/2) * radius },
          { x: Math.cos(angle + Math.PI) * radius, y: Math.sin(angle + Math.PI) * radius },
          { x: Math.cos(angle + 3*Math.PI/2) * radius, y: Math.sin(angle + 3*Math.PI/2) * radius },
          { x: Math.cos(angle + 2*Math.PI) * radius, y: Math.sin(angle + 2*Math.PI) * radius },
        ],
        curviness: 1,
        autoRotate: false,
      },
      duration,
      ease,
      repeat,
    });
  }
  
  /**
   * Create morph animation (SVG)
   */
  createMorph(element, options = {}) {
    const { paths, duration = 2, ease = 'power2.inOut', repeat = -1, yoyo = true } = options;
    
    if (!paths || !paths.length) return gsap.timeline();
    
    const tl = gsap.timeline({ repeat, yoyo });
    
    paths.forEach((path, i) => {
      tl.to(element, {
        morphSVG: path,
        duration,
        ease,
      }, i === 0 ? 0 : '+=0');
    });
    
    return tl;
  }
  
  /**
   * Create slide panel
   */
  createSlidePanel(element, options = {}) {
    const { direction = 'right', duration = 0.5, ease = 'expo.out' } = options;
    
    const from = { opacity: 0 };
    from[direction] = direction === 'left' || direction === 'right' ? (direction === 'left' ? -100 : 100) : 0;
    from[direction === 'left' || direction === 'right' ? 'y' : 'x'] = direction === 'top' || direction === 'bottom' ? (direction === 'top' ? -100 : 100) : 0;
    
    return gsap.fromTo(element, from, {
      opacity: 1,
      x: 0,
      y: 0,
      duration,
      ease,
    });
  }
  
  /**
   * Create modal enter
   */
  createModalEnter(element, options = {}) {
    const { duration = 0.4, ease = 'expo.out', backdrop = true } = options;
    
    const tl = gsap.timeline();
    
    tl.fromTo(element,
      { scale: 0.9, opacity: 0 },
      { scale: 1, opacity: 1, duration, ease }
    );
    
    if (backdrop) {
      const backdropEl = element.querySelector('.ho-modal-backdrop') || element.previousElementSibling;
      if (backdropEl) {
        tl.fromTo(backdropEl, { opacity: 0 }, { opacity: 1, duration: duration * 0.5 }, 0);
      }
    }
    
    return tl;
  }
  
  /**
   * Create tooltip
   */
  createTooltip(element, options = {}) {
    const { duration = 0.2, ease = 'expo.out' } = options;
    
    return gsap.fromTo(element,
      { scale: 0, opacity: 0, y: 10 },
      { scale: 1, opacity: 1, y: 0, duration, ease },
    );
  }
  
  /**
   * Create dropdown
   */
  createDropdown(element, options = {}) {
    const { duration = 0.3, ease = 'expo.out' } = options;
    
    return gsap.fromTo(element,
      { opacity: 0, y: -10, scaleY: 0.8 },
      { opacity: 1, y: 0, scaleY: 1, duration, ease, transformOrigin: 'top center' },
    );
  }
  
  /**
   * Register custom animation
   */
  register(name, factory) {
    this.animations.set(name, factory);
    this.emit('animation:registered', { name });
  }
  
  /**
   * Play animation
   */
  play(name, element, options = {}) {
    if (!element) return null;
    
    const factory = this.animations.get(name);
    if (!factory) {
      this.error(`Animation "${name}" not found`);
      return null;
    }
    
    // Handle reduced motion
    if (this.config.reducedMotion) {
      options.duration = 0;
      options.scrollTrigger = false;
    }
    
    try {
      const animation = factory(element, options);
      
      // Track active animation
      const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.activeAnimations.set(id, { name, element, animation, options });
      
      // Cleanup on complete
      if (animation && animation.eventCallback) {
        animation.eventCallback('onComplete', () => {
          this.activeAnimations.delete(id);
        });
      }
      
      this.emit('animation:play', { id, name, element, options });
      return animation;
    } catch (error) {
      this.error(`Failed to play animation "${name}":`, error);
      return null;
    }
  }
  
  /**
   * Create ScrollTrigger config
   */
  createScrollTrigger(element, options = {}) {
    if (options === false) return null;
    
    return {
      trigger: options.trigger || element,
      start: options.start || 'top 85%',
      end: options.end || 'bottom 20%',
      toggleActions: options.toggleActions || 'play none none reverse',
      scrub: options.scrub || false,
      pin: options.pin || false,
      pinSpacing: options.pinSpacing !== false,
      markers: options.markers || false,
      onEnter: () => this.emit('scroll:enter', { element }),
      onLeave: () => this.emit('scroll:leave', { element }),
      onEnterBack: () => this.emit('scroll:enterBack', { element }),
      onLeaveBack: () => this.emit('scroll:leaveBack', { element }),
      ...options,
    };
  }
  
  /**
   * Create timeline
   */
  timeline(options = {}) {
    return gsap.timeline(options);
  }
  
  /**
   * Kill animation
   */
  kill(id) {
    const anim = this.activeAnimations.get(id);
    if (anim && anim.animation) {
      anim.animation.kill();
      this.activeAnimations.delete(id);
    }
  }
  
  /**
   * Kill all
   */
  killAll() {
    this.activeAnimations.forEach((anim, id) => {
      if (anim.animation) anim.animation.kill();
    });
    this.activeAnimations.clear();
    
    // Kill all ScrollTriggers
    ScrollTrigger.getAll().forEach(t => t.kill());
    this.scrollTriggers = [];
  }
  
  /**
   * Set reduced motion
   */
  setReducedMotion(enabled) {
    this.config.reducedMotion = enabled;
    if (enabled) {
      this.activeAnimations.forEach((anim) => {
        if (anim.animation && anim.animation.timeScale) {
          anim.animation.timeScale(100);
        }
      });
    }
  }
  
  /**
   * Update (called each frame)
   */
  update(deltaTime) {
    // Update ScrollTrigger
    ScrollTrigger.update();
  }
  
  /**
   * Destroy
   */
  destroy() {
    this.killAll();
    this.animations.clear();
    this.timelines.clear();
    SplitText.revert();
    this.removeAllListeners();
  }
}
