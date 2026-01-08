// Visual renderer - circular sonar view with colored ship dots
import { VISUAL } from './config.js';

class VisualRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ships = new Map(); // mmsi -> visual ship data
    this.sweepAngle = 0;
    this.prevSweepAngle = 0;
    this.onShipPing = null; // Callback when sweep hits a ship
    this.resize();

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.85;
    this.canvas.width = size;
    this.canvas.height = size;
    this.centerX = size / 2;
    this.centerY = size / 2;
    this.radius = size / 2 - 20;
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

    // Store previous angle for sweep detection
    this.prevSweepAngle = this.sweepAngle;

    // Rotate sweep
    this.sweepAngle += deltaTime * 0.8; // Slightly faster
    if (this.sweepAngle > Math.PI * 2) {
      this.sweepAngle -= Math.PI * 2;
    }

    // Clear canvas
    ctx.fillStyle = VISUAL.bgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw sonar background
    this.drawSonarBackground();

    // Check for sweep collisions and update ships
    for (const [mmsi, ship] of this.ships) {
      // Smooth position interpolation
      const lerp = 0.05;
      ship.currentX += (ship.targetX - ship.currentX) * lerp;
      ship.currentY += (ship.targetY - ship.currentY) * lerp;

      // Check if sweep just passed this ship
      const shipAngle = this.getAngle(ship.currentX, ship.currentY);
      if (this.isAngleBetween(shipAngle, this.prevSweepAngle, this.sweepAngle)) {
        // Trigger ping callback
        if (this.onShipPing && ship.opacity > 0.5) {
          this.onShipPing({
            mmsi: ship.mmsi,
            x: ship.rawX,
            y: ship.rawY,
            name: ship.name
          });
        }
        ship.pingBrightness = 1; // Flash
      }

      // Decay ping brightness
      ship.pingBrightness = Math.max(0, ship.pingBrightness - deltaTime * 2);

      // Update trail
      ship.trail.unshift({ x: ship.currentX, y: ship.currentY });
      if (ship.trail.length > VISUAL.trailLength) {
        ship.trail.pop();
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

      // Draw ship
      this.drawShip(ship);
    }

    // Draw radar sweep (on top)
    this.drawSweep();
  }

  drawShip(ship) {
    const ctx = this.ctx;
    const brightness = ship.pingBrightness;
    const size = VISUAL.shipSize + brightness * 4; // Grow when pinged
    const glowSize = VISUAL.glowSize + brightness * 15;

    // Draw glow (bigger when pinged)
    ctx.save();
    ctx.globalAlpha = ship.opacity * (0.3 + brightness * 0.5);
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

    // Draw ship dot
    ctx.save();
    ctx.globalAlpha = ship.opacity;
    ctx.fillStyle = `hsl(${ship.hue}, 80%, ${65 + brightness * 25}%)`;
    ctx.beginPath();
    ctx.arc(ship.currentX, ship.currentY, size, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright spot
    ctx.fillStyle = `hsl(${ship.hue}, 60%, ${85 + brightness * 15}%)`;
    ctx.beginPath();
    ctx.arc(ship.currentX, ship.currentY, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
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
}

export { VisualRenderer };
