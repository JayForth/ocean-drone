# The Song of Dover Strait

Real-time ship traffic sonification art piece. Ships in the Dover Strait are visualized on a radar display and sonified - each vessel creates a tone when the radar sweep passes over it.

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
- Pitch determined by ship position
- Ships cached for 5 minutes, so new clients see ships immediately
- Auto-reconnects if WebSocket drops
