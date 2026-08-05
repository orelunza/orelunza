/**
 * Deterministic numeric helpers shared across the environment system.
 *
 * Everything here is pure and allocation-free so it can be called from the
 * game loop without producing per-frame garbage. The random generators are
 * seedable and reproducible: the same seed always yields the same sequence,
 * which is what lets the sky, stars and (later) weather be deterministic.
 */

/** Two times PI, cached to avoid recomputation in hot paths. */
export const TWO_PI = Math.PI * 2;

/** Clamps a value into the inclusive [minimum, maximum] range. */
export function clamp(value: number, minimum: number, maximum: number): number {
	if (value < minimum) {
		return minimum;
	}

	if (value > maximum) {
		return maximum;
	}

	return value;
}

/** Clamps a value into [0, 1]. */
export function clamp01(value: number): number {
	return clamp(value, 0, 1);
}

/** Linear interpolation between a and b by t (t is not clamped). */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * Smoothstep easing between edge0 and edge1.
 *
 * Returns 0 below edge0, 1 above edge1, and a smooth Hermite curve between.
 */
export function smoothstep(edge0: number, edge1: number, value: number): number {
	if (edge0 === edge1) {
		return value < edge0 ? 0 : 1;
	}

	const t = clamp01((value - edge0) / (edge1 - edge0));

	return t * t * (3 - 2 * t);
}

/**
 * Wraps a value into the half-open range [0, range).
 *
 * Used to keep the world clock's time-of-day continuous when it crosses
 * midnight, without ever producing a negative or overflowing value.
 */
export function wrap01Range(value: number, range: number): number {
	if (range <= 0) {
		return 0;
	}

	const wrapped = value % range;

	return wrapped < 0 ? wrapped + range : wrapped;
}

/**
 * Hashes a 32-bit unsigned integer to a well-distributed 32-bit unsigned
 * integer. This is the integer finalizer from the MurmurHash3 family.
 */
export function hashUint32(value: number): number {
	let hash = value >>> 0;
	hash ^= hash >>> 16;
	hash = Math.imul(hash, 0x85ebca6b);
	hash ^= hash >>> 13;
	hash = Math.imul(hash, 0xc2b2ae35);
	hash ^= hash >>> 16;

	return hash >>> 0;
}

/**
 * Combines a string seed into a stable 32-bit unsigned integer.
 *
 * The world seed is a string; several subsystems need an integer derived from
 * it. This mirrors the FNV-1a hash so the same string always maps to the same
 * integer across sessions and machines.
 */
export function hashStringToUint32(value: string): number {
	let hash = 0x811c9dc5;

	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return hash >>> 0;
}

/**
 * A small, fast, deterministic pseudo-random generator (Mulberry32).
 *
 * It holds a single 32-bit state word and produces floats in [0, 1). It is
 * intentionally simple and allocation-free once constructed, so it is safe to
 * seed once and reuse. Different subsystems seed their own instances so their
 * sequences never interfere with each other.
 */
export class DeterministicRandom {
	private state: number;

	constructor(seed: number) {
		this.state = seed >>> 0;
	}

	/** Reseeds the generator, discarding any previous progress. */
	reseed(seed: number): void {
		this.state = seed >>> 0;
	}

	/** Returns the next float in [0, 1). */
	next(): number {
		this.state = (this.state + 0x6d2b79f5) >>> 0;
		let t = this.state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	/** Returns the next float in [minimum, maximum). */
	range(minimum: number, maximum: number): number {
		return minimum + (maximum - minimum) * this.next();
	}
}
