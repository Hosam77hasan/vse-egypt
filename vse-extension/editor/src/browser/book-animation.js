/**
 * Book Capture Animation - Magic Book Effect
 * Implements the 4-phase animation sequence for AI chat prompts
 */

class BookCaptureAnimation {
  constructor() {
    this.container = null;
    this.phase = null;
    this.animationTimeout = null;
    this.init();
  }

  init() {
    // Create the animation container
    this.container = document.createElement('div');
    this.container.className = 'book-capture-container';
    this.container.innerHTML = this.getBookSVG();
    document.body.appendChild(this.container);
  }

  getBookSVG() {
    return `
      <div class="book-glow"></div>
      <svg class="book-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <!-- Book Cover -->
        <rect x="15" y="20" width="70" height="60" rx="4" fill="#222222" stroke="#aacc00" stroke-width="2"/>
        
        <!-- Book Spine -->
        <rect x="15" y="20" width="8" height="60" rx="2" fill="#1a1a1a"/>
        
        <!-- Book Pages -->
        <g class="book-pages">
          <rect class="book-page-1" x="25" y="25" width="55" height="50" rx="2" fill="#f5f5f5"/>
          <rect class="book-page-2" x="28" y="28" width="50" height="45" rx="2" fill="#ffffff"/>
        </g>
        
        <!-- Book Title -->
        <text x="50" y="45" text-anchor="middle" fill="#aacc00" font-size="8" font-weight="bold" font-family="sans-serif">AI</text>
        <text x="50" y="58" text-anchor="middle" fill="#666" font-size="6" font-family="sans-serif">Think...</text>
        
        <!-- Decorative Lines -->
        <line x1="35" y1="65" x2="65" y2="65" stroke="#aacc00" stroke-width="1" opacity="0.5"/>
        <line x1="40" y1="70" x2="60" y2="70" stroke="#aacc00" stroke-width="1" opacity="0.3"/>
        
        <!-- Magical Sparkles -->
        <circle cx="20" cy="15" r="2" fill="#aacc00" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1s" repeatCount="indefinite"/>
        </circle>
        <circle cx="80" cy="15" r="1.5" fill="#aacc00" opacity="0.6">
          <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="50" cy="10" r="1" fill="#aacc00" opacity="0.7">
          <animate attributeName="opacity" values="0.7;0.3;0.7" dur="0.8s" repeatCount="indefinite"/>
        </circle>
      </svg>
      <div class="book-particles">
        ${this.getParticles()}
      </div>
    `;
  }

  getParticles() {
    let particles = '';
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const tx = Math.cos(angle) * 50;
      const ty = Math.sin(angle) * 50;
      particles += `<div class="book-particle" style="--tx: ${tx}px; --ty: ${ty}px; left: 50%; top: 50%;"></div>`;
    }
    return particles;
  }

  // Phase 1: Book opens
  startPhase1(callback) {
    this.setPhase('phase1');
    this.animationTimeout = setTimeout(() => {
      if (callback) callback();
    }, 400); // 0.4 seconds
  }

  // Phase 2: Book closes and vaults upward
  startPhase2(callback) {
    this.setPhase('phase2');
    this.animationTimeout = setTimeout(() => {
      if (callback) callback();
    }, 300); // 0.3 seconds
  }

  // Phase 3: Thinking loop
  startPhase3() {
    this.setPhase('phase3');
  }

  // Phase 4: Fade out and remove
  startPhase4(callback) {
    this.setPhase('phase4');
    this.animationTimeout = setTimeout(() => {
      this.hide();
      if (callback) callback();
    }, 300); // 0.3 seconds
  }

  setPhase(phase) {
    // Clear previous phase
    this.container.classList.remove('phase1', 'phase2', 'phase3', 'phase4');
    
    // Set new phase
    this.phase = phase;
    this.container.classList.add(phase);
    
    // Show container
    this.container.classList.add('active');
  }

  show() {
    this.container.classList.add('active');
  }

  hide() {
    this.container.classList.remove('active', 'phase1', 'phase2', 'phase3', 'phase4');
    this.phase = null;
    
    // Reset animations
    const svg = this.container.querySelector('.book-svg');
    if (svg) {
      svg.style.animation = 'none';
      svg.offsetHeight; // Trigger reflow
      svg.style.animation = '';
    }
  }

  // Full animation sequence
  async playAnimation(onPhaseChange) {
    return new Promise((resolve) => {
      // Phase 1: Book opens
      this.startPhase1(() => {
        if (onPhaseChange) onPhaseChange('phase1');
        
        // Phase 2: Book closes and vaults
        this.startPhase2(() => {
          if (onPhaseChange) onPhaseChange('phase2');
          resolve();
        });
      });
    });
  }

  // Start thinking loop
  startThinkingLoop() {
    this.startPhase3();
  }

  // Stop thinking loop and fade out
  stopThinkingLoop(callback) {
    this.startPhase4(callback);
  }

  destroy() {
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// Export for use in chat panel
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookCaptureAnimation;
} else {
  window.BookCaptureAnimation = BookCaptureAnimation;
}