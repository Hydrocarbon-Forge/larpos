// app/banks/sounds.js — Synthesized sound cues bank for LarpOS
// Generates tiny standalone base64 WAV data URIs using zero dependencies

function buildWavDataUri(sampleRate, samples) {
  const numSamples = samples.length;
  const buffer = new Uint8Array(44 + numSamples);

  // 1. RIFF Header
  buffer[0] = 0x52; buffer[1] = 0x49; buffer[2] = 0x46; buffer[3] = 0x46; // "RIFF"
  const fileSize = 36 + numSamples;
  buffer[4] = fileSize & 0xff;
  buffer[5] = (fileSize >> 8) & 0xff;
  buffer[6] = (fileSize >> 16) & 0xff;
  buffer[7] = (fileSize >> 24) & 0xff;
  buffer[8] = 0x57; buffer[9] = 0x41; buffer[10] = 0x56; buffer[11] = 0x45; // "WAVE"

  // 2. "fmt " Subchunk
  buffer[12] = 0x66; buffer[13] = 0x6d; buffer[14] = 0x74; buffer[15] = 0x20; // "fmt "
  buffer[16] = 16; buffer[17] = 0; buffer[18] = 0; buffer[19] = 0; // Subchunk1Size = 16
  buffer[20] = 1; buffer[21] = 0; // AudioFormat = 1 (PCM)
  buffer[22] = 1; buffer[23] = 0; // NumChannels = 1 (Mono)
  buffer[24] = sampleRate & 0xff;
  buffer[25] = (sampleRate >> 8) & 0xff;
  buffer[26] = (sampleRate >> 16) & 0xff;
  buffer[27] = (sampleRate >> 24) & 0xff;
  const byteRate = sampleRate; // 8-bit mono => byteRate == sampleRate
  buffer[28] = byteRate & 0xff;
  buffer[29] = (byteRate >> 8) & 0xff;
  buffer[30] = (byteRate >> 16) & 0xff;
  buffer[31] = (byteRate >> 24) & 0xff;
  buffer[32] = 1; buffer[33] = 0; // BlockAlign = 1
  buffer[34] = 8; buffer[35] = 0; // BitsPerSample = 8

  // 3. "data" Subchunk
  buffer[36] = 0x64; buffer[37] = 0x61; buffer[38] = 0x74; buffer[39] = 0x61; // "data"
  buffer[40] = numSamples & 0xff;
  buffer[41] = (numSamples >> 8) & 0xff;
  buffer[42] = (numSamples >> 16) & 0xff;
  buffer[43] = (numSamples >> 24) & 0xff;

  // 4. Sample Bytes (0..255, 128 is center)
  for (let i = 0; i < numSamples; i++) {
    buffer[44 + i] = samples[i];
  }

  // Base64 conversion (Node.js Buffer or browser btoa fallback)
  let base64;
  if (typeof Buffer !== 'undefined') {
    base64 = Buffer.from(buffer).toString('base64');
  } else {
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    base64 = window.btoa(binary);
  }

  return `data:audio/wav;base64,${base64}`;
}

function synthesizeCue(type, options = {}) {
  const sampleRate = options.sampleRate || 8000;
  const pitchMult = options.pitch || 1.0;

  if (type === 'click') {
    // Sharp click transient (0.02s)
    const len = Math.round(sampleRate * 0.02);
    const samples = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 220);
      const val = Math.sin(2 * Math.PI * 1800 * pitchMult * t) * env;
      samples[i] = 128 + Math.round(val * 120);
    }
    return buildWavDataUri(sampleRate, samples);
  }

  if (type === 'boot') {
    // 3-note harmonic arpeggio (0.24s)
    const len = Math.round(sampleRate * 0.24);
    const samples = new Uint8Array(len);
    const freqs = [220 * pitchMult, 330 * pitchMult, 440 * pitchMult];
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const noteIdx = Math.min(2, Math.floor(t / 0.08));
      const f = freqs[noteIdx];
      const env = Math.exp(-(t % 0.08) * 18);
      const val = Math.sin(2 * Math.PI * f * t) * env;
      samples[i] = 128 + Math.round(val * 110);
    }
    return buildWavDataUri(sampleRate, samples);
  }

  if (type === 'open') {
    // Upward pitch swell (0.09s)
    const len = Math.round(sampleRate * 0.09);
    const samples = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const f = (320 + 400 * (t / 0.09)) * pitchMult;
      const env = Math.sin(Math.PI * (t / 0.09));
      const val = Math.sin(2 * Math.PI * f * t) * env;
      samples[i] = 128 + Math.round(val * 115);
    }
    return buildWavDataUri(sampleRate, samples);
  }

  if (type === 'error') {
    // Dissonant low buzz (0.16s)
    const len = Math.round(sampleRate * 0.16);
    const samples = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 12);
      const s1 = Math.sin(2 * Math.PI * 140 * pitchMult * t);
      const s2 = Math.sin(2 * Math.PI * 192 * pitchMult * t);
      const val = (s1 + s2) * 0.5 * env;
      samples[i] = 128 + Math.round(val * 110);
    }
    return buildWavDataUri(sampleRate, samples);
  }

  if (type === 'alarm') {
    // Double high beep (0.18s)
    const len = Math.round(sampleRate * 0.18);
    const samples = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const pulse = Math.sin(2 * Math.PI * 12 * t) > 0 ? 1 : 0;
      const env = Math.exp(-(t % 0.09) * 20) * pulse;
      const val = Math.sin(2 * Math.PI * 880 * pitchMult * t) * env;
      samples[i] = 128 + Math.round(val * 110);
    }
    return buildWavDataUri(sampleRate, samples);
  }

  // Generic parametric blip
  const len = Math.round(sampleRate * 0.05);
  const samples = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const val = Math.sin(2 * Math.PI * 440 * pitchMult * t) * Math.exp(-t * 40);
    samples[i] = 128 + Math.round(val * 110);
  }
  return buildWavDataUri(sampleRate, samples);
}

function selectSoundsForWorld(paradigm, seed = 1) {
  // A tui world pulls none (per spec §11)
  if (paradigm === 'tui') {
    return {
      cues: {},
      names: []
    };
  }

  const cues = {
    boot: synthesizeCue('boot'),
    click: synthesizeCue('click'),
    open: synthesizeCue('open'),
    error: synthesizeCue('error')
  };

  if (paradigm === 'device') {
    cues.alarm = synthesizeCue('alarm');
  }

  return {
    cues,
    names: Object.keys(cues)
  };
}

module.exports = {
  synthesizeCue,
  selectSoundsForWorld
};
