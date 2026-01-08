// Ocean Drone Configuration

// Dover Strait bounding box (busy shipping lane)
export const BOUNDING_BOX = {
  name: 'Dover Strait',
  // Southwest corner
  minLat: 50.85,
  minLon: 1.0,
  // Northeast corner
  maxLat: 51.25,
  maxLon: 2.0
};

// Pentatonic scale notes (C major pentatonic - higher octaves for pleasant sound)
export const SCALE = [
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
  'C6'
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
