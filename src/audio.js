// Audio engine using Tone.js - sweep-triggered pings
import * as Tone from 'tone';
import { SCALE, NOTE_HUES, AUDIO } from './config.js';

class AudioEngine {
  constructor() {
    this.isStarted = false;
    this.masterVolume = null;
    this.reverb = null;
    this.synth = null;
    this.recentPings = new Set(); // Track recently pinged ships to avoid repeats
  }

  async start() {
    if (this.isStarted) return;

    await Tone.start();
    console.log('Audio context started');

    // Create master effects chain with longer reverb for atmosphere
    this.reverb = new Tone.Reverb({
      decay: 6,
      wet: 0.5,
      preDelay: 0.05
    }).toDestination();

    this.masterVolume = new Tone.Volume(AUDIO.baseVolume).connect(this.reverb);

    // Create a polyphonic synth for pings
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sine'
      },
      envelope: {
        attack: 0.02,
        decay: 0.3,
        sustain: 0.2,
        release: 1.5
      }
    });

    // Filter for warmth
    this.filter = new Tone.Filter({
      frequency: 2000,
      type: 'lowpass',
      rolloff: -12
    });

    this.synth.connect(this.filter);
    this.filter.connect(this.masterVolume);

    this.isStarted = true;
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
    setTimeout(() => this.recentPings.delete(ship.mmsi), 500);

    const note = this.positionToNote(ship.y);

    // Distance from center affects volume (closer = louder)
    const dx = ship.x - 0.5;
    const dy = ship.y - 0.5;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const volume = Math.max(-20, -6 - distance * 15); // -6dB at center, quieter at edges

    // Trigger the note with short duration
    this.synth.triggerAttackRelease(note, '8n', undefined, Tone.dbToGain(volume));
  }

  // Get the number of recent pings (for display)
  getActivePings() {
    return this.recentPings.size;
  }

  dispose() {
    if (this.synth) this.synth.dispose();
    if (this.filter) this.filter.dispose();
    if (this.masterVolume) this.masterVolume.dispose();
    if (this.reverb) this.reverb.dispose();
  }
}

export const audioEngine = new AudioEngine();
