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
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Create HTTP server for static files
const server = createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;

  // Try dist folder first (production build), then root
  let fullPath = join(__dirname, 'dist', filePath);
  if (!existsSync(fullPath)) {
    fullPath = join(__dirname, filePath);
  }

  // Security: prevent directory traversal
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const content = readFileSync(fullPath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
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
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    } else {
      res.writeHead(500);
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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
