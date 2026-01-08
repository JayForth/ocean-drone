// Ship tracking via aisstream.io WebSocket
import { BOUNDING_BOX } from './config.js';

class ShipTracker {
  constructor() {
    this.ships = new Map();
    this.socket = null;
    this.onShipEnter = null;
    this.onShipExit = null;
    this.onShipMove = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.staleCheckInterval = null;
  }

  connect() {
    // Connect to WebSocket proxy - detect local vs production
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = host.includes('localhost')
      ? 'ws://localhost:3001/ws'
      : `${protocol}//${host}/ws`;
    console.log('Connecting to:', wsUrl);

    try {
      this.socket = new WebSocket(wsUrl);
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      return;
    }

    this.socket.onopen = () => {
      console.log('Connected to proxy server');
      this.reconnectAttempts = 0;

      // Start checking for stale ships (no update in 5 minutes)
      this.staleCheckInterval = setInterval(() => this.removeStaleShips(), 30000);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.attemptReconnect();
    };

    this.socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      console.error('WebSocket readyState:', this.socket.readyState);
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay / 1000}s... (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  handleMessage(data) {
    // aisstream.io message format
    const msgType = data.MessageType;
    if (msgType !== 'PositionReport') return;

    const meta = data.MetaData;
    const pos = data.Message?.PositionReport;

    if (!meta || !pos) return;

    const mmsi = meta.MMSI;
    const lat = pos.Latitude;
    const lon = pos.Longitude;

    // Skip invalid positions
    if (lat === 0 && lon === 0) return;
    if (!this.isInBounds(lat, lon)) return;

    // Normalize position to 0-1 range
    const normalized = this.normalizePosition(lat, lon);

    // Filter out ships outside the circular sonar zone
    const dx = normalized.x - 0.5;
    const dy = normalized.y - 0.5;
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
    if (distanceFromCenter > 0.45) return; // Slightly inside edge for visual margin

    const shipData = {
      mmsi,
      name: meta.ShipName?.trim() || `Ship ${mmsi}`,
      lat,
      lon,
      x: normalized.x,
      y: normalized.y,
      speed: pos.Sog || 0,
      course: pos.Cog || 0,
      lastUpdate: Date.now()
    };

    const isNew = !this.ships.has(mmsi);
    this.ships.set(mmsi, shipData);

    if (isNew) {
      console.log(`Ship entered: ${shipData.name}`);
      this.onShipEnter?.(shipData);
    } else {
      this.onShipMove?.(shipData);
    }
  }

  isInBounds(lat, lon) {
    return (
      lat >= BOUNDING_BOX.minLat &&
      lat <= BOUNDING_BOX.maxLat &&
      lon >= BOUNDING_BOX.minLon &&
      lon <= BOUNDING_BOX.maxLon
    );
  }

  normalizePosition(lat, lon) {
    const x = (lon - BOUNDING_BOX.minLon) / (BOUNDING_BOX.maxLon - BOUNDING_BOX.minLon);
    const y = (lat - BOUNDING_BOX.minLat) / (BOUNDING_BOX.maxLat - BOUNDING_BOX.minLat);
    return { x, y };
  }

  removeStaleShips() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [mmsi, ship] of this.ships) {
      if (now - ship.lastUpdate > staleThreshold) {
        console.log(`Ship exited (stale): ${ship.name}`);
        this.ships.delete(mmsi);
        this.onShipExit?.(ship);
      }
    }
  }

  getShips() {
    return Array.from(this.ships.values());
  }

  getShipCount() {
    return this.ships.size;
  }

  disconnect() {
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
    }
    if (this.socket) {
      this.socket.close();
    }
  }
}

export const shipTracker = new ShipTracker();
