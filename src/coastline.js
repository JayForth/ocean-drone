// Coastline renderer - loads and displays Dover Strait coastlines
import { BOUNDING_BOX, COASTLINE, VISUAL } from './config.js';

// Major ports in the Dover Strait area
const PORTS = [
  { name: 'Dover', lat: 51.127, lon: 1.313 },
  { name: 'Calais', lat: 50.968, lon: 1.852 },
  { name: 'Folkestone', lat: 51.081, lon: 1.166 },
  { name: 'Dunkirk', lat: 51.048, lon: 2.377 },
];

class CoastlineRenderer {
  constructor() {
    this.features = [];        // Raw GeoJSON LineStrings
    this.normalizedPaths = []; // Paths in normalized (0-1) space
    this.canvasPaths = [];     // Paths in canvas pixel space
    this.portPositions = [];   // Pre-computed port canvas positions
    this.loaded = false;
    this.centerX = 0;
    this.centerY = 0;
    this.radius = 0;
  }

  async load(url = '/data/dover-coastline.geojson') {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const geojson = await response.json();
      this.features = geojson.features || [];

      // Pre-compute normalized paths
      this.normalizedPaths = this.features.map(feature => {
        const coords = feature.geometry.coordinates;
        return coords.map(([lon, lat]) => this.normalizeCoord(lon, lat));
      });

      this.loaded = true;
      console.log(`Coastline loaded: ${this.features.length} segments`);

    } catch (err) {
      console.warn('Failed to load coastline:', err.message);
      this.loaded = false;
    }
  }

  // Same normalization as ships.js normalizePosition()
  normalizeCoord(lon, lat) {
    const x = (lon - BOUNDING_BOX.minLon) / (BOUNDING_BOX.maxLon - BOUNDING_BOX.minLon);
    const y = (lat - BOUNDING_BOX.minLat) / (BOUNDING_BOX.maxLat - BOUNDING_BOX.minLat);
    return { x, y };
  }

  // Same as visual.js normalizedToCanvas()
  normalizedToCanvas(x, y) {
    const canvasX = this.centerX + (x - 0.5) * 2 * this.radius * 0.9;
    const canvasY = this.centerY + (0.5 - y) * 2 * this.radius * 0.9;
    return { x: canvasX, y: canvasY };
  }

  // Update canvas paths when canvas size changes
  updateCanvasPaths(centerX, centerY, radius) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;

    this.canvasPaths = this.normalizedPaths.map(path => {
      return path.map(({ x, y }) => this.normalizedToCanvas(x, y));
    });

    // Update port positions
    this.portPositions = PORTS.map(port => {
      const normalized = this.normalizeCoord(port.lon, port.lat);
      const canvas = this.normalizedToCanvas(normalized.x, normalized.y);
      return { name: port.name, ...canvas, normalized };
    });
  }

  // Draw filled land areas to mask waves
  drawLandFill(ctx, centerX, centerY, radius) {
    if (!this.loaded || this.canvasPaths.length === 0) return;

    // Update paths if dimensions changed
    if (centerX !== this.centerX || centerY !== this.centerY || radius !== this.radius) {
      this.updateCanvasPaths(centerX, centerY, radius);
    }

    ctx.save();

    // Clip to circular sonar area
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = VISUAL.bgColor;

    for (let i = 0; i < this.canvasPaths.length; i++) {
      const path = this.canvasPaths[i];
      const normalizedPath = this.normalizedPaths[i];
      if (path.length < 2) continue;

      // Calculate average normalized position to determine if UK or France
      let avgX = 0, avgY = 0;
      for (const pt of normalizedPath) {
        avgX += pt.x;
        avgY += pt.y;
      }
      avgX /= normalizedPath.length;
      avgY /= normalizedPath.length;

      // UK is northwest (low x, high y), France is southeast (high x, low y)
      const isUK = avgX < 0.5;

      ctx.beginPath();

      if (isUK) {
        // UK: fill from coastline to top-left
        // Start from first point, go to top-left corner area, around to last point
        const first = path[0];
        const last = path[path.length - 1];

        // Draw the coastline path
        ctx.moveTo(first.x, first.y);
        for (let j = 1; j < path.length; j++) {
          ctx.lineTo(path[j].x, path[j].y);
        }

        // Extend to edge and fill northwest area
        // Go to top-left area of radar
        ctx.lineTo(centerX - radius * 1.5, last.y);
        ctx.lineTo(centerX - radius * 1.5, centerY - radius * 1.5);
        ctx.lineTo(first.x, centerY - radius * 1.5);
        ctx.closePath();
      } else {
        // France: fill from coastline to bottom-right
        const first = path[0];
        const last = path[path.length - 1];

        // Draw the coastline path
        ctx.moveTo(first.x, first.y);
        for (let j = 1; j < path.length; j++) {
          ctx.lineTo(path[j].x, path[j].y);
        }

        // Extend to edge and fill southeast area
        ctx.lineTo(centerX + radius * 1.5, last.y);
        ctx.lineTo(centerX + radius * 1.5, centerY + radius * 1.5);
        ctx.lineTo(first.x, centerY + radius * 1.5);
        ctx.closePath();
      }

      ctx.fill();
    }

    ctx.restore();
  }

  // Draw coastlines on canvas context
  draw(ctx, centerX, centerY, radius) {
    // Update paths if dimensions changed
    if (centerX !== this.centerX || centerY !== this.centerY || radius !== this.radius) {
      this.updateCanvasPaths(centerX, centerY, radius);
    }

    // Skip coastline drawing if not loaded, but still draw ports
    if (!this.loaded || this.canvasPaths.length === 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
      ctx.clip();
      this.drawPorts(ctx, centerX, centerY, radius);
      ctx.restore();
      return;
    }

    ctx.save();

    // Clip to circular sonar area
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
    ctx.clip();

    // Draw coastline paths
    ctx.strokeStyle = COASTLINE.color;
    ctx.lineWidth = COASTLINE.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const path of this.canvasPaths) {
      if (path.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);

      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }

      ctx.stroke();
    }

    // Draw port markers
    this.drawPorts(ctx, centerX, centerY, radius);

    ctx.restore();
  }

  drawPorts(ctx, centerX, centerY, radius) {
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const port of this.portPositions) {
      // Check if port is within the visible circle
      const dx = port.x - centerX;
      const dy = port.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius - 20) continue;

      // Draw small anchor/port marker
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(port.x, port.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw port name
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText(port.name, port.x, port.y - 10);
    }
  }
}

export const coastlineRenderer = new CoastlineRenderer();
