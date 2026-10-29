/** Small synthesised effects: no external audio files or network requests. */
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  volume = 0.5;
  init() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume * 0.32;
        this.master.connect(this.context.destination);
      }
      void this.context.resume();
    } catch {
      /* The game remains playable if audio is unavailable. */
    }
  }
  setVolume(value: number) {
    this.volume = value;
    if (this.master) this.master.gain.value = value * 0.32;
  }
  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    gain = 0.5,
    endFrequency = frequency
  ) {
    const c = this.context;
    if (!c || !this.master) return;
    const oscillator = c.createOscillator(),
      envelope = c.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, c.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      c.currentTime + duration
    );
    envelope.gain.setValueAtTime(gain, c.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start();
    oscillator.stop(c.currentTime + duration);
  }
  private noise(duration: number, gain = 0.7) {
    const c = this.context;
    if (!c || !this.master) return;
    const buffer = c.createBuffer(1, c.sampleRate * duration, c.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      envelope = c.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 2500;
    envelope.gain.value = gain;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start();
  }
  shoot() {
    this.noise(0.13, 1);
    this.tone(145, 0.16, "triangle", 0.85, 38);
    this.tone(950, 0.035, "square", 0.12, 180);
  }
  quack() {
    this.tone(420, 0.12, "sawtooth", 0.18, 270);
    this.tone(650, 0.09, "triangle", 0.11, 370);
  }
  enemyShot() {
    this.tone(510, 0.22, "sawtooth", 0.16, 100);
  }
  hit() {
    this.noise(0.1, 0.25);
    this.tone(240, 0.07, "triangle", 0.2, 90);
  }
  hurt() {
    this.noise(0.21, 0.5);
    this.tone(90, 0.18, "sawtooth", 0.4, 35);
  }
  pickup() {
    this.tone(700, 0.12, "sine", 0.4, 1100);
    setTimeout(() => this.tone(1100, 0.2, "sine", 0.3, 1500), 90);
  }
  reload() {
    this.noise(0.065, 0.2);
    this.tone(160, 0.07, "square", 0.12, 240);
  }
  door() {
    this.noise(0.4, 0.2);
    this.tone(75, 0.45, "triangle", 0.25, 110);
  }
  footstep() {
    this.noise(0.045, 0.12);
  }
  empty() {
    this.tone(220, 0.03, "square", 0.08, 100);
  }
  win() {
    [440, 554, 659, 880].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.5, "triangle", 0.3), i * 130)
    );
  }
}
