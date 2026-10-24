/**
 * BitcoinZ Explorer Background Animation
 * A colorful, animated background with gradient waves and particles
 *
 * Performance notes (visual output is unchanged):
 *  - the static hexagon grid is rendered once per resize into an offscreen
 *    canvas and blitted each frame instead of stroking hundreds of paths
 *  - the frame rate is capped (30fps desktop / 24fps mobile) and motion is
 *    time-based, so the animation runs at the same speed with less work
 *  - the loop stops while the tab is hidden
 *  - with `prefers-reduced-motion: reduce` a single static frame is drawn
 *  - resize handling is debounced and ignores height-only changes on phones
 *    (the URL bar showing/hiding), so particles don't jump around
 */

const BASE_FRAME_MS = 1000 / 60; // original animation speeds were per 60fps frame

class BackgroundAnimation {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.hexCanvas = null;
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
    this.lastFrameTime = 0;
    this.running = false;
    this.resizeTimer = null;
    this.reducedMotionQuery = null;

    // Bind once so listeners can be removed again
    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.onReducedMotionChange = this.onReducedMotionChange.bind(this);
  }

  get frameInterval() {
    return 1000 / (this.isMobile ? 24 : 30);
  }

  prefersReducedMotion() {
    return !!(this.reducedMotionQuery && this.reducedMotionQuery.matches);
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

      if (typeof window.matchMedia === 'function') {
        this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (this.reducedMotionQuery.addEventListener) {
          this.reducedMotionQuery.addEventListener('change', this.onReducedMotionChange);
        } else if (this.reducedMotionQuery.addListener) {
          this.reducedMotionQuery.addListener(this.onReducedMotionChange);
        }
      }

      window.addEventListener('resize', this.onResize, { passive: true });
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.handleResize();
    }

    this.start();
  }

  start() {
    if (!this.ctx) return;
    if (this.prefersReducedMotion()) {
      this.stop();
      this.drawFrame(0);
      return;
    }
    if (this.running || document.hidden) return;
    this.running = true;
    this.lastFrameTime = 0;
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  onResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(this.handleResize, 150);
  }

  onVisibilityChange() {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  }

  onReducedMotionChange() {
    this.stop();
    this.start();
  }

  handleResize() {
    if (!this.canvas) return;
    // Size the canvas to its fixed container (100lvh, see index.css) rather
    // than innerHeight: on iOS Safari innerHeight changes whenever the
    // toolbars show/hide while scrolling, and re-allocating the canvas then
    // caused jank and left the bottom strip uncovered.
    const container = this.canvas.parentElement;
    const newWidth = (container && container.clientWidth) || window.innerWidth;
    const newHeight = Math.max((container && container.clientHeight) || 0, window.innerHeight);
    if (this.particles.length && newWidth === this.width && newHeight === this.height &&
        this.canvas.width === newWidth && this.canvas.height === newHeight) {
      return;
    }
    const widthChanged = newWidth !== this.width || !this.particles.length;
    const wasMobile = this.isMobile;

    this.width = newWidth;
    this.height = newHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.isMobile = window.innerWidth < 768;

    // Adjust particle count based on screen size
    this.particleCount = this.isMobile ? 30 : 50;

    // Reinitialize particles (skip for height-only changes, e.g. mobile URL bar)
    if (widthChanged || wasMobile !== this.isMobile) {
      this.initParticles();
    }

    this.buildHexGrid();

    // Repaint immediately (resizing a canvas clears it)
    if (!this.running) this.drawFrame(0);
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      const color = this.colors[Math.floor(Math.random() * this.colors.length)];
      const alpha = Math.random() * 0.5 + 0.1;
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 3 + 1,
        color,
        speed: Math.random() * 0.5 + 0.1,
        direction: Math.random() * Math.PI * 2,
        alpha,
        // Same string the original per-frame replace() produced (hex colors are unchanged by it)
        fillStyle: color.replace(')', `, ${alpha})`).replace('rgb', 'rgba')
      });
    }
  }

  drawGradientBackground(step) {
    // Animate gradient angle
    this.gradientAngle += this.gradientSpeed * step;
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

  drawWave(frequencyMul, angleMul, amplitudeMul, yRatio, color) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let x = 0; x < this.width; x += 10) {
      const y = Math.sin(x * this.wave.frequency * frequencyMul + this.wave.angle * angleMul) *
        this.wave.amplitude * amplitudeMul + this.height * yRatio;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawWaves(step) {
    this.wave.angle += this.wave.speed * step;
    this.drawWave(1, 1, 1, 0.3, 'rgba(59, 130, 246, 0.2)'); // Blue wave
    this.drawWave(0.8, 1.3, 1.5, 0.5, 'rgba(139, 92, 246, 0.2)'); // Purple wave
    this.drawWave(1.2, 0.7, 1.2, 0.7, 'rgba(16, 185, 129, 0.2)'); // Green wave
  }

  drawParticles(step) {
    const ctx = this.ctx;
    const twoPi = Math.PI * 2;
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      // Update particle position
      particle.x += Math.cos(particle.direction) * particle.speed * step;
      particle.y += Math.sin(particle.direction) * particle.speed * step;

      // Wrap particles around the screen
      if (particle.x < 0) particle.x = this.width;
      if (particle.x > this.width) particle.x = 0;
      if (particle.y < 0) particle.y = this.height;
      if (particle.y > this.height) particle.y = 0;

      // Draw particle
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, twoPi);
      ctx.fillStyle = particle.fillStyle;
      ctx.fill();
    }
  }

  /**
   * Render the (static) hexagon grid once into an offscreen canvas.
   * Skipped on mobile, as before.
   */
  buildHexGrid() {
    if (this.isMobile) {
      this.hexCanvas = null;
      return;
    }
    if (!this.hexCanvas) this.hexCanvas = document.createElement('canvas');
    this.hexCanvas.width = this.width;
    this.hexCanvas.height = this.height;
    const ctx = this.hexCanvas.getContext('2d');

    const hexSize = 30;
    const hexHeight = hexSize * Math.sqrt(3);
    const hexWidth = hexSize * 2;

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)'; // Light blue-gray
    ctx.lineWidth = 0.5;

    // Calculate grid dimensions
    const cols = Math.ceil(this.width / (hexWidth * 0.75)) + 1;
    const rows = Math.ceil(this.height / hexHeight) + 1;

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const x = col * hexWidth * 0.75;
        const y = row * hexHeight + (col % 2 === 0 ? 0 : hexHeight / 2);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const xPos = x + hexSize * Math.cos(angle);
          const yPos = y + hexSize * Math.sin(angle);
          if (i === 0) {
            ctx.moveTo(xPos, yPos);
          } else {
            ctx.lineTo(xPos, yPos);
          }
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  drawHexagonGrid() {
    // Skip on mobile for performance
    if (this.isMobile || !this.hexCanvas) return;
    this.ctx.drawImage(this.hexCanvas, 0, 0);
  }

  drawFrame(step) {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw background elements
    this.drawGradientBackground(step);
    this.drawHexagonGrid();
    this.drawWaves(step);
    this.drawParticles(step);
  }

  animate(now) {
    if (!this.running) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    if (!this.lastFrameTime) {
      this.lastFrameTime = now;
      this.drawFrame(1);
      return;
    }

    const elapsed = now - this.lastFrameTime;
    if (elapsed < this.frameInterval - 1) return;

    // Clamp so a long pause doesn't make everything jump
    const step = Math.min(elapsed, 100) / BASE_FRAME_MS;
    this.lastFrameTime = now;
    this.drawFrame(step);
  }

  stop() {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}

// Create and export singleton instance
const backgroundAnimation = new BackgroundAnimation();
export default backgroundAnimation;
