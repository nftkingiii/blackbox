const AUDIO_KEY = "blackbox:audio";

class BlackBoxAudio {
  constructor() {
    const saved = this.readSettings();
    this.musicEnabled = saved.musicEnabled;
    this.effectsEnabled = saved.effectsEnabled;
    this.context = null;
    this.musicBus = null;
    this.effectsBus = null;
    this.ambientNodes = [];
  }

  readSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(AUDIO_KEY) || "{}");
      return {
        musicEnabled: saved.musicEnabled !== false,
        effectsEnabled: saved.effectsEnabled !== false
      };
    } catch {
      return { musicEnabled: true, effectsEnabled: true };
    }
  }

  saveSettings() {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({
      musicEnabled: this.musicEnabled,
      effectsEnabled: this.effectsEnabled
    }));
  }

  async unlock() {
    if (!this.context) this.createContext();
    if (!this.context) return;
    if (this.context.state === "suspended") await this.context.resume();
    if (this.musicEnabled) this.startAmbient();
  }

  createContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.musicBus = this.context.createGain();
    this.effectsBus = this.context.createGain();
    this.musicBus.gain.value = this.musicEnabled ? 0.055 : 0;
    this.effectsBus.gain.value = this.effectsEnabled ? 0.16 : 0;
    this.musicBus.connect(this.context.destination);
    this.effectsBus.connect(this.context.destination);
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    this.saveSettings();
    if (!this.context) return this.musicEnabled;
    this.musicBus.gain.setTargetAtTime(this.musicEnabled ? 0.055 : 0, this.context.currentTime, 0.08);
    if (this.musicEnabled) this.startAmbient();
    return this.musicEnabled;
  }

  toggleEffects() {
    this.effectsEnabled = !this.effectsEnabled;
    this.saveSettings();
    if (this.effectsBus && this.context) {
      this.effectsBus.gain.setTargetAtTime(this.effectsEnabled ? 0.16 : 0, this.context.currentTime, 0.03);
    }
    return this.effectsEnabled;
  }

  startAmbient() {
    if (!this.context || this.ambientNodes.length) return;
    const now = this.context.currentTime;
    const low = this.context.createOscillator();
    const high = this.context.createOscillator();
    const lowGain = this.context.createGain();
    const highGain = this.context.createGain();
    const pulse = this.context.createOscillator();
    const pulseGain = this.context.createGain();

    low.type = "sine";
    high.type = "triangle";
    pulse.type = "sine";
    low.frequency.value = 48;
    high.frequency.value = 72;
    pulse.frequency.value = 0.09;
    lowGain.gain.value = 0.5;
    highGain.gain.value = 0.12;
    pulseGain.gain.value = 0.16;

    pulse.connect(pulseGain);
    pulseGain.connect(lowGain.gain);
    low.connect(lowGain);
    high.connect(highGain);
    lowGain.connect(this.musicBus);
    highGain.connect(this.musicBus);
    low.start(now);
    high.start(now);
    pulse.start(now);
    this.ambientNodes = [low, high, pulse, lowGain, highGain, pulseGain];
  }

  cue(name) {
    if (!this.context || !this.effectsEnabled) return;
    const cues = {
      click: [[220, 0.035, "square", 0]],
      boot: [[120, 0.08, "square", 60]],
      clue: [[390, 0.08, "triangle", 140], [620, 0.06, "sine", 0.08]],
      reveal: [[180, 0.07, "square", 260], [520, 0.08, "triangle", 0.06]],
      correct: [[440, 0.08, "square", 220], [660, 0.12, "triangle", 180]],
      wrong: [[150, 0.16, "sawtooth", -45]],
      roundEnd: [[310, 0.1, "triangle", -80]],
      gameOver: [[260, 0.12, "square", 130], [390, 0.14, "triangle", 160], [620, 0.2, "sine", 0]],
      countdown: [[720, 0.035, "square", 0]]
    };
    const sequence = cues[name] || cues.click;
    let offset = 0;
    for (const [frequency, duration, type, glide] of sequence) {
      this.tone(frequency, duration, type, glide, offset);
      offset += Math.max(0.035, duration * 0.62);
    }
  }

  tone(frequency, duration, type, glide = 0, offset = 0) {
    const now = this.context.currentTime + offset;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (glide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + glide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.75, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.effectsBus);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}

export const audio = new BlackBoxAudio();
