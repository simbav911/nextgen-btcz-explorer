/**
 * BitcoinZ Explorer Alternative Background Animation
 * A different style with floating blockchain-like elements
 */

class AlternativeBackgroundAnimation {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.blocks = [];
    this.blockCount = 30;
    this.colors = {
      primary: '#3B82F6',    // Blue
      secondary: '#8B5CF6',  // Purple
      accent1: '#10B981',    // Green
      accent2: '#F59E0B'     // Orange
    };
    this.animationFrameId = null;
    this.isMobile = window.innerWidth < 768;
  }

  init() {
    // Create canvas element if it doesn't exist
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'bg-canvas';
      
      // Find or create container
      let container = document.getElementById('bg-animation-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'bg-animation-container';
        container.className = 'bg-animation-container';
        document.body.prepend(container);
      }
      
      container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      
      // Handle resize
      window.addEventListener('resize', this.handleResize.bind(this));
      this.handleResize();
      
      // Create initial blocks
      this.initBlocks();
      
      // Start the animation
      this.animate();
    }
  }
  
  handleResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.isMobile = window.innerWidth < 768;
    
    // Adjust block count based on screen size
    this.blockCount = this.isMobile ? 15 : 30;
    
    // Reinitialize blocks
    this.initBlocks();
  }
  
  initBlocks() {
    this.blocks = [];
    const minSize = 20;
    const maxSize = 60;
    
    for (let i = 0; i < this.blockCount; i++) {
      const size = Math.random() * (maxSize - minSize) + minSize;
      
      this.blocks.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: size,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.01,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        color: Object.values(this.colors)[Math.floor(Math.random() * 4)],
        alpha: Math.random() * 0.2 + 0.05
      });
    }
  }
  
  drawBackground() {
    // Create a gradient background
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#f8fafc');   // Very light blue-gray
    gradient.addColorStop(1, '#f1f5f9');   // Light blue-gray
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Add a subtle pattern
    this.drawPatternOverlay();
  }
  
  drawPatternOverlay() {
    // Skip on mobile for performance
    if (this.isMobile) return;
    
    this.ctx.strokeStyle = 'rgba(226, 232, 240, 0.4)';
    this.ctx.lineWidth = 0.5;
    
    // Draw a grid pattern
    const spacing = 30;
    
    // Draw vertical lines
    for (let x = 0; x < this.width; x += spacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y < this.height; y += spacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
  }
  
  drawBlock(block) {
    this.ctx.save();
    this.ctx.translate(block.x, block.y);
    this.ctx.rotate(block.rotation);
    
    // Draw block with connecting lines to represent blockchain
    this.ctx.fillStyle = block.color.replace(')', `, ${block.alpha})`).replace('rgb', 'rgba');
    this.ctx.strokeStyle = block.color.replace(')', `, ${block.alpha * 1.5})`).replace('rgb', 'rgba');
    this.ctx.lineWidth = 1;
    
    // Draw the main block (cube-like structure)
    this.ctx.beginPath();
    this.ctx.rect(-block.size/2, -block.size/2, block.size, block.size);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Add a hash-like pattern inside the block
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 0.5;
    
    // Horizontal lines inside block
    const lineSpacing = 5;
    const lineCount = Math.floor(block.size / lineSpacing);
    
    for (let i = 1; i < lineCount; i++) {
      const y = -block.size/2 + i * lineSpacing;
      const length = Math.random() * (block.size * 0.8) + (block.size * 0.2);
      const offset = Math.random() * (block.size - length);
      
      this.ctx.beginPath();
      this.ctx.moveTo(-block.size/2 + offset, y);
      this.ctx.lineTo(-block.size/2 + offset + length, y);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }
  
  drawConnections() {
    // Skip on mobile for performance
    if (this.isMobile) return;
    
    // Draw lines connecting nearby blocks
    const maxDistance = 150;
    
    this.ctx.lineWidth = 0.3;
    
    for (let i = 0; i < this.blocks.length; i++) {
      const blockA = this.blocks[i];
      
      for (let j = i + 1; j < this.blocks.length; j++) {
        const blockB = this.blocks[j];
        
        const dx = blockB.x - blockA.x;
        const dy = blockB.y - blockA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < maxDistance) {
          // Make the line more transparent as distance increases
          const alpha = 0.2 * (1 - distance / maxDistance);
          
          this.ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
          
          this.ctx.beginPath();
          this.ctx.moveTo(blockA.x, blockA.y);
          this.ctx.lineTo(blockB.x, blockB.y);
          this.ctx.stroke();
        }
      }
    }
  }
  
  drawBlocks() {
    this.blocks.forEach(block => {
      // Update position
      block.x += block.vx;
      block.y += block.vy;
      
      // Update rotation
      block.rotation += block.rotationSpeed;
      
      // Wrap around the screen
      if (block.x < -block.size) block.x = this.width + block.size;
      if (block.x > this.width + block.size) block.x = -block.size;
      if (block.y < -block.size) block.y = this.height + block.size;
      if (block.y > this.height + block.size) block.y = -block.size;
      
      // Draw the block
      this.drawBlock(block);
    });
  }
  
  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Draw background elements
    this.drawBackground();
    this.drawConnections();
    this.drawBlocks();
    
    // Continue animation loop
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
  }
  
  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}

// Create and export singleton instance
const alternativeBackgroundAnimation = new AlternativeBackgroundAnimation();
export default alternativeBackgroundAnimation;
