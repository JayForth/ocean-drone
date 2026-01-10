// Ocean Drone - Main entry point
import { shipTracker } from './ships.js';
import { audioEngine } from './audio.js';
import { VisualRenderer } from './visual.js';
import { coastlineRenderer } from './coastline.js';
import { BOUNDING_BOX, SPEED_COLORS } from './config.js';

// Get hue based on ship speed
function getSpeedHue(speed) {
  for (const range of SPEED_COLORS) {
    if (speed <= range.max) {
      return range.hue;
    }
  }
  return SPEED_COLORS[SPEED_COLORS.length - 1].hue;
}

// DOM elements
const canvas = document.getElementById('sonar');
const startScreen = document.getElementById('start-screen');
const shipCountEl = document.getElementById('ship-count');
const infoPanel = document.getElementById('info-panel');
const tooltip = document.getElementById('hover-tooltip');
const tooltipName = tooltip.querySelector('.ship-name');
const tooltipSpeed = tooltip.querySelector('.speed');
const tooltipCourse = tooltip.querySelector('.course');
const tooltipImageContainer = tooltip.querySelector('.ship-image-container');
const tooltipImage = tooltip.querySelector('.ship-image');

// Track current image loading state
let currentImageMmsi = null;

// Get ship image URL (via server proxy to avoid CORS)
function getShipImageUrl(mmsi, name) {
  const serverUrl = window.location.port === '5173' ? 'http://localhost:3001' : '';
  const params = new URLSearchParams({ mmsi });
  if (name) params.set('name', name);
  return `${serverUrl}/api/ship-image?${params}`;
}

// Initialize visual renderer
const visual = new VisualRenderer(canvas);

// Load coastline (async, graceful failure)
coastlineRenderer.load('/data/dover-coastline.geojson')
  .then(() => visual.setCoastlineRenderer(coastlineRenderer))
  .catch(err => console.warn('Coastline load failed:', err));

// Expose for debug panel
window.audioEngine = audioEngine;
window.visual = visual;

// Animation state
let lastTime = 0;
let lastSweepTime = 0;
let isRunning = false;
let sweepInterval = null;

// Connect ship events to visual system
shipTracker.onShipEnter = (ship) => {
  const hue = getSpeedHue(ship.speed);
  visual.addShip(ship, hue);
  updateShipCount();
};

shipTracker.onShipMove = (ship) => {
  const hue = getSpeedHue(ship.speed);
  visual.updateShip(ship, hue);
};

shipTracker.onShipExit = (ship) => {
  visual.removeShip(ship);
  updateShipCount();
};

// Connect sweep ping to audio
visual.onShipPing = (ship) => {
  audioEngine.ping(ship);
};

// Hover tooltip handling
visual.onShipHover = (ship, screenX, screenY) => {
  if (ship) {
    tooltipName.textContent = ship.name;
    tooltipSpeed.textContent = `Speed: ${ship.speed.toFixed(1)} knots`;
    tooltipCourse.textContent = `Course: ${Math.round(ship.course)}°`;
    tooltip.style.left = `${screenX + 15}px`;
    tooltip.style.top = `${screenY - 10}px`;
    tooltip.classList.add('visible');

    // Load ship image if different ship
    if (currentImageMmsi !== ship.mmsi) {
      currentImageMmsi = ship.mmsi;
      tooltipImage.classList.remove('loaded');
      tooltipImageContainer.classList.remove('has-image');

      tooltipImage.onload = () => {
        if (currentImageMmsi === ship.mmsi) {
          tooltipImageContainer.classList.add('has-image');
          tooltipImage.classList.add('loaded');
        }
      };
      tooltipImage.onerror = () => {
        tooltipImageContainer.classList.remove('has-image');
        tooltipImage.classList.remove('loaded');
      };
      tooltipImage.src = getShipImageUrl(ship.mmsi, ship.name);
    }
  } else {
    tooltip.classList.remove('visible');
    currentImageMmsi = null;
    tooltipImage.classList.remove('loaded');
    tooltipImageContainer.classList.remove('has-image');
  }
};

function updateShipCount() {
  const count = shipTracker.getShipCount();
  shipCountEl.textContent = count;
}

// Main render loop
function animate(time) {
  if (!isRunning) return;

  const deltaTime = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  // Update shared sweep time (render consumes time, interval won't double-count)
  lastSweepTime = time;

  visual.render(deltaTime);

  requestAnimationFrame(animate);
}

// Start the experience
async function start(e) {
  if (isRunning) return;
  isRunning = true; // Set immediately to prevent double-start

  // Prevent default to ensure touch works
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Hide start screen immediately
  startScreen.classList.add('hidden');

  // Show info panel
  infoPanel.classList.add('visible');

  try {
    // Start audio (requires user gesture)
    await audioEngine.start();
  } catch (err) {
    console.error('Audio start failed:', err);
  }

  // Connect to proxy server
  shipTracker.connect();

  // Start render loop
  lastTime = performance.now();
  lastSweepTime = lastTime;
  requestAnimationFrame(animate);

  // Start sweep interval (backup for background tabs)
  // Uses shared lastSweepTime - when RAF is running it consumes the time,
  // so interval sees ~0 delta. When tab is backgrounded, interval takes over.
  sweepInterval = setInterval(() => {
    const now = performance.now();
    const deltaTime = Math.min((now - lastSweepTime) / 1000, 0.1);
    if (deltaTime > 0.02) { // Only update if RAF hasn't recently (>20ms gap)
      lastSweepTime = now;
      visual.updateSweep(deltaTime);
    }
  }, 50);
}

// Click/touch anywhere to start (required for audio)
// Using capture phase for earlier handling on iOS
function handleStart(e) {
  start(e);
}

document.addEventListener('click', handleStart, { once: true, capture: true });
document.addEventListener('touchend', handleStart, { once: true, capture: true });

// Fullscreen toggle
const fullscreenBtn = document.getElementById('fullscreen-btn');
const canvasContainer = document.getElementById('canvas-container');

fullscreenBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Don't trigger start

  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    canvasContainer.requestFullscreen().catch(err => {
      console.log('Fullscreen error:', err);
    });
  }
});

// Update button icon when fullscreen changes
document.addEventListener('fullscreenchange', () => {
  fullscreenBtn.textContent = document.fullscreenElement ? '⛶' : '⛶';
});

// Initial render
visual.render(0);
