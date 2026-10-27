/* Microphone capture for the voice button: turns whatever rate the browser records at (usually 48 kHz) into 16 kHz mono 16-bit PCM,
   posted to the page in 20 ms pieces (320 samples). Runs on the audio thread, so it does nothing else.
   Before dropping to 16 kHz everything above ~7 kHz is filtered out (a 63-tap windowed-sinc low-pass): without it, hiss and fan noise
   above 8 kHz fold down into the speech band and the recognizer hears it as part of the words. */
class MicCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / 16000;      // input samples per output sample
    this.pos = 0;
    const N = 63, fc = 7000 / sampleRate, mid = (N - 1) / 2;
    this.taps = new Float32Array(N);
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const x = i - mid;
      const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
      const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (N - 1));   // Blackman window
      this.taps[i] = sinc * w; sum += this.taps[i];
    }
    for (let i = 0; i < N; i++) this.taps[i] /= sum;      // unity gain at low frequencies
    this.hist = new Float32Array(N); this.h = 0;           // ring buffer of the last N input samples
    this.out = new Int16Array(320); this.k = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    const N = this.taps.length;
    for (let i = 0; i < ch.length; i++) {
      this.hist[this.h] = ch[i]; this.h = (this.h + 1) % N;
      if (++this.pos >= this.step) {     // time for one output sample: the filtered value at this point
        this.pos -= this.step;
        let acc = 0;
        for (let j = 0, r = this.h; j < N; j++, r = (r + 1) % N) acc += this.taps[j] * this.hist[r];
        const v = Math.max(-1, Math.min(1, acc));
        this.out[this.k++] = v < 0 ? v * 32768 : v * 32767;
        if (this.k === 320) { this.port.postMessage(this.out.buffer.slice(0)); this.k = 0; }
      }
    }
    return true;
  }
}
registerProcessor("mic-capture", MicCapture);
