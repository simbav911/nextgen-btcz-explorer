/**
 * Background Animation Manager
 * Manages different background animation styles and allows for switching between them
 */

import primaryAnimation from './backgroundAnimation';

// The alternative style is not used by default, so it is loaded on demand
// instead of being shipped in the main bundle.
const loadAlternativeAnimation = () =>
  import('./backgroundAnimationAlt').then(mod => mod.default);

class BackgroundManager {
  constructor() {
    this.animations = {
      primary: primaryAnimation,
      alternative: null
    };
    this.loaders = {
      alternative: loadAlternativeAnimation
    };
    this.activeAnimation = null;
    this.activeStyle = 'primary';
    this.initialized = false;
  }
  
  /**
   * Initialize the background animation
   * @param {string} style - The animation style to use ('primary' or 'alternative')
   */
  init(style = 'primary') {
    // Stop any current animation
    this.stop();
    
    // Set the active style
    this.activeStyle = style in this.animations ? style : 'primary';

    if (!this.animations[this.activeStyle] && this.loaders[this.activeStyle]) {
      const requested = this.activeStyle;
      this.loaders[requested]().then(animation => {
        this.animations[requested] = animation;
        // Only start it if nothing else was selected in the meantime
        if (this.activeStyle === requested) {
          this.activeAnimation = animation;
          animation.init();
          this.initialized = true;
        }
      });
      return this;
    }

    this.activeAnimation = this.animations[this.activeStyle];
    
    // Initialize the animation
    this.activeAnimation.init();
    this.initialized = true;
    
    return this;
  }
  
  /**
   * Switch to a different animation style
   * @param {string} style - The animation style to switch to
   */
  switchStyle(style) {
    if (style === this.activeStyle) return this;
    
    if (style in this.animations) {
      this.stop();
      this.init(style);
    }
    
    return this;
  }
  
  /**
   * Stop the current animation
   */
  stop() {
    if (this.activeAnimation) {
      this.activeAnimation.stop();
    }
    return this;
  }
  
  /**
   * Get the currently active animation style
   * @returns {string} The active animation style
   */
  getActiveStyle() {
    return this.activeStyle;
  }
  
  /**
   * Check if the background animation is initialized
   * @returns {boolean} True if initialized, false otherwise
   */
  isInitialized() {
    return this.initialized;
  }
}

// Create and export singleton instance
const backgroundManager = new BackgroundManager();
export default backgroundManager;
