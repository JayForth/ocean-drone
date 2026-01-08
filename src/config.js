// Ocean Drone Configuration

// English Channel bounding box (wider area for more ships)
export const BOUNDING_BOX = {
  name: 'English Channel',
  // Southwest corner (off Brittany)
  minLat: 48.5,
  minLon: -5.0,
  // Northeast corner (North Sea entrance)
  maxLat: 52.0,
  maxLon: 4.0
};

// Pentatonic scale notes (C major pentatonic across 3 octaves)
// These are peaceful and always harmonize
export const SCALE = [
  'C2', 'D2', 'E2', 'G2', 'A2',
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4'
];

// Map notes to hues for visual coloring
export const NOTE_HUES = {
  'C': 15,    // Red-Orange
  'D': 45,    // Yellow-Orange
  'E': 120,   // Green
  'G': 180,   // Cyan
  'A': 270    // Purple
};

// Audio settings
export const AUDIO = {
  maxDrones: 12,        // Maximum simultaneous drones
  fadeTime: 3,          // Seconds to fade in/out
  filterFreq: 1000,     // Low-pass filter cutoff
  detuneAmount: 3,      // Cents of detuning for richness
  baseVolume: -18       // Base volume in dB
};

// Visual settings
export const VISUAL = {
  bgColor: '#0a0a0a',
  ringColor: 'rgba(255, 255, 255, 0.1)',
  shipSize: 8,
  glowSize: 20,
  trailLength: 5
};
