// Ocean Drone Configuration

// Zone definitions with bounding boxes and audio presets
export const ZONES = {
  dover: {
    id: 'dover',
    name: 'English Channel',
    description: 'UK-France, busiest short strait',
    boundingBox: {
      minLat: 50.88,
      minLon: 1.15,
      maxLat: 51.18,
      maxLon: 1.95
    },
    coastlineUrl: '/data/dover-coastline.geojson',
    // Balanced, moderate energy - the default
    audio: {
      modeTransitionTime: 30,
      reverbDecay: 9,
      reverbWet: 0.4,
      noteRelease: 9.2,
      oceanLfoFreq: 0.08,
      oceanVolume: -30,
      padVolume: -39,
      filterFreq: 2200,
      padFilterFreq: 800,
      chordCycleTime: 18
    }
  },
  helsinki: {
    id: 'helsinki',
    name: 'Gulf of Finland',
    description: 'Helsinki-Tallinn corridor, Baltic ferry highway',
    boundingBox: {
      minLat: 59.35,
      minLon: 23.5,
      maxLat: 60.25,
      maxLon: 26.0
    },
    coastlineUrl: '/data/helsinki-coastline.geojson',
    audio: {
      modeTransitionTime: 30,
      reverbDecay: 9,
      reverbWet: 0.4,
      noteRelease: 9.2,
      oceanLfoFreq: 0.08,
      oceanVolume: -30,
      padVolume: -39,
      filterFreq: 2200,
      padFilterFreq: 800,
      chordCycleTime: 18
    }
  },
  singapore: {
    id: 'singapore',
    name: 'Singapore Harbor',
    description: 'World\'s busiest port, gateway to the Strait of Malacca',
    boundingBox: {
      minLat: 1.15,
      minLon: 103.55,
      maxLat: 1.35,
      maxLon: 104.15
    },
    coastlineUrl: '/data/singapore-coastline.geojson',
    audio: {
      modeTransitionTime: 30,
      reverbDecay: 9,
      reverbWet: 0.4,
      noteRelease: 9.2,
      oceanLfoFreq: 0.08,
      oceanVolume: -30,
      padVolume: -39,
      filterFreq: 2200,
      padFilterFreq: 800,
      chordCycleTime: 18
    }
  }
};

export const ZONE_ORDER = ['dover', 'helsinki', 'singapore'];
export const DEFAULT_ZONE = 'dover';

// Current active bounding box (updated when zone changes)
export let BOUNDING_BOX = { ...ZONES.dover.boundingBox, name: ZONES.dover.name };

// Function to update the active bounding box
export function setActiveBoundingBox(zone) {
  BOUNDING_BOX.minLat = zone.boundingBox.minLat;
  BOUNDING_BOX.minLon = zone.boundingBox.minLon;
  BOUNDING_BOX.maxLat = zone.boundingBox.maxLat;
  BOUNDING_BOX.maxLon = zone.boundingBox.maxLon;
  BOUNDING_BOX.name = zone.name;
}

// Pentatonic scale notes (C major pentatonic)
export const SCALE = [
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
  'C6'
];

// Map notes to hues for visual coloring (kept for audio)
export const NOTE_HUES = {
  'C': 15,    // Red-Orange
  'D': 45,    // Yellow-Orange
  'E': 120,   // Green
  'G': 180,   // Cyan
  'A': 270    // Purple
};

// Speed ranges (knots) to hues for visual coloring
export const SPEED_COLORS = [
  { max: 2, hue: 270, label: 'Anchored (0-2 kn)' },      // Purple
  { max: 6, hue: 180, label: 'Very Slow (2-6 kn)' },    // Cyan
  { max: 12, hue: 120, label: 'Slow (6-12 kn)' },       // Green
  { max: 18, hue: 45, label: 'Medium (12-18 kn)' },     // Yellow-Orange
  { max: Infinity, hue: 15, label: 'Fast (18+ kn)' }    // Red-Orange
];

// Audio settings
export const AUDIO = {
  maxDrones: 12,        // Maximum simultaneous drones
  fadeTime: 3,          // Seconds to fade in/out
  filterFreq: 2200,     // Low-pass filter cutoff
  detuneAmount: 3,      // Cents of detuning for richness
  baseVolume: -15,      // Base volume in dB
  modeTransitionTime: 30 // Seconds between scale shifts
};

// Visual settings
export const VISUAL = {
  bgColor: '#0a0a0a',
  ringColor: 'rgba(255, 255, 255, 0.1)',
  shipSize: 8,
  glowSize: 20,
  trailLength: 150,      // Number of trail points to keep
  trailMinDistance: 2    // Minimum pixels between trail points
};

// Coastline settings
export const COASTLINE = {
  color: 'rgba(100, 160, 120, 0.35)',
  width: 1.5
};
