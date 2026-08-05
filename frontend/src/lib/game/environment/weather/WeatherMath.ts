/** Sanitizes a frame delta before it enters the deterministic scheduler. */
export function safeWeatherDelta(value: number): number {
	return Number.isFinite(value) && value > 0 ? value : 0;
}

export function clampWeather01(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.min(1, Math.max(0, value));
}

/** Stable uint32 mixer used as a stateless deterministic random source. */
export function mixWeatherSeed(seed: number, index: number, salt: number): number {
	let value = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ salt) >>> 0;
	value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0;
	value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0;

	return (value ^ (value >>> 15)) >>> 0;
}

/** Deterministic number in [0, 1), with no mutable PRNG state. */
export function weatherRandomUnit(seed: number, index: number, salt: number): number {
	return mixWeatherSeed(seed, index, salt) / 0x100000000;
}

export function weatherRandomRange(
	minimum: number,
	maximum: number,
	seed: number,
	index: number,
	salt: number
): number {
	return minimum + (maximum - minimum) * weatherRandomUnit(seed, index, salt);
}

export function chooseWeightedIndex(weights: readonly number[], unit: number): number {
	let total = 0;

	for (const weight of weights) {
		total += Math.max(0, Number.isFinite(weight) ? weight : 0);
	}

	if (total <= Number.EPSILON) {
		return 0;
	}

	let cursor = clampWeather01(unit) * total;

	for (let index = 0; index < weights.length; index += 1) {
		cursor -= Math.max(0, Number.isFinite(weights[index]) ? weights[index] : 0);

		if (cursor <= 0) {
			return index;
		}
	}

	return Math.max(0, weights.length - 1);
}
