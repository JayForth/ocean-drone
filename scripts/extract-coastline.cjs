// Script to extract Dover Strait coastline from Natural Earth data
// Run with: node scripts/extract-coastline.js

const fs = require('fs');
const path = require('path');

// Dover Strait bounding box (expanded for complete coverage)
const BOUNDS = {
  minLon: 0.5,
  maxLon: 2.5,
  minLat: 50.5,
  maxLat: 51.5
};

// Natural Earth 10m coastline URL (from GitHub)
const COASTLINE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson';

async function fetchCoastline() {
  console.log('Fetching Natural Earth 10m coastline...');
  const response = await fetch(COASTLINE_URL);
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  return response.json();
}

// Check if a coordinate is within bounds
function inBounds(lon, lat) {
  return lon >= BOUNDS.minLon && lon <= BOUNDS.maxLon &&
         lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat;
}

// Check if any point in a line segment is within or crosses bounds
function lineIntersectsBounds(coords) {
  // Check if any point is in bounds
  for (const [lon, lat] of coords) {
    if (inBounds(lon, lat)) return true;
  }

  // Check if line crosses through bounds (simple check)
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];

    // If segment spans the bounding box in both dimensions, likely crosses
    const lonOverlap = (Math.min(lon1, lon2) <= BOUNDS.maxLon) && (Math.max(lon1, lon2) >= BOUNDS.minLon);
    const latOverlap = (Math.min(lat1, lat2) <= BOUNDS.maxLat) && (Math.max(lat1, lat2) >= BOUNDS.minLat);

    if (lonOverlap && latOverlap) return true;
  }

  return false;
}

// Clip a line to the bounding box (keep segments that enter the box)
function clipLine(coords) {
  const clipped = [];
  let currentSegment = [];

  for (const [lon, lat] of coords) {
    if (inBounds(lon, lat)) {
      currentSegment.push([lon, lat]);
    } else {
      // Point outside bounds
      if (currentSegment.length > 0) {
        // Add one point outside to show continuation
        currentSegment.push([lon, lat]);
        if (currentSegment.length >= 2) {
          clipped.push(currentSegment);
        }
        currentSegment = [];
      }
    }
  }

  if (currentSegment.length >= 2) {
    clipped.push(currentSegment);
  }

  return clipped;
}

async function main() {
  try {
    const geojson = await fetchCoastline();
    console.log(`Loaded ${geojson.features.length} features`);

    const filteredFeatures = [];

    for (const feature of geojson.features) {
      if (feature.geometry.type === 'LineString') {
        if (lineIntersectsBounds(feature.geometry.coordinates)) {
          // Keep segments within bounds
          const clippedSegments = clipLine(feature.geometry.coordinates);
          for (const segment of clippedSegments) {
            if (segment.length >= 2) {
              filteredFeatures.push({
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: segment
                }
              });
            }
          }
        }
      } else if (feature.geometry.type === 'MultiLineString') {
        for (const line of feature.geometry.coordinates) {
          if (lineIntersectsBounds(line)) {
            const clippedSegments = clipLine(line);
            for (const segment of clippedSegments) {
              if (segment.length >= 2) {
                filteredFeatures.push({
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: segment
                  }
                });
              }
            }
          }
        }
      }
    }

    console.log(`Extracted ${filteredFeatures.length} coastline segments`);

    const output = {
      type: 'FeatureCollection',
      features: filteredFeatures
    };

    const outputPath = path.join(__dirname, '..', 'public', 'data', 'dover-coastline.geojson');
    fs.writeFileSync(outputPath, JSON.stringify(output));

    const stats = fs.statSync(outputPath);
    console.log(`Saved to ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
