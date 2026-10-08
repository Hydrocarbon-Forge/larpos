// app/prng.js — Pure seeded PRNG with Mulberry32 and seed normalization

function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function normalizeSeed(seed) {
  if (seed === undefined || seed === null || seed === '') {
    return ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  }
  if (typeof seed === 'number') {
    return seed >>> 0;
  }
  if (typeof seed === 'string') {
    const trimmed = seed.trim();
    if (/^0x[0-9a-fA-F]+$/i.test(trimmed)) {
      return parseInt(trimmed, 16) >>> 0;
    }
    if (/^\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10) >>> 0;
    }
    return hashString(trimmed);
  }
  return hashString(String(seed));
}

class PRNG {
  constructor(seed) {
    this.rawSeed = seed;
    this.seedInt = normalizeSeed(seed);
    this.hexSeed = '0x' + this.seedInt.toString(16).padStart(8, '0');
    this.state = this.seedInt;
  }

  next() {
    let t = (this.state += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(this.next() * arr.length)];
  }

  sample(arr, count) {
    const pool = arr.slice();
    const res = [];
    const n = Math.min(count, pool.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this.next() * pool.length);
      res.push(pool.splice(idx, 1)[0]);
    }
    return res;
  }

  shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  chance(p) {
    return this.next() < p;
  }
}

module.exports = {
  PRNG,
  normalizeSeed,
  hashString,
  fnv1a: hashString
};
