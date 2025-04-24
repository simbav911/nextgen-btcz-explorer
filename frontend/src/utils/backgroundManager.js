/**
 * Background Animation Manager
 * Manages different background animation styles and allows for switching between them
 */

import primaryAnimation from './backgroundAnimation';
import alternativeAnimation from './backgroundAnimationAlt';

class BackgroundManager {
  constructor() {
    this.animations = {
      primary: primaryAnimation,
      alternative: alternativeAnimation
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
