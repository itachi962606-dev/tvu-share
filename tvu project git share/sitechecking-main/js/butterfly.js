/**
 * TVU Books & Materials - Elegant Home Page Butterfly Animation
 * Features:
 * - Smooth natural flight path with Bezier curve interpolation & slight 3D wing flapping
 * - Gentle hover, subtle banking/rotation in the direction of flight
 * - Periodic landing on hero elements / badges for 2.5s, then softly takes off
 * - Non-blocking: pointer-events: none (zero interference with clicks or scrolling)
 * - Lightweight, zero external dependencies
 * - Full respect for prefers-reduced-motion
 */

(function initButterfly() {
  // Check user motion preferences
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return;
  }

  // Ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButterfly);
  } else {
    setupButterfly();
  }

  function setupButterfly() {
    // Only mount on home page / where hero section exists
    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) return;

    const butterfly = document.createElement('div');
    butterfly.className = 'butterfly-wrapper';
    butterfly.id = 'tvu-butterfly';
    butterfly.setAttribute('aria-hidden', 'true');

    // SVG butterfly illustration with separate flapping wings
    butterfly.innerHTML = `
      <svg class="butterfly-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Body -->
        <path d="M50 25 C48 35 48 65 50 75 C52 65 52 35 50 25 Z" fill="#0f2744"/>
        <circle cx="50" cy="22" r="4" fill="#0f2744"/>
        <path d="M48 20 Q44 12 38 10 M52 20 Q56 12 62 10" stroke="#0f2744" stroke-width="2" stroke-linecap="round"/>
        
        <!-- Left Wing Group -->
        <g class="butterfly-wing-left">
          <!-- Forewing -->
          <path d="M48 30 C30 5 5 15 15 45 C22 58 45 45 48 40 Z" fill="url(#leftGrad1)" stroke="#f59e0b" stroke-width="1.5"/>
          <!-- Hindwing -->
          <path d="M48 45 C30 50 15 65 25 80 C35 90 48 70 48 55 Z" fill="url(#leftGrad2)" stroke="#f59e0b" stroke-width="1.5"/>
          <!-- Spots -->
          <circle cx="28" cy="32" r="3.5" fill="#ffffff" opacity="0.85"/>
          <circle cx="34" cy="68" r="2.5" fill="#ffffff" opacity="0.85"/>
        </g>
        
        <!-- Right Wing Group -->
        <g class="butterfly-wing-right">
          <!-- Forewing -->
          <path d="M52 30 C70 5 95 15 85 45 C78 58 55 45 52 40 Z" fill="url(#rightGrad1)" stroke="#f59e0b" stroke-width="1.5"/>
          <!-- Hindwing -->
          <path d="M52 45 C70 50 85 65 75 80 C65 90 52 70 52 55 Z" fill="url(#rightGrad2)" stroke="#f59e0b" stroke-width="1.5"/>
          <!-- Spots -->
          <circle cx="72" cy="32" r="3.5" fill="#ffffff" opacity="0.85"/>
          <circle cx="66" cy="68" r="2.5" fill="#ffffff" opacity="0.85"/>
        </g>

        <!-- Gradients -->
        <defs>
          <linearGradient id="leftGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fbbf24"/>
            <stop offset="100%" stop-color="#ea580c"/>
          </linearGradient>
          <linearGradient id="leftGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#047857"/>
          </linearGradient>
          <linearGradient id="rightGrad1" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fbbf24"/>
            <stop offset="100%" stop-color="#ea580c"/>
          </linearGradient>
          <linearGradient id="rightGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#047857"/>
          </linearGradient>
        </defs>
      </svg>
    `;

    document.body.appendChild(butterfly);

    // Butterfly Motion Physics
    let posX = 100;
    let posY = 150;
    let targetX = 200;
    let targetY = 180;
    let currentAngle = 0;
    let isResting = false;
    let restTimer = null;

    function pickNewTarget() {
      if (isResting) return;

      const heroRect = heroSection.getBoundingClientRect();
      const scrollY = window.scrollY;

      // 30% chance to gently land on or near the hero badge / button area
      const landCandidates = [
        document.querySelector('.hero-badge'),
        document.querySelector('.brand-wrapper')
      ].filter(Boolean);

      if (Math.random() < 0.35 && landCandidates.length > 0) {
        const targetElem = landCandidates[Math.floor(Math.random() * landCandidates.length)];
        const rect = targetElem.getBoundingClientRect();
        targetX = rect.left + rect.width / 2 - 16;
        targetY = rect.top + scrollY - 20;
        
        // Schedule rest when reached
        scheduleRest();
      } else {
        // Fly freely within bounds
        const minX = 20;
        const maxX = window.innerWidth - 60;
        const minY = scrollY + 40;
        const maxY = scrollY + Math.max(heroRect.height + 100, 360);

        targetX = minX + Math.random() * (maxX - minX);
        targetY = minY + Math.random() * (maxY - minY);
      }
    }

    function scheduleRest() {
      // Once butterfly gets close to target, pause for 2.5 seconds
      setTimeout(() => {
        isResting = true;
        butterfly.style.opacity = '0.9';
        // Flap slower while resting
        const leftWing = butterfly.querySelector('.butterfly-wing-left');
        const rightWing = butterfly.querySelector('.butterfly-wing-right');
        if (leftWing && rightWing) {
          leftWing.style.animationDuration = '0.8s';
          rightWing.style.animationDuration = '0.8s';
        }

        restTimer = setTimeout(() => {
          isResting = false;
          if (leftWing && rightWing) {
            leftWing.style.animationDuration = '0.18s';
            rightWing.style.animationDuration = '0.18s';
          }
          pickNewTarget();
        }, 2800);
      }, 1500);
    }

    // Animation Loop
    function updateFlight() {
      if (!isResting) {
        const dx = targetX - posX;
        const dy = targetY - posY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 30) {
          pickNewTarget();
        } else {
          // Smooth interpolation
          const speed = Math.min(2.5, dist * 0.03);
          posX += (dx / dist) * speed;
          posY += (dy / dist) * speed + Math.sin(Date.now() * 0.005) * 0.6; // Gentle bobbing

          // Calculate banking angle
          const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
          currentAngle += (targetAngle - currentAngle) * 0.08;

          butterfly.style.transform = `translate3d(${posX}px, ${posY}px, 0) rotate(${currentAngle}deg)`;
        }
      }

      requestAnimationFrame(updateFlight);
    }

    // Initial positioning & start
    const heroRect = heroSection.getBoundingClientRect();
    posX = window.innerWidth * 0.2;
    posY = window.scrollY + 100;
    pickNewTarget();
    requestAnimationFrame(updateFlight);

    // Pick new targets regularly if flying
    setInterval(() => {
      if (!isResting) pickNewTarget();
    }, 4500);
  }
})();
