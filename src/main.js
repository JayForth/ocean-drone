// Ocean Drone - Main entry point
import { shipTracker } from './ships.js';
import { audioEngine } from './audio.js';
import { VisualRenderer } from './visual.js';
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
const locationEl = document.getElementById('location-name');
const infoPanel = document.getElementById('info-panel');
const tooltip = document.getElementById('hover-tooltip');
const tooltipName = tooltip.querySelector('.ship-name');
const tooltipSpeed = tooltip.querySelector('.speed');
const tooltipCourse = tooltip.querySelector('.course');

// Initialize visual renderer
const visual = new VisualRenderer(canvas);

// Update location display
locationEl.textContent = BOUNDING_BOX.name;

// Animation state
let lastTime = 0;
let isRunning = false;

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
  } else {
    tooltip.classList.remove('visible');
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
  requestAnimationFrame(animate);
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
