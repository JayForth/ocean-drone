// Ocean Drone - Main entry point
import { shipTracker } from './ships.js';
import { audioEngine } from './audio.js';
import { VisualRenderer } from './visual.js';
import { BOUNDING_BOX } from './config.js';

// DOM elements
const canvas = document.getElementById('sonar');
const startScreen = document.getElementById('start-screen');
const shipCountEl = document.getElementById('ship-count');
const infoEl = document.getElementById('info');

// Initialize visual renderer
const visual = new VisualRenderer(canvas);

// Update location display
infoEl.textContent = BOUNDING_BOX.name;

// Animation state
let lastTime = 0;
let isRunning = false;

// Connect ship events to visual system
shipTracker.onShipEnter = (ship) => {
  const hue = audioEngine.getShipHue(ship.y);
  visual.addShip(ship, hue);
  updateShipCount();
};

shipTracker.onShipMove = (ship) => {
  const hue = audioEngine.getShipHue(ship.y);
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

function updateShipCount() {
  const count = shipTracker.getShipCount();
  shipCountEl.textContent = `Ships: ${count}`;
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
async function start() {
  if (isRunning) return;

  // Start audio (requires user gesture)
  await audioEngine.start();

  // Hide start screen
  startScreen.classList.add('hidden');

  // Connect to proxy server
  shipTracker.connect();

  // Start render loop
  isRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(animate);
}

// Click anywhere to start (required for audio)
document.addEventListener('click', start, { once: true });
document.addEventListener('touchstart', start, { once: true });

// Initial render
visual.render(0);
