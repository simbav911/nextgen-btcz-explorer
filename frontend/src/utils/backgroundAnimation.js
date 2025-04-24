/**
 * BitcoinZ Explorer Background Animation
 * A colorful, animated background with gradient waves and particles
 */

class BackgroundAnimation {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.particles = [];
    this.particleCount = 50;
    this.colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B']; // Blue, Purple, Green, Orange
    this.gradientColors = {
      start: 'rgba(59, 130, 246, 0.2)', // Blue
      middle1: 'rgba(139, 92, 246, 0.15)', // Purple
      middle2: 'rgba(16, 185, 129, 0.15)', // Green
      end: 'rgba(245, 158, 11, 0.1)' // Orange
    };
    this.animationFrameId = null;
    this.wave = {
      angle: 0,
      frequency: 0.005,
      amplitude: 10,
      speed: 0.01
    };
    this.gradientAngle = 0;
    this.gradientSpeed = 0.001;
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
      
      // Create initial particles
      this.initParticles();
      
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
    
    // Adjust particle count based on screen size
    this.particleCount = this.isMobile ? 30 : 50;
    
    // Reinitialize particles
    this.initParticles();
  }
  
  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 3 + 1,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        speed: Math.random() * 0.5 + 0.1,
        direction: Math.random() * Math.PI * 2,
        alpha: Math.random() * 0.5 + 0.1
      });
    }
  }
  
  drawGradientBackground() {
    const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
    
    // Animate gradient angle
    this.gradientAngle += this.gradientSpeed;
    const x1 = Math.cos(this.gradientAngle) * this.width * 0.5 + this.width * 0.5;
    const y1 = Math.sin(this.gradientAngle) * this.height * 0.5 + this.height * 0.5;
    const x2 = Math.cos(this.gradientAngle + Math.PI) * this.width * 0.5 + this.width * 0.5;
    const y2 = Math.sin(this.gradientAngle + Math.PI) * this.height * 0.5 + this.height * 0.5;
    
    const gradient2 = this.ctx.createLinearGradient(x1, y1, x2, y2);
    
    gradient2.addColorStop(0, this.gradientColors.start);
    gradient2.addColorStop(0.33, this.gradientColors.middle1);
    gradient2.addColorStop(0.66, this.gradientColors.middle2);
    gradient2.addColorStop(1, this.gradientColors.end);
    
    this.ctx.fillStyle = gradient2;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
  
  drawWaves() {
    this.ctx.beginPath();
    this.wave.angle += this.wave.speed;
    
    // Draw first wave
    this.ctx.beginPath();
    for (let x = 0; x < this.width; x += 10) {
      const y = Math.sin(x * this.wave.frequency + this.wave.angle) * this.wave.amplitude + this.height * 0.3;
      if (x === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)'; // Blue wave
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // Draw second wave
    this.ctx.beginPath();
    for (let x = 0; x < this.width; x += 10) {
      const y = Math.sin(x * this.wave.frequency * 0.8 + this.wave.angle * 1.3) * this.wave.amplitude * 1.5 + this.height * 0.5;
      if (x === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)'; // Purple wave
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // Draw third wave
    this.ctx.beginPath();
    for (let x = 0; x < this.width; x += 10) {
      const y = Math.sin(x * this.wave.frequency * 1.2 + this.wave.angle * 0.7) * this.wave.amplitude * 1.2 + this.height * 0.7;
      if (x === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)'; // Green wave
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }
  
  drawParticles() {
    this.particles.forEach(particle => {
      // Update particle position
      particle.x += Math.cos(particle.direction) * particle.speed;
      particle.y += Math.sin(particle.direction) * particle.speed;
      
      // Wrap particles around the screen
      if (particle.x < 0) particle.x = this.width;
      if (particle.x > this.width) particle.x = 0;
      if (particle.y < 0) particle.y = this.height;
      if (particle.y > this.height) particle.y = 0;
      
      // Draw particle
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = particle.color.replace(')', `, ${particle.alpha})`).replace('rgb', 'rgba');
      this.ctx.fill();
    });
  }
  
  drawHexagonGrid() {
    // Skip on mobile for performance
    if (this.isMobile) return;
    
    const hexSize = 30;
    const hexHeight = hexSize * Math.sqrt(3);
    const hexWidth = hexSize * 2;
    
    this.ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)'; // Light blue-gray
    this.ctx.lineWidth = 0.5;
    
    // Calculate grid dimensions
    const cols = Math.ceil(this.width / (hexWidth * 0.75)) + 1;
    const rows = Math.ceil(this.height / hexHeight) + 1;
    
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const x = col * hexWidth * 0.75;
        const y = row * hexHeight + (col % 2 === 0 ? 0 : hexHeight / 2);
        
        this.drawHexagon(x, y, hexSize);
      }
    }
  }
  
  drawHexagon(x, y, size) {
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const xPos = x + size * Math.cos(angle);
      const yPos = y + size * Math.sin(angle);
      
      if (i === 0) {
        this.ctx.moveTo(xPos, yPos);
      } else {
        this.ctx.lineTo(xPos, yPos);
      }
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }
  
  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Draw background elements
    this.drawGradientBackground();
    this.drawHexagonGrid();
    this.drawWaves();
    this.drawParticles();
    
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
const backgroundAnimation = new BackgroundAnimation();
export default backgroundAnimation;
