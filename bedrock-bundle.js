/**
 * Bedrock Pattern Finder - Browser Bundle
 * Todas las clases en un solo archivo para uso en navegador
 */

// ============================================================================
// MathHelper - Utilidades matemáticas
// ============================================================================
const MathHelper = {
    getLerpProgress(value, start, end) {
        return (value - start) / (end - start);
    },

    lerp(delta, start, end) {
        return start + delta * (end - start);
    },

    lerpFromProgress(lerpValue, lerpStart, lerpEnd, start, end) {
        return this.lerp(this.getLerpProgress(lerpValue, lerpStart, lerpEnd), start, end);
    },

    square(n) {
        return n * n;
    },

    hashCode(x, y, z) {
        let l = BigInt(x * 3129871) ^ (BigInt(z) * 116129781n) ^ BigInt(y);
        l = l * l * 42317861n + l * 11n;
        return l >> 16n;
    }
};

// ============================================================================
// GaussianGenerator - Generador de números gaussianos
// ============================================================================
class GaussianGenerator {
    constructor(baseRandom) {
        this.baseRandom = baseRandom;
        this.nextNextGaussian = 0;
        this.hasNextGaussian = false;
    }

    reset() {
        this.hasNextGaussian = false;
    }

    next() {
        if (this.hasNextGaussian) {
            this.hasNextGaussian = false;
            return this.nextNextGaussian;
        }

        let d, e, f;
        do {
            d = 2.0 * this.baseRandom.nextDouble() - 1.0;
            e = 2.0 * this.baseRandom.nextDouble() - 1.0;
            f = MathHelper.square(d) + MathHelper.square(e);
        } while (f >= 1.0 || f === 0.0);

        const g = Math.sqrt(-2.0 * Math.log(f) / f);
        this.nextNextGaussian = e * g;
        this.hasNextGaussian = true;
        return d * g;
    }
}

// ============================================================================
// RandomSeed - Generación de semillas
// ============================================================================
const RandomSeed = {
    nextSplitMix64Int(seed) {
        seed = BigInt(seed);
        seed = (seed ^ (seed >> 30n)) * -4658895280553007687n;
        seed = (seed ^ (seed >> 27n)) * -7723592293110705685n;
        seed = seed ^ (seed >> 31n);
        return BigInt.asUintN(64, seed);
    },

    createXoroshiroSeed(seed) {
        seed = BigInt(seed);
        const l = seed ^ 0x6A09E667F3BCC909n;
        const m = BigInt.asUintN(64, l + -7046029254386353131n);
        
        return {
            seedLo: this.nextSplitMix64Int(l),
            seedHi: this.nextSplitMix64Int(m)
        };
    }
};

// ============================================================================
// Xoroshiro128PlusPlusRandomImpl - Motor RNG
// ============================================================================
class Xoroshiro128PlusPlusRandomImpl {
    constructor(seedLo, seedHi) {
        this.seedLo = BigInt(seedLo);
        this.seedHi = BigInt(seedHi);

        if ((this.seedLo | this.seedHi) === 0n) {
            this.seedLo = -7046029254386353131n;
            this.seedHi = 7640891576956012809n;
        }
    }

    next() {
        const l = this.seedLo;
        const m = this.seedHi;
        
        const sum = this.toUint64(l + m);
        const n = this.toUint64(this.rotateLeft(sum, 17n) + l);

        let mXorL = m ^ l;
        
        this.seedLo = this.toUint64(
            this.rotateLeft(l, 49n) ^ mXorL ^ (mXorL << 21n)
        );
        
        this.seedHi = this.rotateLeft(mXorL, 28n);

        return n;
    }

    rotateLeft(value, distance) {
        value = this.toUint64(value);
        distance = BigInt(distance) & 63n;
        return this.toUint64((value << distance) | (value >> (64n - distance)));
    }

    toUint64(value) {
        return BigInt.asUintN(64, value);
    }
}

// ============================================================================
// Xoroshiro128PlusPlusRandom - Clase principal RNG
// ============================================================================
class Xoroshiro128PlusPlusRandom {
    static FLOAT_MULTIPLIER = 5.9604645e-8;
    static DOUBLE_MULTIPLIER = 1.110223e-16;

    constructor(seedLoOrSeed, seedHi = null) {
        if (seedHi === null) {
            const xoroshiroSeed = RandomSeed.createXoroshiroSeed(seedLoOrSeed);
            this.implementation = new Xoroshiro128PlusPlusRandomImpl(
                xoroshiroSeed.seedLo,
                xoroshiroSeed.seedHi
            );
        } else {
            this.implementation = new Xoroshiro128PlusPlusRandomImpl(seedLoOrSeed, seedHi);
        }
        this.gaussianGenerator = new GaussianGenerator(this);
    }

    derive() {
        return new Xoroshiro128PlusPlusRandom(
            this.implementation.next(),
            this.implementation.next()
        );
    }

    createRandomDeriver() {
        return new RandomDeriver(
            this.implementation.next(),
            this.implementation.next()
        );
    }

    setSeed(seed) {
        const xoroshiroSeed = RandomSeed.createXoroshiroSeed(seed);
        this.implementation = new Xoroshiro128PlusPlusRandomImpl(
            xoroshiroSeed.seedLo,
            xoroshiroSeed.seedHi
        );
        this.gaussianGenerator.reset();
    }

