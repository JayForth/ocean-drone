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

Deployed on Railway. In production, the server serves both static files and the WebSocket endpoint on the same port.

```bash
npm run build   # Build frontend to dist/
npm start       # Run production server
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
