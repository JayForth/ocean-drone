// Ocean Drone - Main entry point
import { shipTracker } from './ships.js';
import { audioEngine } from './audio.js';
import { VisualRenderer } from './visual.js';
import { coastlineRenderer } from './coastline.js';
import { SPEED_COLORS, ZONES, ZONE_ORDER } from './config.js';
import { zoneManager } from './zone.js';

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

// Zone navigation DOM elements
const zonePrevBtn = document.getElementById('zone-prev');
const zoneNextBtn = document.getElementById('zone-next');
const zoneIndicator = document.getElementById('zone-indicator');
const zoneName = document.getElementById('zone-name');
const zoneDots = document.querySelectorAll('.zone-dot');
const infoPanelTitle = document.querySelector('#info-panel h2');

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
    tooltip.textContent = ship.name;
    tooltip.style.left = `${screenX + 15}px`;
    tooltip.style.top = `${screenY - 10}px`;
    tooltip.classList.add('visible');
  } else {
    tooltip.classList.remove('visible');
  }
};

const mobileShipCountEl = document.getElementById('ship-count-mobile');

function updateShipCount() {
  const count = shipTracker.getShipCount();
  shipCountEl.textContent = count;
  if (mobileShipCountEl) mobileShipCountEl.textContent = count;
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

  // Show info panel and zone indicator
  infoPanel.classList.add('visible');
  zoneIndicator.classList.add('visible');

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

// Zone navigation

// Update UI to reflect current zone
function updateZoneUI() {
  const zone = zoneManager.currentZone;
  const index = zoneManager.currentIndex;

  // Update arrow buttons
  zonePrevBtn.disabled = !zoneManager.canGoPrev();
  zoneNextBtn.disabled = !zoneManager.canGoNext();

  // Update zone indicator
  zoneName.textContent = zone.name.toUpperCase();
  zoneDots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });

  // Update page title and info panel
  document.title = `Ambient Boats — ${zone.name}`;
  if (infoPanelTitle) {
    infoPanelTitle.textContent = zone.name.toUpperCase();
  }
}

// Handle zone change with porthole pan transition
zoneManager.onZoneChange = (newZone, prevZone) => {
  if (visual.transitioning) return;

  const dir = zoneDirection;

  visual.startTransition(dir, () => {
    // Runs immediately — snapshot captures old state, this sets up new state
    updateZoneUI();
    audioEngine.applyZonePreset(newZone.audio, 4);
    audioEngine.clearPingQueue();
    shipTracker.setZone(newZone);
    visual.clearAllShips();
    coastlineRenderer.load(newZone.coastlineUrl)
      .then(() => visual.setCoastlineRenderer(coastlineRenderer))
      .catch(err => console.warn('Coastline load failed for zone:', err));
  });
};

// Zone navigation state
let zoneDirection = 1;

// Zone button handlers
zonePrevBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  zoneDirection = -1;
  zoneManager.goPrev();
});

zoneNextBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  zoneDirection = 1;
  zoneManager.goNext();
});

// Keyboard navigation for zones
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') {
    zoneDirection = -1;
    zoneManager.goPrev();
  } else if (e.key === 'ArrowRight') {
    zoneDirection = 1;
    zoneManager.goNext();
  }
});

// Touch swipe for zone navigation (mobile)
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;

  // Only trigger if horizontal swipe is dominant and significant
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 2) {
    if (dx < 0) {
      zoneDirection = 1;
      zoneManager.goNext();
    } else {
      zoneDirection = -1;
      zoneManager.goPrev();
    }
  }
});

// Initialize with default zone
shipTracker.setZone(zoneManager.currentZone);
updateZoneUI();

// Initial render
visual.render(0);
