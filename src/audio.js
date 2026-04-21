// Audio engine using Tone.js - sweep-triggered pings with timbral variation
import * as Tone from 'tone';
import { NOTE_HUES, AUDIO } from './config.js';

// Different timbres for variety
// Slightly softened attacks with brighter filtering
const TIMBRES = [
  { wave: 'sine', filterFreq: 2200, attack: 0.05, release: 9.2 },
  { wave: 'sine', filterFreq: 2200, attack: 0.06, release: 9.2 },
  { wave: 'sine', filterFreq: 2200, attack: 0.04, release: 9.2 },
  { wave: 'sine', filterFreq: 2200, attack: 0.07, release: 9.2 },
  { wave: 'sine', filterFreq: 2200, attack: 0.05, release: 9.2 },
  { wave: 'sine', filterFreq: 2200, attack: 0.08, release: 9.2 },
];

// Circle of fifths progression:
// Major → relative minor → clockwise minor → relative major → clockwise major → ...
const MODES = [
  // C major
  {
    name: 'C major',
    scale: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'],
    chords: [['C3', 'G3', 'C4'], ['C3', 'E3', 'G3'], ['G2', 'C3', 'E3']]
  },
  // A minor (relative minor of C)
  {
    name: 'A minor',
    scale: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'],
    chords: [['A2', 'E3', 'A3'], ['A2', 'C3', 'E3'], ['E2', 'A2', 'C3']]
  },
  // E minor (clockwise from Am)
  {
    name: 'E minor',
    scale: ['E4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5', 'A5', 'B5', 'D6', 'E6'],
    chords: [['E2', 'B2', 'E3'], ['E2', 'G2', 'B2'], ['B2', 'E3', 'G3']]
  },
  // G major (relative major of Em)
  {
    name: 'G major',
    scale: ['G4', 'A4', 'B4', 'D5', 'E5', 'G5', 'A5', 'B5', 'D6', 'E6', 'G6'],
    chords: [['G2', 'D3', 'G3'], ['G2', 'B2', 'D3'], ['D2', 'G2', 'B2']]
  },
  // D major (clockwise from G)
  {
    name: 'D major',
    scale: ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6'],
    chords: [['D2', 'A2', 'D3'], ['D2', 'F#2', 'A2'], ['A2', 'D3', 'F#3']]
  },
  // B minor (relative minor of D)
  {
    name: 'B minor',
    scale: ['B3', 'D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5'],
    chords: [['B2', 'F#3', 'B3'], ['B2', 'D3', 'F#3'], ['F#2', 'B2', 'D3']]
  },
  // F# minor (clockwise from Bm)
  {
    name: 'F# minor',
    scale: ['F#4', 'A4', 'B4', 'C#5', 'E5', 'F#5', 'A5', 'B5', 'C#6', 'E6', 'F#6'],
    chords: [['F#2', 'C#3', 'F#3'], ['F#2', 'A2', 'C#3'], ['C#2', 'F#2', 'A2']]
  },
  // A major (relative major of F#m)
  {
    name: 'A major',
    scale: ['A3', 'B3', 'C#4', 'E4', 'F#4', 'A4', 'B4', 'C#5', 'E5', 'F#5', 'A5'],
    chords: [['A2', 'E3', 'A3'], ['A2', 'C#3', 'E3'], ['E2', 'A2', 'C#3']]
  },
  // E major (clockwise from A)
  {
    name: 'E major',
    scale: ['E4', 'F#4', 'G#4', 'B4', 'C#5', 'E5', 'F#5', 'G#5', 'B5', 'C#6', 'E6'],
    chords: [['E2', 'B2', 'E3'], ['E2', 'G#2', 'B2'], ['B2', 'E3', 'G#3']]
  },
  // C# minor (relative minor of E)
  {
    name: 'C# minor',
    scale: ['C#4', 'E4', 'F#4', 'G#4', 'B4', 'C#5', 'E5', 'F#5', 'G#5', 'B5', 'C#6'],
    chords: [['C#3', 'G#3', 'C#4'], ['C#3', 'E3', 'G#3'], ['G#2', 'C#3', 'E3']]
  },
  // G# minor (clockwise from C#m)
  {
    name: 'G# minor',
    scale: ['G#3', 'B3', 'C#4', 'D#4', 'F#4', 'G#4', 'B4', 'C#5', 'D#5', 'F#5', 'G#5'],
    chords: [['G#2', 'D#3', 'G#3'], ['G#2', 'B2', 'D#3'], ['D#2', 'G#2', 'B2']]
  },
  // B major (relative major of G#m) - then loops back to C
  {
    name: 'B major',
    scale: ['B3', 'C#4', 'D#4', 'F#4', 'G#4', 'B4', 'C#5', 'D#5', 'F#5', 'G#5', 'B5'],
    chords: [['B2', 'F#3', 'B3'], ['B2', 'D#3', 'F#3'], ['F#2', 'B2', 'D#3']]
  }
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
    this.shipNoteIndex = new Map(); // MMSI -> current position in scale (cycles each ping)

    // Ping stagger queue - prevents audio overload in dense clusters
    this.pingQueue = [];
    this.pingTimer = null;
    this.lastPingTime = 0;

    // Pad synth state (two synths for crossfading between modes)
    this.padSynthA = null;
    this.padFilterA = null;
    this.padVolumeA = null;
    this.padSynthB = null;
    this.padFilterB = null;
    this.padVolumeB = null;
    this.currentChordIndex = 0;
    this.padInterval = null;

    // Mode transition state (circle of fifths progression)
    this.currentModeIndex = 0;     // Index into MODES array
    this.currentScale = MODES[0].scale;  // Current scale for ship pings
    this.activePad = 'A';          // which pad synth is currently playing
    this.modeTransitionInterval = null;

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
      decay: 9,
      wet: 0.4,
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

    // Create two pad synths for crossfading between modes
    const padConfig = {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 3,
        decay: 1,
        sustain: 0.8,
        release: 4
      }
    };

    const filterConfig = {
      frequency: 800,
      type: 'lowpass',
      rolloff: -24
    };

    // Pad synth A (starts active with C major)
    this.padSynthA = new Tone.PolySynth(Tone.Synth, padConfig);
    this.padFilterA = new Tone.Filter(filterConfig);
    this.padVolumeA = new Tone.Volume(-39).connect(this.reverb);
    this.padSynthA.connect(this.padFilterA);
    this.padFilterA.connect(this.padVolumeA);

    // Pad synth B (starts silent, for crossfade)
    this.padSynthB = new Tone.PolySynth(Tone.Synth, padConfig);
    this.padFilterB = new Tone.Filter(filterConfig);
    this.padVolumeB = new Tone.Volume(-100).connect(this.reverb); // Start silent
    this.padSynthB.connect(this.padFilterB);
    this.padFilterB.connect(this.padVolumeB);

    // Start the evolving pads and mode transitions
    this.startPads();
    this.startModeTransitions();

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

    this.oceanVolume = new Tone.Volume(-30).connect(this.reverb);
    this.oceanNoise.connect(this.oceanFilter);
    this.oceanFilter.connect(this.oceanVolume);

    this.isStarted = true;
  }

  startPads() {
    // Play the first chord on pad A
    console.log(`Starting in ${MODES[this.currentModeIndex].name}`);
    this.playChordOnPad('A', this.currentChordIndex);

    // Cycle through chords every 18 seconds
    this.padInterval = setInterval(() => {
      // Release current chord on active pad
      const activeSynth = this.activePad === 'A' ? this.padSynthA : this.padSynthB;
      activeSynth.releaseAll();

      // Move to next chord in current mode
      const chords = MODES[this.currentModeIndex].chords;
      this.currentChordIndex = (this.currentChordIndex + 1) % chords.length;

      // Play new chord after a brief moment (allows release to start)
      setTimeout(() => {
        this.playChordOnPad(this.activePad, this.currentChordIndex);
      }, 500);
    }, 18000);
  }

  playChordOnPad(pad, index) {
    const chords = MODES[this.currentModeIndex].chords;
    const chord = chords[index % chords.length];
    const synth = pad === 'A' ? this.padSynthA : this.padSynthB;
    synth.triggerAttack(chord);
  }

  startModeTransitions() {
    // Transition through circle of fifths
    this.modeTransitionInterval = setInterval(() => {
      this.crossfadeToNextMode();
    }, AUDIO.modeTransitionTime * 1000);
  }

  crossfadeToNextMode() {
    const currentMode = MODES[this.currentModeIndex];
    const nextModeIndex = (this.currentModeIndex + 1) % MODES.length;
    const nextMode = MODES[nextModeIndex];
    const nextPad = this.activePad === 'A' ? 'B' : 'A';

    console.log(`Transitioning from ${currentMode.name} to ${nextMode.name}`);

    // Get synths and volumes
    const currentSynth = this.activePad === 'A' ? this.padSynthA : this.padSynthB;
    const currentVolume = this.activePad === 'A' ? this.padVolumeA : this.padVolumeB;
    const nextVolume = nextPad === 'A' ? this.padVolumeA : this.padVolumeB;

    // Update mode index and scale before playing new chord
    this.currentModeIndex = nextModeIndex;
    this.currentScale = nextMode.scale;
    this.currentChordIndex = 0;

    // Start the new chord on the incoming pad (still silent)
    this.playChordOnPad(nextPad, this.currentChordIndex);

    // Crossfade over 6 seconds (longer for smoother transition)
    const fadeTime = 6;
    currentVolume.volume.rampTo(-100, fadeTime);
    nextVolume.volume.rampTo(-39, fadeTime);

    // After fade completes, clean up old pad
    setTimeout(() => {
      currentSynth.releaseAll();
      this.activePad = nextPad;
    }, fadeTime * 1000);
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

  // Map Y position (0-1) to a note in the current scale
  positionToNote(y) {
    const clamped = Math.max(0, Math.min(1, y));
    const scale = this.currentScale;
    const index = Math.floor(clamped * (scale.length - 1));
    return scale[index];
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

  // Get the next note for a ship (cycles through pentatonic scale)
  getNextNote(mmsi) {
    // Initialize with a starting position based on MMSI (so ships start at different points)
    if (!this.shipNoteIndex.has(mmsi)) {
      const startIndex = mmsi % SCALE.length;
      this.shipNoteIndex.set(mmsi, startIndex);
    }

    // Get current note
    const currentIndex = this.shipNoteIndex.get(mmsi);
    const note = SCALE[currentIndex];

    // Advance to next note for next time (cycle through scale)
    const nextIndex = (currentIndex + 1) % SCALE.length;
    this.shipNoteIndex.set(mmsi, nextIndex);

    return note;
  }

  // Trigger a ping for a ship (called when sweep passes over it)
  // Queues pings and staggers playback to prevent audio overload in dense clusters
  ping(ship) {
    if (!this.isStarted) return;

    // Avoid pinging the same ship multiple times per sweep
    if (this.recentPings.has(ship.mmsi)) return;
    this.recentPings.add(ship.mmsi);
    setTimeout(() => this.recentPings.delete(ship.mmsi), 400);

    const now = performance.now();
    const minInterval = 60;

    // If nothing queued and enough time since last ping, play immediately
    if (this.pingQueue.length === 0 && now - this.lastPingTime >= minInterval) {
      this.playPing(ship);
      this.lastPingTime = now;
    } else {
      // Queue it and start draining
      this.pingQueue.push(ship);
      if (!this.pingTimer) {
        const delay = Math.max(0, minInterval - (now - this.lastPingTime));
        this.pingTimer = setTimeout(() => this.drainPingQueue(), delay);
      }
    }
  }

  drainPingQueue() {
    this.pingTimer = null;
    if (this.pingQueue.length === 0) return;

    const ship = this.pingQueue.shift();
    this.playPing(ship);
    this.lastPingTime = performance.now();

    if (this.pingQueue.length > 0) {
      // Adaptive interval: spread remaining pings over ~600ms total
      // More queued = faster spacing, but clamped between 30-120ms
      const interval = Math.min(120, Math.max(30, 600 / (this.pingQueue.length + 1)));
      this.pingTimer = setTimeout(() => this.drainPingQueue(), interval);
    }
  }

  playPing(ship) {
    const note = this.positionToNote(ship.y);
    const timbreIndex = this.getTimbreIndex(ship.mmsi);
    const detune = this.getDetune(ship.mmsi);
    const synth = this.synths[timbreIndex];

    // Distance from center affects volume (closer = louder)
    const dx = ship.x - 0.5;
    const dy = ship.y - 0.5;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const volume = Math.max(-24, -8 - distance * 20);

    synth.set({ detune: detune });
    synth.triggerAttackRelease(note, '8n', undefined, Tone.dbToGain(volume));
  }

  getActivePings() {
    return this.recentPings.size;
  }

  // Flush queued ship pings — called on zone change so old-zone pings don't leak
  clearPingQueue() {
    this.pingQueue.length = 0;
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
    this.recentPings.clear();
  }

  // Runtime parameter setters for debug panel
  setReverbDecay(seconds) {
    if (this.reverb) {
      this.reverb.decay = seconds;
    }
  }

  setReverbWet(wet) {
    if (this.reverb) {
      this.reverb.wet.value = wet;
    }
  }

  setMasterVolume(db) {
    if (this.masterVolume) {
      this.masterVolume.volume.value = db;
    }
  }

  setPadVolume(db) {
    if (this.padVolumeA) this.padVolumeA.volume.value = db;
    if (this.padVolumeB) this.padVolumeB.volume.value = db;
  }

  setOceanVolume(db) {
    if (this.oceanVolume) {
      this.oceanVolume.volume.value = db;
    }
  }

  setNoteRelease(seconds) {
    for (const synth of this.synths) {
      // Update the voice defaults for new notes
      synth.options.envelope.release = seconds;
      // Also try to update via set (may affect active voices)
      synth.set({ envelope: { release: seconds } });
    }
    // Store for reference
    this.noteRelease = seconds;
  }

  setFilterFreq(freq) {
    for (const filter of this.filters) {
      filter.frequency.value = freq;
    }
  }

  setOceanLfoFreq(freq) {
    if (this.oceanLFO) {
      this.oceanLFO.frequency.value = freq;
    }
  }

  setPadFilterFreq(freq) {
    if (this.padFilterA) this.padFilterA.frequency.value = freq;
    if (this.padFilterB) this.padFilterB.frequency.value = freq;
  }

  setModeTransitionTime(seconds) {
    // Clear existing interval and restart with new timing
    if (this.modeTransitionInterval) {
      clearInterval(this.modeTransitionInterval);
    }
    this.modeTransitionTime = seconds;
    this.modeTransitionInterval = setInterval(() => {
      this.crossfadeToNextMode();
    }, seconds * 1000);
  }

  setChordCycleTime(seconds) {
    // Clear existing interval and restart with new timing
    if (this.padInterval) {
      clearInterval(this.padInterval);
    }
    this.chordCycleTime = seconds;
    this.padInterval = setInterval(() => {
      const activeSynth = this.activePad === 'A' ? this.padSynthA : this.padSynthB;
      activeSynth.releaseAll();
      const chords = MODES[this.currentModeIndex].chords;
      this.currentChordIndex = (this.currentChordIndex + 1) % chords.length;
      setTimeout(() => this.playChordOnPad(this.activePad, this.currentChordIndex), 500);
    }, seconds * 1000);
  }

  // Apply a zone's audio preset with smooth transitions
  applyZonePreset(preset, transitionTime = 4) {
    if (!this.isStarted) {
      // Store for when audio starts
      this.pendingPreset = preset;
      return;
    }

    console.log('Applying zone audio preset:', preset);

    // Reverb
    if (preset.reverbDecay !== undefined) {
      this.reverb.decay = preset.reverbDecay;
    }
    if (preset.reverbWet !== undefined) {
      this.reverb.wet.rampTo(preset.reverbWet, transitionTime);
    }

    // Note characteristics
    if (preset.noteRelease !== undefined) {
      this.setNoteRelease(preset.noteRelease);
    }
    if (preset.filterFreq !== undefined) {
      for (const filter of this.filters) {
        filter.frequency.rampTo(preset.filterFreq, transitionTime);
      }
    }

    // Pad characteristics - ramp the currently active pad
    if (preset.padVolume !== undefined) {
      const activeVolume = this.activePad === 'A' ? this.padVolumeA : this.padVolumeB;
      if (activeVolume) activeVolume.volume.rampTo(preset.padVolume, transitionTime);
    }
    if (preset.padFilterFreq !== undefined) {
      if (this.padFilterA) this.padFilterA.frequency.rampTo(preset.padFilterFreq, transitionTime);
      if (this.padFilterB) this.padFilterB.frequency.rampTo(preset.padFilterFreq, transitionTime);
    }

    // Ocean ambience
    if (preset.oceanVolume !== undefined) {
      this.oceanVolume?.volume.rampTo(preset.oceanVolume, transitionTime);
    }
    if (preset.oceanLfoFreq !== undefined) {
      this.oceanLFO?.frequency.rampTo(preset.oceanLfoFreq, transitionTime);
    }

    // Timing parameters (applied immediately, not ramped)
    if (preset.modeTransitionTime !== undefined) {
      this.setModeTransitionTime(preset.modeTransitionTime);
    }
    if (preset.chordCycleTime !== undefined) {
      this.setChordCycleTime(preset.chordCycleTime);
    }
  }

  dispose() {
    if (this.padInterval) clearInterval(this.padInterval);
    if (this.modeTransitionInterval) clearInterval(this.modeTransitionInterval);
    if (this.padSynthA) this.padSynthA.dispose();
    if (this.padFilterA) this.padFilterA.dispose();
    if (this.padVolumeA) this.padVolumeA.dispose();
    if (this.padSynthB) this.padSynthB.dispose();
    if (this.padFilterB) this.padFilterB.dispose();
    if (this.padVolumeB) this.padVolumeB.dispose();
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