    nextInt(bound = null) {
        if (bound === null) {
            return Number(BigInt.asIntN(32, this.implementation.next()));
        }

        if (bound <= 0) {
            throw new Error('Bound must be positive');
        }

        let l = BigInt.asUintN(32, this.implementation.next() >> 32n);
        let m = l * BigInt(bound);
        let n = BigInt.asUintN(32, m);

        if (n < BigInt(bound)) {
            const notBound = BigInt.asUintN(32, ~BigInt(bound) + 1n);
            const j = notBound % BigInt(bound);
            
            while (n < j) {
                l = BigInt.asUintN(32, this.implementation.next() >> 32n);
                m = l * BigInt(bound);
                n = BigInt.asUintN(32, m);
            }
        }

        const o = m >> 32n;
        return Number(o);
    }

    nextBetween(min, max) {
        return this.nextInt(max - min + 1) + min;
    }

    nextLong() {
        return this.implementation.next();
    }

    nextBoolean() {
        return (this.implementation.next() & 1n) !== 0n;
    }

    nextFloat() {
        return Number(this.next(24)) * Xoroshiro128PlusPlusRandom.FLOAT_MULTIPLIER;
    }

    nextDouble() {
        return Number(this.next(53)) * Xoroshiro128PlusPlusRandom.DOUBLE_MULTIPLIER;
    }

    nextGaussian() {
        return this.gaussianGenerator.next();
    }

    skip(count) {
        for (let i = 0; i < count; i++) {
            this.implementation.next();
        }
    }

    next(bits) {
        return this.implementation.next() >> BigInt(64 - bits);
    }
}

// ============================================================================
// RandomDeriver - Derivador de randoms
// ============================================================================
class RandomDeriver {
    constructor(seedLo, seedHi) {
        this.seedLo = BigInt(seedLo);
        this.seedHi = BigInt(seedHi);
    }

    createRandom(xOrString, y = null, z = null) {
        if (typeof xOrString === 'string') {
            return this.createRandomFromString(xOrString);
        } else {
            return this.createRandomFromCoords(xOrString, y, z);
        }
    }

    createRandomFromCoords(x, y, z) {
        const l = MathHelper.hashCode(x, y, z);
        const m = l ^ this.seedLo;
        return new Xoroshiro128PlusPlusRandom(m, this.seedHi);
    }

    createRandomFromString(string) {
        // Implementación simple de MD5 usando SubtleCrypto sería async
        // Por ahora, usar un hash simple para strings
        const hash = this.simpleHash(string);
        const l = hash.l ^ this.seedLo;
        const m = hash.h ^ this.seedHi;
        return new Xoroshiro128PlusPlusRandom(l, m);
    }

    simpleHash(str) {
        // Hash simple pero determinista para strings
        let h1 = 0xdeadbeefn;
        let h2 = 0x41c64e6dn;
        
        for (let i = 0; i < str.length; i++) {
            const ch = BigInt(str.charCodeAt(i));
            h1 = BigInt.asUintN(64, h1 ^ ch);
            h1 = BigInt.asUintN(64, h1 * 2654435761n);
            h2 = BigInt.asUintN(64, h2 ^ ch);
            h2 = BigInt.asUintN(64, h2 * 1597334677n);
        }
        
        return { l: h1, h: h2 };
    }
}

// ============================================================================
// BedrockType - Tipos de bedrock
// ============================================================================
const BedrockType = {
    BEDROCK_FLOOR: {
        id: 'minecraft:bedrock_floor',
        min: -64,
        max: -59
    },
    BEDROCK_ROOF: {
        id: 'minecraft:bedrock_roof',
        min: 128,
        max: 123
    }
};

// ============================================================================
// BedrockReader - Lector de bedrock
// ============================================================================
class BedrockReader {
    constructor(seed) {
        seed = BigInt(seed);
        
        const mainRandomFloor = new Xoroshiro128PlusPlusRandom(seed);
        const floorDeriver1 = mainRandomFloor.createRandomDeriver();
        const floorRandom = floorDeriver1.createRandom(BedrockType.BEDROCK_FLOOR.id);
        this.floorRandomDeriver = floorRandom.createRandomDeriver();
        
        const mainRandomRoof = new Xoroshiro128PlusPlusRandom(seed);
        const roofDeriver1 = mainRandomRoof.createRandomDeriver();
        const roofRandom = roofDeriver1.createRandom(BedrockType.BEDROCK_ROOF.id);
        this.roofRandomDeriver = roofRandom.createRandomDeriver();
    }

    isBedrock(x, y, z) {
        let probabilityValue = 0;

        const bedrockType = y < 0 ? BedrockType.BEDROCK_FLOOR : BedrockType.BEDROCK_ROOF;

        if (bedrockType === BedrockType.BEDROCK_FLOOR) {
            if (y === bedrockType.min) return true;
            if (y > bedrockType.max) return false;

            probabilityValue = MathHelper.lerpFromProgress(
                y,
                bedrockType.min,
                bedrockType.max,
                1.0,
                0.0
            );
        } else {
            if (y === bedrockType.min) return true;
            if (y < bedrockType.max) return false;

            probabilityValue = MathHelper.lerpFromProgress(
                y,
                bedrockType.max,
                bedrockType.min,
                1.0,
                0.0
            );
        }

        const randomDeriver = bedrockType === BedrockType.BEDROCK_FLOOR
            ? this.floorRandomDeriver
            : this.roofRandomDeriver;

        const abstractRandom = randomDeriver.createRandom(x, y, z);

        return abstractRandom.nextFloat() < probabilityValue;
    }
}

// Exponer las clases globalmente para uso en el navegador
if (typeof window !== 'undefined') {
    window.BedrockReader = BedrockReader;
    window.MathHelper = MathHelper;
}
