# Ocean Drone Architecture

Real-time ship traffic sonification art piece. Ships in the Dover Strait are visualized on a radar display and sonified - each vessel creates a tone when the radar sweep passes over it.

## Project Structure

```
ocean-drone/
├── index.html          # UI shell, CSS, debug panel
├── server.js           # Node.js WebSocket proxy + static server
├── package.json        # Dependencies: Tone.js, ws, Vite
├── src/
│   ├── main.js         # Entry point, wires everything together
│   ├── config.js       # All constants (bounds, scales, colors)
│   ├── ships.js        # AIS ship tracking, WebSocket client
│   ├── visual.js       # Canvas radar renderer
│   ├── audio.js        # Tone.js sonification engine
│   └── coastline.js    # GeoJSON coastline renderer
└── data/
    └── dover-coastline.geojson
```

## Data Flow

```
aisstream.io (AIS satellite data)
       │
       ▼ wss://stream.aisstream.io
┌──────────────────────────────────┐
│         server.js                │
│  - Subscribes to Dover bounding  │
│  - Caches ships for 5 min        │
│  - Relays to browser clients     │
└──────────────────────────────────┘
       │
       ▼ ws://localhost:3001/ws
┌──────────────────────────────────┐
│         ships.js                 │
│  - Parses PositionReport msgs    │
│  - Validates bounds              │
│  - Normalizes to 0-1 coords      │
│  - Fires onShipEnter/Move/Exit   │
└──────────────────────────────────┘
       │
       ├────────────┬────────────┐
       ▼            ▼            ▼
   visual.js    audio.js     main.js
   (radar)      (sound)      (UI/count)
```

## Key Components

### server.js
- Connects to aisstream.io with API key and bounding box
- Caches ship positions (MMSI → message, 5 min TTL)
- WebSocket server on `/ws` relays to all browser clients
- Sends cached ships immediately on new client connect
- Auto-reconnects if upstream drops

### ships.js - ShipTracker
```javascript
class ShipTracker {
  ships: Map<MMSI, shipData>

  connect()           // WebSocket to server
  handleMessage()     // Parse AIS, validate, normalize
  removeStaleShips()  // 5 min timeout

  // Callbacks
  onShipEnter(ship)
  onShipMove(ship)
  onShipExit(ship)
}
```

Ship data includes: mmsi, name, lat, lon, x, y (normalized), speed, course, shipType, country flag

### visual.js - VisualRenderer
```javascript
class VisualRenderer {
  ships: Map<MMSI, visualShip>
  sweepAngle: number

  render(deltaTime)      // Main loop
  drawSonarBackground()  // Grid, rings, compass
  drawWaves()            // Animated wave pattern
  drawShip(ship)         // Boat silhouette + glow
  drawTrail(ship)        // Position history
  drawSweep()            // Rotating radar line

  // Callbacks
  onShipPing(ship)       // Sweep hit ship → audio
  onShipHover(ship, x, y) // Mouse hover → tooltip
}
```

Coordinate transform: `(0-1) → canvas pixels` via `normalizedToCanvas(x, y)`

### audio.js - AudioEngine
```javascript
class AudioEngine {
  // Ship pings
  synths[6]             // 6 timbres for variety
  currentScale          // Pentatonic notes

  // Drone pads (circle of fifths)
  padSynthA, padSynthB  // Crossfade between modes
  currentModeIndex      // 12 modes, 30s each

  // Ambience
  oceanNoise            // Pink noise + LFO filter
  reverb                // 9s decay, 40% wet

  ping(ship)            // Trigger note based on position
  transitionToNextMode() // Crossfade to next scale
}
```

**Musical system:**
- Circle of fifths: C→Am→Em→G→D→Bm→F#m→A→E→C#m→G#m→B→(loop)
- Mode changes every 30s with 6s crossfade
- Ship Y position → note in pentatonic scale
- Ship distance from center → volume

### config.js
```javascript
BOUNDING_BOX = { minLat: 50.88, maxLat: 51.18, minLon: 1.15, maxLon: 1.95 }

SPEED_COLORS = [
  { max: 2,  hue: 270 },  // Purple - Anchored
  { max: 6,  hue: 180 },  // Cyan - Very Slow
  { max: 12, hue: 120 },  // Green - Slow
  { max: 18, hue: 45 },   // Yellow - Medium
  { max: ∞,  hue: 15 }    // Red - Fast
]

AUDIO = { modeTransitionTime: 30, filterFreq: 2200, baseVolume: -15 }
VISUAL = { bgColor: '#0a0a0a', shipSize: 8, trailLength: 150 }
```

### main.js - Orchestration
```javascript
// Wire ship events to visual
shipTracker.onShipEnter = (ship) => visual.addShip(ship, hue)
shipTracker.onShipMove = (ship) => visual.updateShip(ship, hue)
shipTracker.onShipExit = (ship) => visual.removeShip(ship)

// Wire sweep to audio
visual.onShipPing = (ship) => audioEngine.ping(ship)

// Animation loop
function animate(time) {
  visual.render(deltaTime)
  requestAnimationFrame(animate)
}

// Start on click (required for Web Audio)
document.addEventListener('click', start, { once: true })
```

## Rendering Details

**Sweep collision:**
- Tracks `prevSweepAngle` and `sweepAngle`
- Ship pinged if its angle falls between prev and current
- Triggers `onShipPing` callback and `pingBrightness = 1`

**Ship interpolation:**
- Position lerped: `current += (target - current) * 0.05`
- Smooth movement despite discrete AIS updates

**Trail:**
- Max 150 points, min 2px spacing
- Fading opacity (newest = 35%, oldest = 0%)

## Debug Panel (Press D)

Adjustable parameters:
- Sweep Speed
- Reverb Decay/Wet
- Note Release
- Filter Cutoff
- Master/Drone/Ocean Volume

## Running Locally

```bash
# Terminal 1: Frontend
npm run dev        # Vite on :5173

# Terminal 2: Backend
npm run server     # Node on :3001
```

Requires `.env`:
```
AIS_API_KEY=your_key_from_aisstream.io
```

## Production (Railway)

```bash
npm run build      # Vite → dist/
railway up         # Deploy
```

Server serves `dist/` + WebSocket on same port.

## Key Files Summary

| File | Purpose |
|------|---------|
| server.js | AIS proxy, WebSocket server, static files |
| src/ships.js | Ship tracking, AIS parsing, MMSI→country lookup |
| src/visual.js | Canvas radar, ships, sweep, trails, hover |
| src/audio.js | Tone.js pings, drone pads, ocean noise, reverb |
| src/config.js | Bounding box, scales, colors, audio settings |
| src/main.js | Event wiring, animation loop, start logic |
| src/coastline.js | GeoJSON loader, coastline/port rendering |
