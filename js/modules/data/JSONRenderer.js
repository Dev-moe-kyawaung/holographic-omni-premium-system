/**
 * =============================================================================
 * JSON RENDERER - Data-Driven Page Construction
 * =============================================================================
 * Renders entire pages from JSON configuration using component registry
 * =============================================================================
 */

import { EventEmitter } from '../utils/EventEmitter.js';

export class JSONRenderer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      contentEngine: config.contentEngine,
      sceneGraph: config.sceneGraph,
      renderEngine: config.renderEngine,
      gsapOrchestrator: config.gsapOrchestrator,
    };
    
    this.componentFactories = new Map();
    this.pageCache = new Map();
    this.activePage = null;
  }
  
  /**
   * Register component factory
   */
  registerComponent(type, factory) {
    this.componentFactories.set(type, factory);
  }
  
  /**
   * Render full page from JSON
   */
  async renderPage(pageData) {
    this.emit('page:render:start', { pageId: pageData.id });
    
    try {
      // Clear previous page
      await this.clearPage();
      
      // Store active page
      this.activePage = pageData;
      this.pageCache.set(pageData.id, pageData);
      
      // Render sections
      if (pageData.sections) {
        for (const section of pageData.sections) {
          await this.renderSection(section);
        }
      }
      
      // Render components
      if (pageData.components) {
        for (const component of pageData.components) {
          await this.renderComponent(component);
        }
      }
      
      // Apply animations
      if (pageData.animations) {
        this.applyAnimations(pageData.animations);
      }
      
      // Initialize scroll triggers
      this.initializeScrollTriggers(pageData);
      
      this.emit('page:render:complete', { pageId: pageData.id });
      
    } catch (error) {
      this.error('Page render failed:', error);
      this.emit('page:render:error', { pageId: pageData.id, error });
    }
  }
  
  /**
   * Render a section
   */
  async renderSection(section) {
    const container = document.createElement('section');
    container.className = `ho-section ho-section--${section.type || 'default'}`;
    container.id = section.id || `section-${Date.now()}`;
    
    if (section.className) container.classList.add(section.className);
    if (section.style) Object.assign(container.style, section.style);
    
    // Apply layout
    if (section.layout) {
      this.applyLayout(container, section.layout);
    }
    
    // Render children
    if (section.children) {
      for (const child of section.children) {
        const element = await this.renderNode(child);
        if (element) container.appendChild(element);
      }
    }
    
    // Add to page
    const main = document.querySelector('main, #ho-main, [data-ho-page-content]');
    if (main) {
      main.appendChild(container);
    } else {
      document.body.appendChild(container);
    }
    
    // Animate in
    this.animateIn(container, section.animation);
    
    return container;
  }
  
  /**
   * Render a component
   */
  async renderComponent(component) {
    const factory = this.componentFactories.get(component.type);
    if (!factory) {
      this.warn(`No factory for component type: ${component.type}`);
      return null;
    }
    
    try {
      const instance = await factory.create(component.props, {
        sceneGraph: this.config.sceneGraph,
        renderEngine: this.config.renderEngine,
        gsapOrchestrator: this.config.gsapOrchestrator,
      });
      
      // Mount to DOM if needed
      if (component.mountTo) {
        const mountPoint = document.querySelector(component.mountTo);
        if (mountPoint && instance.element) {
          mountPoint.appendChild(instance.element);
        }
      }
      
      return instance;
    } catch (error) {
      this.error(`Component ${component.type} creation failed:`, error);
      return null;
    }
  }
  
  /**
   * Render any node (element, component, text)
   */
  async renderNode(node) {
    if (!node) return null;
    
    // Text node
    if (typeof node === 'string') {
      return document.createTextNode(node);
    }
    
    // Component
    if (node.component) {
      return this.renderComponent(node);
    }
    
    // Element
    const element = document.createElement(node.tag || 'div');
    
    // Attributes
    if (node.attrs) {
      Object.entries(node.attrs).forEach(([key, value]) => {
        if (key === 'className') {
          element.className = value;
        } else if (key === 'style') {
          Object.assign(element.style, value);
        } else if (key.startsWith('on')) {
          // Event handler
          const event = key.slice(2).toLowerCase();
          element.addEventListener(event, value);
        } else {
          element.setAttribute(key, value);
        }
      });
    }
    
    // Data attributes for animation
    if (node.animate) {
      element.dataset.hoAnimate = node.animate.type;
      if (node.animate.options) {
        element.dataset.hoAnimateOptions = JSON.stringify(node.animate.options);
      }
    }
    
    // Children
    if (node.children) {
      for (const child of node.children) {
        const childElement = await this.renderNode(child);
        if (childElement) element.appendChild(childElement);
      }
    }
    
    return element;
  }
  
  /**
   * Apply layout to container
   */
  applyLayout(container, layout) {
    const styles = {};
    
    switch (layout.type) {
      case 'grid':
        styles.display = 'grid';
        styles.gridTemplateColumns = layout.columns ? `repeat(${layout.columns}, 1fr)` : 'repeat(12, 1fr)';
        styles.gap = layout.gap || 'var(--ho-gap-md)';
        if (layout.templateAreas) styles.gridTemplateAreas = layout.templateAreas;
        break;
        
      case 'flex':
        styles.display = 'flex';
        styles.flexDirection = layout.direction || 'row';
        styles.justifyContent = layout.justify || 'flex-start';
        styles.alignItems = layout.align || 'stretch';
        styles.gap = layout.gap || 'var(--ho-gap-md)';
        styles.flexWrap = layout.wrap ? 'wrap' : 'nowrap';
        break;
        
      case 'masonry':
        styles.display = 'grid';
        styles.gridTemplateColumns = `repeat(auto-fill, minmax(${layout.minWidth || '280px'}, 1fr))`;
        styles.gap = layout.gap || 'var(--ho-gap-md)';
        styles.gridAutoFlow = 'dense';
        break;
    }
    
    // Responsive overrides
    if (layout.responsive) {
      // Handled via CSS container queries or media queries in component styles
      container.dataset.hoLayoutResponsive = JSON.stringify(layout.responsive);
    }
    
    Object.assign(container.style, styles);
  }
  
  /**
   * Apply animations from page data
   */
  applyAnimations(animations) {
    if (!this.config.gsapOrchestrator) return;
    
    animations.forEach((anim) => {
      const elements = document.querySelectorAll(anim.selector);
      elements.forEach((el, index) => {
        const options = {
          ...anim.options,
          delay: (anim.options.delay || 0) + index * (anim.options.stagger || 0),
        };
        
        this.config.gsapOrchestrator.play(anim.type, el, options);
      });
    });
  }
  
  /**
   * Initialize scroll triggers
   */
  initializeScrollTriggers(pageData) {
    if (!this.config.gsapOrchestrator?.scrollController) return;
    
    const scrollTriggers = pageData.scrollTriggers || [];
    scrollTriggers.forEach((trigger) => {
      const elements = document.querySelectorAll(trigger.selector);
      elements.forEach((el) => {
        this.config.gsapOrchestrator.scrollController.createTrigger(el, trigger);
      });
    });
  }
  
  /**
   * Animate element in
   */
  animateIn(element, animation) {
    if (!animation || !this.config.gsapOrchestrator) return;
    
    this.config.gsapOrchestrator.play(animation.type || 'fade-up', element, {
      ...animation.options,
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
    });
  }
  
  /**
   * Clear current page
   */
  async clearPage() {
    // Kill all GSAP animations
    this.config.gsapOrchestrator?.killAll();
    
    // Remove page content
    const main = document.querySelector('main, #ho-main, [data-ho-page-content]');
    if (main) {
      // Animate out
      await this.animateOut(main);
      main.innerHTML = '';
    }
    
    // Clear WebGL scene objects
    this.config.sceneGraph?.clearPageObjects();
  }
  
  /**
   * Animate page out
   */
  animateOut(element) {
    return new Promise((resolve) => {
      if (!this.config.gsapOrchestrator) {
        resolve();
        return;
      }
      
      this.config.gsapOrchestrator.to(element, {
        opacity: 0,
        y: -20,
        duration: 0.3,
        ease: 'expo.in',
        onComplete: resolve,
      });
    });
  }
  
  /**
   * Apply page config (for page-type specific settings)
   */
  async applyPageConfig(config) {
    // Apply theme overrides
    if (config.theme) {
      this.applyTheme(config.theme);
    }
    
    // Apply quality settings
    if (config.quality) {
      this.config.renderEngine?.applyQualitySettings(config.quality);
    }
    
    // Apply particle config
    if (config.particles) {
      this.config.sceneGraph?.configureParticles(config.particles);
    }
    
    // Apply sphere config
    if (config.omniSpheres) {
      this.config.sceneGraph?.configureOmniSpheres(config.omniSpheres);
    }
  }
  
  /**
   * Apply theme
   */
  applyTheme(theme) {
    const root = document.documentElement;
    
    Object.entries(theme).forEach(([key, value]) => {
      if (key.startsWith('--')) {
        root.style.setProperty(key, value);
      }
    });
    
    this.emit('theme:changed', { theme });
  }
  
  /**
   * Get cached page
   */
  getCachedPage(pageId) {
    return this.pageCache.get(pageId);
  }
  
  /**
   * Destroy
   */
  destroy() {
    this.clearPage();
    this.pageCache.clear();
    this.componentFactories.clear();
    this.removeAllListeners();
  }
}
