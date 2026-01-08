// Audio engine using Tone.js - sweep-triggered pings with timbral variation
import * as Tone from 'tone';
import { SCALE, NOTE_HUES, AUDIO } from './config.js';

// Different timbres for variety
const TIMBRES = [
  { wave: 'sine', filterFreq: 2500, attack: 0.02, release: 1.2 },
  { wave: 'triangle', filterFreq: 1800, attack: 0.05, release: 1.5 },
  { wave: 'sine', filterFreq: 3500, attack: 0.01, release: 1.0 },
  { wave: 'triangle', filterFreq: 2200, attack: 0.08, release: 1.8 },
  { wave: 'sine', filterFreq: 2000, attack: 0.03, release: 1.4 },
  { wave: 'triangle', filterFreq: 2800, attack: 0.04, release: 1.3 },
];

// Evolving pad chords - all use pentatonic notes for guaranteed harmony
// Higher octave for airy/ethereal feel
const PAD_CHORDS = [
  ['C3', 'G3', 'C4'],   // C power chord
  ['C3', 'E3', 'G3'],   // C major
  ['A2', 'C3', 'E3'],   // A minor
  ['G2', 'C3', 'D3'],   // Gsus4
  ['A2', 'D3', 'E3'],   // Asus4
];

class AudioEngine {
  constructor() {
    this.isStarted = false;
    this.masterVolume = null;
    this.reverb = null;
    this.synths = []; // Multiple synths for different timbres
    this.filters = [];
    this.recentPings = new Set();
    this.shipTimbres = new Map(); // MMSI -> timbre index

    // Pad synth state
    this.padSynth = null;
    this.padFilter = null;
    this.padVolume = null;
    this.currentChordIndex = 0;
    this.padInterval = null;

    // Ocean ambience state
    this.oceanNoise = null;
    this.oceanFilter = null;
    this.oceanLFO = null;
    this.oceanVolume = null;
  }

  async start() {
    if (this.isStarted) return;

    // iOS mute switch bypass: play a silent <audio> element first
    // This switches iOS from "ambient" mode to "playback" mode
    await this.unlockiOSAudio();

    // Start Tone.js audio context (required for mobile)
    await Tone.start();

    // Ensure context is running (mobile sometimes needs extra nudge)
    if (Tone.context.state !== 'running') {
      await Tone.context.resume();
    }

    console.log('Audio context started, state:', Tone.context.state);

    // Initialize all audio components
    await this.initAudio();
  }

  // Prime iOS audio context (mute switch will still be respected)
  async unlockiOSAudio() {
    // Note: iOS Safari respects the hardware mute switch for Web Audio.
    // There's no reliable workaround - users must turn off silent mode.
    return Promise.resolve();
  }

