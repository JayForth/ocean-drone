// Combined server: static files + AIS WebSocket proxy
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = process.env.AIS_API_KEY;
const PORT = process.env.PORT || 3001;

// Dover Strait bounding box
const BOUNDING_BOX = [
  [[50.85, 1.0], [51.25, 2.0]]
];

if (!API_KEY) {
  console.error('Error: AIS_API_KEY not found in environment');
  process.exit(1);
}

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.geojson': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// CORS headers helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// Search Wikimedia Commons for ship image
async function searchWikimediaCommons(shipName) {
  try {
    // Search for ship images on Wikimedia Commons
    const query = encodeURIComponent(`${shipName} ship`);
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${query}&srnamespace=6&srlimit=5&format=json`;

    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'OceanDrone/1.0 (https://ocean-drone-production.up.railway.app)' }
    });
    const data = await response.json();

    if (!data.query?.search?.length) return null;

    // Get image info for the first result
    for (const result of data.query.search) {
      const title = result.title;
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=300&format=json`;

      const infoResponse = await fetch(infoUrl, {
        headers: { 'User-Agent': 'OceanDrone/1.0 (https://ocean-drone-production.up.railway.app)' }
      });
      const infoData = await infoResponse.json();

      const pages = infoData.query?.pages;
      if (!pages) continue;

      const page = Object.values(pages)[0];
      const imageInfo = page?.imageinfo?.[0];

      // Prefer thumbnail, fall back to full URL
      const imageUrl = imageInfo?.thumburl || imageInfo?.url;
      if (imageUrl) return imageUrl;
    }
  } catch (e) {
    console.log('Wikimedia search failed:', e.message);
  }
  return null;
}

// Try to fetch an image, returns buffer and content-type or null
async function tryFetchImage(url, minSize = 1000) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*'
      }
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < minSize) return null;

    return { buffer: Buffer.from(buffer), contentType };
  } catch (e) {
    return null;
  }
}

// Ship image search endpoint
async function handleShipImage(req, res, params) {
  const name = params.get('name');
  const mmsi = params.get('mmsi');

  if (!name && !mmsi) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: 'name or mmsi required' }));
    return;
  }

  // Sources to try in order
  const sources = [];

  if (mmsi) {
    // MarineTraffic - most comprehensive
    sources.push(`https://photos.marinetraffic.com/ais/showphoto.aspx?mmsi=${mmsi}&size=thumb300`);
    // VesselFinder
    sources.push(`https://images.vesselfinder.com/vessels/${mmsi}-0.jpg`);
    // FleetMon
    sources.push(`https://www.fleetmon.com/vessels/photo.jpg?mmsi=${mmsi}`);
  }

  // Try each MMSI-based source
  for (const url of sources) {
    const result = await tryFetchImage(url);
    if (result) {
      res.writeHead(200, {
        'Content-Type': result.contentType,
        'Cache-Control': 'public, max-age=86400',
        ...corsHeaders
      });
      res.end(result.buffer);
      return;
    }
  }

  // Fallback: search Wikimedia Commons by name
  if (name) {
    const wikiImageUrl = await searchWikimediaCommons(name);
    if (wikiImageUrl) {
      const result = await tryFetchImage(wikiImageUrl, 500);
      if (result) {
        res.writeHead(200, {
          'Content-Type': result.contentType,
          'Cache-Control': 'public, max-age=86400',
          ...corsHeaders
        });
        res.end(result.buffer);
        return;
      }
    }
  }

  // No image found
  res.writeHead(404, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify({ error: 'no image found' }));
}

// Create HTTP server for static files
const server = createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // Parse URL
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API endpoints
  if (url.pathname === '/api/ship-image') {
    await handleShipImage(req, res, url.searchParams);
    return;
  }

  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;

  // Try dist folder first (production build), then root
  let fullPath = join(__dirname, 'dist', filePath);
  if (!existsSync(fullPath)) {
    fullPath = join(__dirname, filePath);
  }

  // Security: prevent directory traversal
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403, corsHeaders);
    res.end('Forbidden');
    return;
  }

  try {
    const content = readFileSync(fullPath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, ...corsHeaders });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // SPA fallback - serve index.html for routes
      try {
        let indexPath = join(__dirname, 'dist', 'index.html');
        if (!existsSync(indexPath)) {
          indexPath = join(__dirname, 'index.html');
        }
        const content = readFileSync(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html', ...corsHeaders });
        res.end(content);
      } catch {
        res.writeHead(404, corsHeaders);
        res.end('Not found');
      }
    } else {
      res.writeHead(500, corsHeaders);
      res.end('Server error');
    }
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });
console.log('WebSocket endpoint: /ws');

let aisSocket = null;
let browserClients = new Set();
let messageCount = 0;

// Ship cache - stores recent messages so new clients get instant data
const shipCache = new Map(); // MMSI -> { message, timestamp }
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Clean stale ships from cache periodically
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [mmsi, data] of shipCache) {
    if (now - data.timestamp > CACHE_TTL) {
      shipCache.delete(mmsi);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`Cleaned ${removed} stale ships from cache, ${shipCache.size} remaining`);
  }
}, 60000);

function connectToAIS() {
  console.log('Connecting to aisstream.io...');

  aisSocket = new WebSocket('wss://stream.aisstream.io/v0/stream');

  aisSocket.on('open', () => {
    console.log('Connected to aisstream.io');
    messageCount = 0;

    const subscribeMsg = {
      APIKey: API_KEY,
      BoundingBoxes: BOUNDING_BOX
    };

    aisSocket.send(JSON.stringify(subscribeMsg));
    console.log('Subscribed to Dover Strait area');
  });

  aisSocket.on('message', (data) => {
    messageCount++;
    if (messageCount % 100 === 0) {
      console.log(`Relayed ${messageCount} messages, ${shipCache.size} ships cached, ${browserClients.size} clients`);
    }

    const message = data.toString();

    // Cache the message by MMSI
    try {
      const parsed = JSON.parse(message);
      if (parsed.MessageType === 'PositionReport' && parsed.MetaData?.MMSI) {
        shipCache.set(parsed.MetaData.MMSI, {
          message,
          timestamp: Date.now()
        });
      }
    } catch (e) {
      // Ignore parse errors, still relay
    }

    // Relay to all clients
    for (const client of browserClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  aisSocket.on('close', () => {
    console.log('Disconnected from aisstream.io, reconnecting in 5s...');
    setTimeout(connectToAIS, 5000);
  });

  aisSocket.on('error', (err) => {
    console.error('AIS WebSocket error:', err.message);
  });
}

// Handle browser client connections
wss.on('connection', (ws) => {
  console.log(`Browser client connected, sending ${shipCache.size} cached ships`);
  browserClients.add(ws);

  // Send all cached ships immediately
  for (const [mmsi, data] of shipCache) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data.message);
    }
  }

  ws.on('close', () => {
    console.log('Browser client disconnected');
    browserClients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('Client error:', err.message);
    browserClients.delete(ws);
  });
});

// Start everything
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  connectToAIS();
});
