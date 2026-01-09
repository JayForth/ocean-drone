// Coastline renderer - loads and displays Dover Strait coastlines
import { BOUNDING_BOX, COASTLINE } from './config.js';

class CoastlineRenderer {
  constructor() {
    this.features = [];        // Raw GeoJSON LineStrings
    this.normalizedPaths = []; // Paths in normalized (0-1) space
    this.canvasPaths = [];     // Paths in canvas pixel space
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
  }

  // Draw coastlines on canvas context
  draw(ctx, centerX, centerY, radius) {
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

    ctx.restore();
  }
}

export const coastlineRenderer = new CoastlineRenderer();
