/**
 * TVU Books & Materials - Animated Butterfly Physics
 */

(function initButterfly() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButterfly);
  } else {
    setupButterfly();
  }

  function setupButterfly() {
    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) return;

    const butterfly = document.createElement('div');
    butterfly.className = 'butterfly-wrapper';
    butterfly.id = 'tvu-butterfly';
    butterfly.setAttribute('aria-hidden', 'true');

    butterfly.innerHTML = `
      <svg class="butterfly-svg" viewBox="0 0 100 100" fill="none">
        <path d="M50 25 C48 35 48 65 50 75 C52 65 52 35 50 25 Z" fill="#0f2744"/>
        <circle cx="50" cy="22" r="4" fill="#0f2744"/>
        <g class="butterfly-wing-left">
          <path d="M48 30 C30 5 5 15 15 45 C22 58 45 45 48 40 Z" fill="#f59e0b"/>
          <path d="M48 45 C30 50 15 65 25 80 C35 90 48 70 48 55 Z" fill="#ea580c"/>
        </g>
        <g class="butterfly-wing-right">
          <path d="M52 30 C70 5 95 15 85 45 C78 58 55 45 52 40 Z" fill="#f59e0b"/>
          <path d="M52 45 C70 50 85 65 75 80 C65 90 52 70 52 55 Z" fill="#ea580c"/>
        </g>
      </svg>
    `;

    document.body.appendChild(butterfly);

    let posX = 100;
    let posY = 150;
    let targetX = 200;
    let targetY = 180;
    let currentAngle = 0;

    function pickNewTarget() {
      const scrollY = window.scrollY;
      const minX = 30;
      const maxX = window.innerWidth - 60;
      const minY = scrollY + 40;
      const maxY = scrollY + 320;

      targetX = minX + Math.random() * (maxX - minX);
      targetY = minY + Math.random() * (maxY - minY);
    }

    function updateFlight() {
      const dx = targetX - posX;
      const dy = targetY - posY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 30) {
        pickNewTarget();
      } else {
        const speed = Math.min(2.5, dist * 0.03);
        posX += (dx / dist) * speed;
        posY += (dy / dist) * speed;
        const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        currentAngle += (targetAngle - currentAngle) * 0.08;
        butterfly.style.transform = `translate3d(${posX}px, ${posY}px, 0) rotate(${currentAngle}deg)`;
      }

      requestAnimationFrame(updateFlight);
    }

    pickNewTarget();
    requestAnimationFrame(updateFlight);
  }
})();