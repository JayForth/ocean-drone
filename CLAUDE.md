# The Song of Dover Strait

Real-time ship traffic sonification art piece. Ships in the Dover Strait are visualized on a radar display and sonified - each vessel creates a tone when the radar sweep passes over it.

## Design & Aesthetic

This is an **ambient art installation**, not a utility. Key design principles:

- **Sonar/radar aesthetic** — Dark background (#0a0a0a), concentric rings, rotating sweep line
- **Minimalist UI** — Monospace font (Courier New), muted colors, no unnecessary chrome
- **Ambient audio** — Designed for background listening. Soft sine wave pings, evolving drone pads, subtle ocean noise. Nothing jarring.
- **Speed-based color palette** — Ships colored by velocity: purple (anchored) → cyan → green → yellow → red (fast). Creates visual rhythm as ferries zip past slower cargo ships.
- **Slow evolution** — The music drifts through keys over time. No sudden changes. The piece should feel like watching the sea.

The goal is something you'd leave running on a screen in a gallery or living room — meditative, ever-changing, connected to real activity happening right now in the busiest shipping lane in the world.

## Running Locally

You need to run **both** servers:

```bash
# Terminal 1: Vite dev server (frontend)
npm run dev
# Runs on http://localhost:5173

# Terminal 2: API proxy server (ship data)
npm run server
# Runs on http://localhost:3001
```

Then open http://localhost:5173 in your browser.

The frontend connects to `ws://localhost:3001/ws` to receive ship data. The server proxies the aisstream.io WebSocket and caches ship positions.

## Environment Variables

Create a `.env` file:

```
AIS_API_KEY=your_api_key_here
```

Get a free API key from https://aisstream.io

## Production

Deployed on **Fly.io** (app: `ocean-drone`, region: `lhr`). In production, the server serves both static files and the WebSocket endpoint on the same port (8080 internally, mapped via `fly.toml`).

```bash
npm run build   # Build frontend to dist/
npm start       # Run production server locally
fly deploy      # Ship to production
```

## Architecture

```
index.html          - Main HTML with embedded styles
src/
  main.js           - Entry point, wires everything together
  ships.js          - Ship tracking, WebSocket client
  audio.js          - Tone.js audio engine for sonification
  visual.js         - Canvas radar visualization
  config.js         - Bounding box, speed colors, etc.
server.js           - Node server: static files + aisstream.io proxy
api/                - Vercel serverless functions (unused on Railway)
```

## Key Behaviors

- Ships colored by speed (fast=red, slow=green, anchored=purple)
- Radar sweep triggers audio ping when passing over ships
- Pitch determined by ship position within the current scale
- Ships cached for 5 minutes, so new clients see ships immediately
- Auto-reconnects if WebSocket drops

## Musical System

The audio follows a **circle of fifths progression**, cycling through 12 keys:

1. C major → 2. A minor → 3. E minor → 4. G major → 5. D major → 6. B minor → 7. F# minor → 8. A major → 9. E major → 10. C# minor → 11. G# minor → 12. B major → (loops)

Each key change:
- Crossfades the drone chords over 6 seconds
- Switches ship ping notes to the new pentatonic scale
- Transition time configurable via `AUDIO.modeTransitionTime` in config.js (default: 30 seconds)

## For AI Agents

**Always read ARCHITECTURE.md first** - it contains detailed documentation of how all systems work together.

### Logging Changes

When making changes to this codebase, **always update the changelog below** so future AI sessions have context:

```
## Changelog

[DATE] - [SUMMARY]
- What was changed
- Why it was changed
- Files modified
```

### Deployment

- **Platform**: Fly.io (app `ocean-drone`, region `lhr`)
- **Deploy command**: `fly deploy` (from project root)
- **Never deploy without user confirmation**
- Use `git stash` to save experimental changes before deploying if needed

### Key Gotchas

- The server subscribes to aisstream.io with a **bounding box** - changing regions requires updating `server.js`
- Audio requires user interaction to start (Web Audio policy)
- `Tone.PolySynth.set()` for envelopes may not update existing voices - also set `synth.options.envelope.*`
- Debug panel (press D) has real-time audio controls

---

## Multi-Zone Architecture (IMPORTANT FOR AI AGENTS)

The app supports multiple shipping zones. Here's how it works:

### Frontend (config.js + zone.js + main.js)
1. `config.js` exports `ZONES` object with zone definitions (id, name, boundingBox, coastlineUrl, audio presets)
2. `config.js` exports `ZONE_ORDER` array defining navigation order
3. `zone.js` exports `zoneManager` singleton that handles zone state and switching
4. `main.js` imports from both and wires up UI (arrows, dots, keyboard nav)

### Backend (server.js)
1. `ZONE_BOUNDING_BOXES` object defines bounding boxes per zone (format: `{ min: [lat, lon], max: [lat, lon] }`)
2. Server subscribes to ALL zones at startup via single aisstream.io connection
3. Incoming AIS messages are tagged with zone via `detectZone(lat, lon)`
4. Ship cache keyed by `"zone:mmsi"` to separate ships per zone
5. `clientZones` Map tracks which zone each WebSocket client is viewing
6. Clients send `{ type: 'switchZone', zone: 'zoneId' }` to switch zones
7. Server only relays messages matching client's current zone

### Adding a New Zone
1. Add zone to `ZONES` in `src/config.js` (with boundingBox, audio preset)
2. Add zone id to `ZONE_ORDER` in `src/config.js`
3. Add bounding box to `ZONE_BOUNDING_BOXES` in `server.js`
4. Add corresponding zone dot `<span class="zone-dot"></span>` in `index.html`
5. Optionally add coastline GeoJSON to `public/data/{zone}-coastline.geojson`

### Common Mistakes
- **Mismatched zone counts**: Number of `.zone-dot` elements in index.html must match `ZONE_ORDER.length`
- **Missing exports**: main.js imports `ZONES`, `ZONE_ORDER` from config.js - if these don't exist, app crashes silently
- **Server/client mismatch**: Zone IDs must match exactly between config.js and server.js

---

## Changelog

**2026-04-21** - Rebrand to "Ambient Boats" + fix ping leak between zones
- Renamed piece from "The Song of Dover Strait" to "Ambient Boats"; Dover zone renamed "English Channel"
- New top header with title + tagline; mobile layout overhauled (radar as hero, info panel hidden, swipe-to-switch zones, bottom vessel count)
- Porthole slide transition between zones (offscreen snapshot + eased pan); outer ring/compass stay fixed
- Ping stagger queue in audio engine to prevent audio overload in dense clusters
- Flattened all zone audio presets to the Dover defaults (variants removed)
- Moved deploy platform from Railway to Fly.io (`Dockerfile`, `fly.toml`, `.dockerignore`)
- Fix: ship-ping leak between zones — `audioEngine.clearPingQueue()` called on zone change; sweep pings suppressed during slide transition
- Files: `index.html`, `src/config.js`, `src/audio.js`, `src/visual.js`, `src/main.js`, `public/data/singapore-coastline.geojson`, `Dockerfile`, `fly.toml`, `.dockerignore`

**2025-01-12** - Simplified to Dover + Gibraltar (Alboran Sea)
- Replaced experimental zones (Suez, Singapore, Liverpool, Solent) with Gibraltar/Alboran Sea
- Fixed broken app after bad git restore removed multi-zone exports
- Gibraltar box: 35.5-36.3°N, -4.5 to -2.0°W (ships spreading east from Gibraltar into Med)
- Added architecture documentation above for future AI sessions
- Files: `src/config.js`, `server.js`, `index.html`

**2025-01-11** - Multi-zone shipping regions
- Added three shipping zones: Dover Strait, Suez Canal, Singapore Strait
- Each zone has distinct musical vibe (Dover=balanced, Suez=sparse/meditative, Singapore=dense/energetic)
- Arrow buttons flank the radar to switch zones, plus left/right keyboard navigation
- Server subscribes to all zones, tags messages by region, caches ships per-zone
- Audio smoothly transitions between zone presets (reverb, filters, timing parameters)
- Files: `src/config.js`, `src/zone.js` (new), `server.js`, `src/audio.js`, `src/ships.js`, `src/visual.js`, `src/main.js`, `index.html`, `public/data/suez-coastline.geojson` (new), `public/data/singapore-coastline.geojson` (new)

**2025-01-10** - Simplified hover tooltip to name only
- Removed ship images (external services block server requests)
- Removed speed and course from tooltip
- Tooltip now shows only ship name
- Removed `/api/ship-image` endpoint from server
- Files: `index.html`, `src/main.js`, `server.js`

**2025-01-09** - Submarine visual effects
- Added SVG film grain overlay with subtle flicker animation
- Added soft green edge glow around radar perimeter
- Files: `index.html`, `src/visual.js`

**2025-01-09** - Note release fix
- Fixed `setNoteRelease()` in audio.js to properly update PolySynth envelope
- Also sets `synth.options.envelope.release` for new voices
- Files: `src/audio.js`

**2025-01-09** - Architecture documentation
- Created ARCHITECTURE.md with full system documentation
- Files: `ARCHITECTURE.md`
