/**
 * Header Animation Manager
 * Manages the animated gradient effect for the header
 */

class HeaderAnimationManager {
  constructor() {
    this.animationActive = false;
    this.colorSets = [
      // Vibrant color set
      [
        'rgba(255, 0, 204, 0.85)', // Pink
        'rgba(51, 51, 255, 0.85)', // Blue
        'rgba(0, 204, 255, 0.85)', // Cyan
        'rgba(51, 204, 51, 0.85)', // Green
        'rgba(255, 204, 0, 0.85)', // Yellow
        'rgba(255, 51, 153, 0.85)' // Magenta
      ],
      // Cool color set
      [
        'rgba(0, 102, 255, 0.85)', // Blue
        'rgba(51, 204, 255, 0.85)', // Light Blue
        'rgba(102, 0, 255, 0.85)', // Purple
        'rgba(0, 204, 204, 0.85)', // Teal
        'rgba(153, 51, 255, 0.85)', // Violet
        'rgba(0, 153, 204, 0.85)' // Dark Cyan
      ],
      // Warm color set
      [
        'rgba(255, 102, 0, 0.85)', // Orange
        'rgba(255, 51, 51, 0.85)', // Red
        'rgba(255, 153, 51, 0.85)', // Light Orange
        'rgba(204, 51, 0, 0.85)', // Dark Red
        'rgba(255, 204, 51, 0.85)', // Gold
        'rgba(204, 0, 102, 0.85)' // Dark Pink
      ]
    ];
    this.currentColorSet = 0;
    this.animationSpeed = 240; // seconds (4 minutes)
    this.headerElement = null;
    this.gradientElement = null;
  }

  /**
   * Initialize the header animation
   */
  init() {
    // Find the header element
    this.headerElement = document.querySelector('.animated-header');
    
    if (!this.headerElement) {
      console.warn('Header animation: No header element found with class .animated-header');
      return this;
    }
    
    // Find or create the gradient element
    this.gradientElement = this.headerElement.querySelector('.animated-gradient');
    
    if (!this.gradientElement) {
      this.gradientElement = document.createElement('div');
      this.gradientElement.className = 'animated-gradient';
      this.headerElement.appendChild(this.gradientElement);
    }
    
    // Apply initial color set
    this.applyColorSet(this.currentColorSet);
    
    this.animationActive = true;
    return this;
  }
  
  /**
   * Apply a specific color set to the gradient
   * @param {number} setIndex - Index of the color set to apply
   */
  applyColorSet(setIndex) {
    if (!this.gradientElement) return this;
    
    if (setIndex >= 0 && setIndex < this.colorSets.length) {
      const colors = this.colorSets[setIndex].join(', ');
      this.gradientElement.style.background = `linear-gradient(45deg, ${colors})`;
      this.gradientElement.style.backgroundSize = '600% 600%';
      this.currentColorSet = setIndex;
    }
    
    return this;
  }
  
  /**
   * Change to the next color set
   */
  nextColorSet() {
    const nextSet = (this.currentColorSet + 1) % this.colorSets.length;
    return this.applyColorSet(nextSet);
  }
  
  /**
   * Set the animation speed
   * @param {number} seconds - Animation duration in seconds
   */
  setAnimationSpeed(seconds) {
    if (!this.gradientElement) return this;
    
    this.animationSpeed = seconds;
    this.gradientElement.style.animationDuration = `${seconds}s`;
    
    return this;
  }
  
  /**
   * Stop the animation
   */
  stop() {
    if (this.gradientElement) {
      this.gradientElement.style.animation = 'none';
      this.animationActive = false;
    }
    
    return this;
  }
  
  /**
   * Resume the animation
   */
  resume() {
    if (this.gradientElement) {
      this.gradientElement.style.animation = `gradientAnimation ${this.animationSpeed}s ease infinite`;
      this.animationActive = true;
    }
    
    return this;
  }
  
  /**
   * Toggle the animation on/off
   */
  toggle() {
    return this.animationActive ? this.stop() : this.resume();
  }
}

// Create and export singleton instance
const headerAnimationManager = new HeaderAnimationManager();
export default headerAnimationManager;