  async initAudio() {
    // Create master effects chain
    this.reverb = new Tone.Reverb({
      decay: 5,
      wet: 0.45,
      preDelay: 0.03
    }).toDestination();

    this.masterVolume = new Tone.Volume(AUDIO.baseVolume).connect(this.reverb);

    // Create a synth for each timbre
    for (const timbre of TIMBRES) {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: timbre.wave
        },
        envelope: {
          attack: timbre.attack,
          decay: 0.2,
          sustain: 0.15,
          release: timbre.release
        }
      });

      const filter = new Tone.Filter({
        frequency: timbre.filterFreq,
        type: 'lowpass',
        rolloff: -12
      });

      synth.connect(filter);
      filter.connect(this.masterVolume);

      this.synths.push(synth);
      this.filters.push(filter);
    }

    // Create pad synth for evolving chords
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sine'
      },
      envelope: {
        attack: 3,
        decay: 1,
        sustain: 0.8,
        release: 4
      }
    });

    this.padFilter = new Tone.Filter({
      frequency: 800,
      type: 'lowpass',
      rolloff: -24
    });

    this.padVolume = new Tone.Volume(-42).connect(this.reverb);
    this.padSynth.connect(this.padFilter);
    this.padFilter.connect(this.padVolume);

    // Start the evolving pads
    this.startPads();

    // Create ocean wave ambience using filtered noise
    this.oceanNoise = new Tone.Noise('pink').start();

    this.oceanFilter = new Tone.Filter({
      frequency: 400,
      type: 'lowpass',
      rolloff: -24
    });

    // LFO to modulate filter for wave rhythm
    this.oceanLFO = new Tone.LFO({
      frequency: 0.08,  // Slow wave rhythm (~12 second cycle)
      min: 200,
      max: 600
    }).start();
    this.oceanLFO.connect(this.oceanFilter.frequency);

    this.oceanVolume = new Tone.Volume(-32).connect(this.reverb);
    this.oceanNoise.connect(this.oceanFilter);
    this.oceanFilter.connect(this.oceanVolume);

    this.isStarted = true;
  }

  startPads() {
    // Play the first chord immediately
    this.playChord(this.currentChordIndex);

    // Cycle through chords every 18 seconds
    this.padInterval = setInterval(() => {
      // Release current chord
      this.padSynth.releaseAll();

      // Move to next chord
      this.currentChordIndex = (this.currentChordIndex + 1) % PAD_CHORDS.length;

      // Play new chord after a brief moment (allows release to start)
      setTimeout(() => {
        this.playChord(this.currentChordIndex);
      }, 500);
    }, 18000);
  }

  playChord(index) {
    const chord = PAD_CHORDS[index];
    // Trigger with indefinite duration (will be released manually)
    this.padSynth.triggerAttack(chord);
  }

  // Get consistent timbre index for a ship based on MMSI
  getTimbreIndex(mmsi) {
    if (!this.shipTimbres.has(mmsi)) {
      // Use MMSI to deterministically assign a timbre
      const index = mmsi % TIMBRES.length;
      this.shipTimbres.set(mmsi, index);
    }
    return this.shipTimbres.get(mmsi);
  }

  // Get subtle detuning for a ship (consistent per ship)
  getDetune(mmsi) {
    // Generate a consistent detune value from -8 to +8 cents
    const hash = (mmsi * 2654435761) % 1000;
    return (hash / 1000 - 0.5) * 16;
  }

  // Map Y position (0-1) to a note in the scale
  positionToNote(y) {
    const clamped = Math.max(0, Math.min(1, y));
    const index = Math.floor(clamped * (SCALE.length - 1));
    return SCALE[index];
  }

  // Get hue for a note (for visual sync)
  getNoteHue(note) {
    const noteName = note.replace(/[0-9]/g, '');
    return NOTE_HUES[noteName] || 0;
  }

  // Get hue for a ship based on its Y position
  getShipHue(y) {
    const note = this.positionToNote(y);
    return this.getNoteHue(note);
  }

  // Trigger a ping for a ship (called when sweep passes over it)
  ping(ship) {
    if (!this.isStarted) return;

    // Avoid pinging the same ship multiple times per sweep
    if (this.recentPings.has(ship.mmsi)) return;
    this.recentPings.add(ship.mmsi);

    // Clear from recent after a short delay
    setTimeout(() => this.recentPings.delete(ship.mmsi), 400);

    const note = this.positionToNote(ship.y);
    const timbreIndex = this.getTimbreIndex(ship.mmsi);
    const detune = this.getDetune(ship.mmsi);
    const synth = this.synths[timbreIndex];

    // Distance from center affects volume (closer = louder)
    const dx = ship.x - 0.5;
    const dy = ship.y - 0.5;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const volume = Math.max(-24, -8 - distance * 20);

    // Apply detune temporarily
    synth.set({ detune: detune });

    // Trigger the note
    synth.triggerAttackRelease(note, '8n', undefined, Tone.dbToGain(volume));
  }

  getActivePings() {
    return this.recentPings.size;
  }

  dispose() {
    if (this.padInterval) clearInterval(this.padInterval);
    if (this.padSynth) this.padSynth.dispose();
    if (this.padFilter) this.padFilter.dispose();
    if (this.padVolume) this.padVolume.dispose();
    if (this.oceanNoise) this.oceanNoise.dispose();
    if (this.oceanFilter) this.oceanFilter.dispose();
    if (this.oceanLFO) this.oceanLFO.dispose();
    if (this.oceanVolume) this.oceanVolume.dispose();
    for (const synth of this.synths) synth.dispose();
    for (const filter of this.filters) filter.dispose();
    if (this.masterVolume) this.masterVolume.dispose();
    if (this.reverb) this.reverb.dispose();
  }
}

export const audioEngine = new AudioEngine();
