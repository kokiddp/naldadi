const UINT32_RANGE = 0x1_0000_0000;
const RANDOM_POOL_SIZE = 1024;

interface RandomSource {
  nextUint32(): number;
  nextFloat(): number;
}

class MathRandomSource implements RandomSource {
  nextUint32(): number {
    return Math.floor(Math.random() * UINT32_RANGE);
  }

  nextFloat(): number {
    return Math.random();
  }
}

class CryptoRandomSource implements RandomSource {
  private readonly pool = new Uint32Array(RANDOM_POOL_SIZE);
  private index = RANDOM_POOL_SIZE;

  nextUint32(): number {
    if (this.index >= this.pool.length) {
      globalThis.crypto.getRandomValues(this.pool);
      this.index = 0;
    }

    const value = this.pool[this.index] ?? 0;
    this.index += 1;
    return value;
  }

  nextFloat(): number {
    return this.nextUint32() / UINT32_RANGE;
  }
}

class Sfc32RandomSource implements RandomSource {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seedA: number, seedB: number, seedC: number, seedD: number) {
    this.a = seedA >>> 0;
    this.b = seedB >>> 0;
    this.c = seedC >>> 0;
    this.d = seedD >>> 0;
  }

  nextUint32(): number {
    // sfc32: fast, good-quality PRNG for simulation throughput.
    const t = (this.a + this.b + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  nextFloat(): number {
    return this.nextUint32() / UINT32_RANGE;
  }
}

function hasCryptoRandom(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.crypto?.getRandomValues === 'function';
}

function createRandomSource(): RandomSource {
  return hasCryptoRandom() ? new CryptoRandomSource() : new MathRandomSource();
}

function createSimulationRandomSource(seedSource: RandomSource): RandomSource {
  const seedA = seedSource.nextUint32();
  const seedB = seedSource.nextUint32();
  const seedC = seedSource.nextUint32();
  const seedD = seedSource.nextUint32();
  return new Sfc32RandomSource(seedA, seedB, seedC, seedD);
}

const defaultRandomSource = createRandomSource();
const defaultSimulationSource = createSimulationRandomSource(defaultRandomSource);

export function defaultRandomFloat(): number {
  return defaultRandomSource.nextFloat();
}

export function defaultSimulationRandomFloat(): number {
  return defaultSimulationSource.nextFloat();
}

export function rollDieUnbiased(sides: number): number {
  if (!Number.isInteger(sides) || sides <= 0) {
    throw new Error('Die sides must be a positive integer.');
  }

  const limit = UINT32_RANGE - (UINT32_RANGE % sides);

  let value = defaultRandomSource.nextUint32();
  while (value >= limit) {
    value = defaultRandomSource.nextUint32();
  }

  return (value % sides) + 1;
}

export function rollDieWithRng(sides: number, rng: () => number): number {
  return Math.floor(rng() * sides) + 1;
}
