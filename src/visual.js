// Visual renderer - circular sonar view with ship icons and wave animation
import { VISUAL } from './config.js';

class VisualRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ships = new Map(); // mmsi -> visual ship data
    this.sweepAngle = 0;
    this.prevSweepAngle = 0;
    this.sweepSpeed = 0.8; // Radians per second multiplier
    this.waveTime = 0; // For wave animation
    this.onShipPing = null; // Callback when sweep hits a ship
    this.onShipHover = null; // Callback when hovering over a ship
    this.hoveredShip = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.resize();

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('fullscreenchange', () => this.resize());

    // Mouse tracking for hover
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
  }

  resize() {
    // Detect fullscreen mode
    const isFullscreen = !!document.fullscreenElement;
    // Detect if mobile (info panel is below on narrow screens)
    const isMobile = window.innerWidth <= 900;

    let size;
    if (isFullscreen) {
      // In fullscreen, use most of the available space
      size = Math.min(window.innerWidth, window.innerHeight) - 40;
    } else if (isMobile) {
      // On mobile, use most of the width, leave room for panel below
      size = Math.min(window.innerWidth - 40, window.innerHeight * 0.6);
    } else {
      // On desktop, account for side panel
      const maxSize = Math.min(window.innerWidth - 320, window.innerHeight - 40);
      size = maxSize * 0.85;
    }
    size = Math.max(300, size);

    // Account for device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';

    // Scale context to match DPR
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.centerX = size / 2;
    this.centerY = size / 2;
    this.radius = size / 2 - 25;

    // Recalculate all ship positions for new canvas size
    this.recalculateShipPositions();
  }

  recalculateShipPositions() {
    for (const [mmsi, ship] of this.ships) {
      const pos = this.normalizedToCanvas(ship.rawX, ship.rawY);
      ship.targetX = pos.x;
      ship.targetY = pos.y;
      // Snap current position to avoid ships drifting during resize
      ship.currentX = pos.x;
      ship.currentY = pos.y;
      // Clear trail to avoid visual glitches
      ship.trail = [];
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;

    // Find ship under cursor
    let found = null;
    const hitRadius = 15;

    for (const [mmsi, ship] of this.ships) {
      if (ship.opacity < 0.5) continue;
      const dx = this.mouseX - ship.currentX;
      const dy = this.mouseY - ship.currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < hitRadius) {
        found = ship;
        break;
      }
    }

    if (found !== this.hoveredShip) {
      this.hoveredShip = found;
      if (this.onShipHover) {
        if (found) {
          this.onShipHover({
            mmsi: found.mmsi,
            name: found.name,
            speed: found.speed,
            course: found.course,
            shipType: found.shipType,
            country: found.country
          }, e.clientX, e.clientY);
        } else {
          this.onShipHover(null);
        }
      }
    } else if (found && this.onShipHover) {
      // Update position even if same ship
      this.onShipHover({
        mmsi: found.mmsi,
        name: found.name,
        speed: found.speed,
        course: found.course,
        shipType: found.shipType,
        country: found.country
      }, e.clientX, e.clientY);
    }
  }

  handleMouseLeave() {
    this.hoveredShip = null;
    if (this.onShipHover) {
      this.onShipHover(null);
    }
  }

  // Convert normalized coords (0-1) to canvas position within circle
  normalizedToCanvas(x, y) {
    const canvasX = this.centerX + (x - 0.5) * 2 * this.radius * 0.9;
    const canvasY = this.centerY + (0.5 - y) * 2 * this.radius * 0.9;
    return { x: canvasX, y: canvasY };
  }

  // Get angle from center to a point
  getAngle(x, y) {
    return Math.atan2(y - this.centerY, x - this.centerX);
  }

  // Normalize angle to 0 to 2π
  normalizeAngle(angle) {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
  }

  // Check if angle is between two angles (handling wraparound)
  isAngleBetween(angle, start, end) {
    angle = this.normalizeAngle(angle);
    start = this.normalizeAngle(start);
    end = this.normalizeAngle(end);

    if (start <= end) {
      return angle >= start && angle <= end;
    } else {
      // Wraparound case
      return angle >= start || angle <= end;
    }
  }

  addShip(ship, hue) {
    const pos = this.normalizedToCanvas(ship.x, ship.y);
    this.ships.set(ship.mmsi, {
      mmsi: ship.mmsi,
      name: ship.name,
      rawX: ship.x,
      rawY: ship.y,
      targetX: pos.x,
      targetY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      hue,
      opacity: 0,
      pingBrightness: 0, // Flash when pinged
      speed: ship.speed || 0,
      course: ship.course || 0,
      shipType: ship.shipType || 'Unknown',
      country: ship.country || { name: 'Unknown', flag: '🏳️' },
      trail: []
    });
  }

  updateShip(ship, hue) {
    const visual = this.ships.get(ship.mmsi);
    if (!visual) return;

    const pos = this.normalizedToCanvas(ship.x, ship.y);
    visual.rawX = ship.x;
    visual.rawY = ship.y;
    visual.targetX = pos.x;
    visual.targetY = pos.y;
    visual.speed = ship.speed || 0;
    visual.course = ship.course || 0;
    if (ship.shipType) visual.shipType = ship.shipType;
    if (ship.country) visual.country = ship.country;
    if (hue !== undefined) visual.hue = hue;
  }

  removeShip(ship) {
    const visual = this.ships.get(ship.mmsi);
    if (visual) {
      visual.removing = true;
    }
  }

  render(deltaTime) {
    const ctx = this.ctx;
    const { centerX, centerY, radius } = this;

    // Update wave animation time
    this.waveTime += deltaTime;

    // Update sweep (smooth visuals when tab active)
    this.updateSweep(deltaTime);

    // Clear canvas
    ctx.fillStyle = VISUAL.bgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw wave animation (behind everything)
    this.drawWaves();

    // Draw sonar background
    this.drawSonarBackground();

    // Update ships
    for (const [mmsi, ship] of this.ships) {
      // Smooth position interpolation
      const lerp = 0.05;
      ship.currentX += (ship.targetX - ship.currentX) * lerp;
      ship.currentY += (ship.targetY - ship.currentY) * lerp;

      // Decay ping brightness
      ship.pingBrightness = Math.max(0, ship.pingBrightness - deltaTime * 2);

      // Update trail - only add point if ship moved enough
      const lastTrailPoint = ship.trail[0];
      if (!lastTrailPoint) {
        ship.trail.unshift({ x: ship.currentX, y: ship.currentY });
      } else {
        const dx = ship.currentX - lastTrailPoint.x;
        const dy = ship.currentY - lastTrailPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= VISUAL.trailMinDistance) {
          ship.trail.unshift({ x: ship.currentX, y: ship.currentY });
          if (ship.trail.length > VISUAL.trailLength) {
            ship.trail.pop();
          }
        }
      }

      // Fade in/out
      if (ship.removing) {
        ship.opacity -= deltaTime * 0.5;
        if (ship.opacity <= 0) {
          this.ships.delete(mmsi);
          continue;
        }
      } else if (ship.opacity < 1) {
        ship.opacity = Math.min(1, ship.opacity + deltaTime * 0.5);
      }

      // Draw trail first (behind ship)
      this.drawTrail(ship);

      // Draw ship
      this.drawShip(ship);
    }

    // Draw radar sweep (on top)
    this.drawSweep();
  }

  drawTrail(ship) {
    if (ship.trail.length < 2) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Simple thin trail with fading opacity - DEFCON style
    for (let i = 1; i < ship.trail.length; i++) {
      const prev = ship.trail[i - 1];
      const curr = ship.trail[i];

      // Fade opacity based on position in trail
      const progress = i / ship.trail.length;
      const alpha = (1 - progress) * 0.35 * ship.opacity;

      ctx.strokeStyle = `hsla(${ship.hue}, 50%, 50%, ${alpha})`;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawShip(ship) {
    const ctx = this.ctx;
    const brightness = ship.pingBrightness;
    const isHovered = this.hoveredShip === ship;
    const hoverBoost = isHovered ? 0.3 : 0;
    const size = VISUAL.shipSize + brightness * 4 + (isHovered ? 2 : 0);
    const glowSize = VISUAL.glowSize + brightness * 15 + (isHovered ? 8 : 0);

    // Draw glow (bigger when pinged or hovered)
    ctx.save();
    ctx.globalAlpha = ship.opacity * (0.3 + brightness * 0.5 + hoverBoost);
    const gradient = ctx.createRadialGradient(
      ship.currentX, ship.currentY, 0,
      ship.currentX, ship.currentY, glowSize
    );
    const lightness = 60 + brightness * 30;
    gradient.addColorStop(0, `hsla(${ship.hue}, 80%, ${lightness}%, 0.8)`);
    gradient.addColorStop(1, `hsla(${ship.hue}, 80%, ${lightness}%, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ship.currentX, ship.currentY, glowSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw boat silhouette
    ctx.save();
    ctx.globalAlpha = ship.opacity;
    ctx.translate(ship.currentX, ship.currentY);

    // Convert course (0-360, 0=north, clockwise) to canvas rotation
    // Canvas: 0 = right, so we subtract 90 degrees
    const rotation = (ship.course - 90) * (Math.PI / 180);
    ctx.rotate(rotation);

    // Draw boat shape (pointed at front, flat at back)
    const len = size * 1.8;
    const width = size * 0.9;

    ctx.fillStyle = `hsl(${ship.hue}, 80%, ${65 + brightness * 25}%)`;
    ctx.beginPath();
    // Bow (front point)
    ctx.moveTo(len / 2, 0);
    // Starboard side (right when facing forward)
    ctx.lineTo(-len / 3, -width / 2);
    // Stern curve
    ctx.quadraticCurveTo(-len / 2, 0, -len / 3, width / 2);
    // Port side (left when facing forward)
    ctx.closePath();
    ctx.fill();

    // Draw highlight line along center
    ctx.strokeStyle = `hsl(${ship.hue}, 60%, ${85 + brightness * 15}%)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(len / 2 - 2, 0);
    ctx.lineTo(-len / 4, 0);
    ctx.stroke();

    ctx.restore();
  }

  drawWaves() {
    const ctx = this.ctx;
    const { centerX, centerY, radius } = this;

    ctx.save();

    // Create clipping circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
    ctx.clip();

    // Draw flowing wave pattern
    const waveCount = 8;
    const waveSpeed = 0.3;
    const waveAmplitude = 15;

    ctx.strokeStyle = 'rgba(100, 180, 255, 0.03)';
    ctx.lineWidth = 2;

    for (let w = 0; w < waveCount; w++) {
      const baseY = -radius + (w + 1) * (radius * 2 / (waveCount + 1));
      const phaseOffset = w * 0.5;

      ctx.beginPath();
      for (let x = -radius; x <= radius; x += 3) {
        const waveY = baseY +
          Math.sin((x * 0.02) + (this.waveTime * waveSpeed) + phaseOffset) * waveAmplitude +
          Math.sin((x * 0.01) + (this.waveTime * waveSpeed * 0.7) + phaseOffset * 2) * (waveAmplitude * 0.5);

        const canvasX = centerX + x;
        const canvasY = centerY + waveY;

        if (x === -radius) {
          ctx.moveTo(canvasX, canvasY);
        } else {
          ctx.lineTo(canvasX, canvasY);
        }
      }
      ctx.stroke();
    }

    // Add some vertical wave shimmer
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.02)';
    for (let w = 0; w < 5; w++) {
      const baseX = -radius + (w + 1) * (radius * 2 / 6);
      const phaseOffset = w * 0.7;

      ctx.beginPath();
      for (let y = -radius; y <= radius; y += 4) {
        const waveX = baseX +
          Math.sin((y * 0.015) + (this.waveTime * waveSpeed * 0.5) + phaseOffset) * (waveAmplitude * 0.6);

        const canvasX = centerX + waveX;
        const canvasY = centerY + y;

        if (y === -radius) {
          ctx.moveTo(canvasX, canvasY);
        } else {
          ctx.lineTo(canvasX, canvasY);
        }
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  drawSonarBackground() {
    const ctx = this.ctx;
    const { centerX, centerY, radius } = this;

    // Outer circle
    ctx.strokeStyle = VISUAL.ringColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Concentric rings
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * (i / 4), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cross lines
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Compass markers and labels
    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // North (top) - UK/Dover
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('N', centerX, centerY - radius - 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('UK', centerX, centerY - radius + 20);

    // South (bottom) - France
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('S', centerX, centerY + radius + 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('FRANCE', centerX, centerY + radius - 20);

    // East (right)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('E', centerX + radius + 14, centerY);

    // West (left)
    ctx.fillText('W', centerX - radius - 14, centerY);
  }

  drawSweep() {
    const ctx = this.ctx;
    const { centerX, centerY, radius } = this;

    // Draw sweep gradient (trailing fade)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, this.sweepAngle - 0.5, this.sweepAngle);
    ctx.closePath();

    const gradient = ctx.createConicGradient(this.sweepAngle, centerX, centerY);
    gradient.addColorStop(0, 'rgba(100, 255, 150, 0.2)');
    gradient.addColorStop(0.08, 'rgba(100, 255, 150, 0)');
    gradient.addColorStop(1, 'rgba(100, 255, 150, 0)');

    ctx.fillStyle = gradient;
    ctx.fill();

    // Sweep line
    ctx.strokeStyle = 'rgba(100, 255, 150, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(this.sweepAngle) * radius,
      centerY + Math.sin(this.sweepAngle) * radius
    );
    ctx.stroke();
    ctx.restore();
  }

  getShipCount() {
    return this.ships.size;
  }

  setSweepSpeed(speed) {
    this.sweepSpeed = speed;
  }

  // Update sweep and check for pings (can run independently of render)
  updateSweep(deltaTime) {
    this.prevSweepAngle = this.sweepAngle;
    this.sweepAngle += deltaTime * this.sweepSpeed;
    if (this.sweepAngle > Math.PI * 2) {
      this.sweepAngle -= Math.PI * 2;
    }

    // Check for sweep collisions
    for (const [mmsi, ship] of this.ships) {
      if (ship.opacity < 0.5) continue;

      const shipAngle = this.getAngle(ship.currentX, ship.currentY);
      if (this.isAngleBetween(shipAngle, this.prevSweepAngle, this.sweepAngle)) {
        if (this.onShipPing) {
          this.onShipPing({
            mmsi: ship.mmsi,
            x: ship.rawX,
            y: ship.rawY,
            name: ship.name
          });
        }
        ship.pingBrightness = 1;
      }
    }
  }
}

export { VisualRenderer };
