import { describe, expect, it } from 'vitest';
import type { LocalWaterForcing } from './LocalWaterState';
import { classifyNaturalWaterBody, erosionPotential, stepSnowpack } from './NaturalWaterCycle';

const COLD_SNOW: LocalWaterForcing = {
	rainIntensity: 0,
	snowIntensity: 1,
	rainShelter: 0,
	precipitationType: 'snow',
	temperatureCelsius: -8,
	humidity: 0.8,
	daylight: 0.2,
	windStrength: 0.2
};

describe('NaturalWaterCycle', () => {
	it('stores snowfall as water equivalent without creating liquid water', () => {
		const result = stepSnowpack(0, 10, COLD_SNOW);
		expect(result.snowfallAdded).toBeGreaterThan(0);
		expect(result.meltReleased).toBe(0);
		expect(result.snowWaterEquivalent).toBeCloseTo(result.snowfallAdded, 12);
	});

	it('releases stored snow as meltwater while conserving the phase-change budget', () => {
		const initial = stepSnowpack(0, 10, COLD_SNOW);
		const warm: LocalWaterForcing = {
			...COLD_SNOW,
			snowIntensity: 0,
			precipitationType: 'none',
			temperatureCelsius: 12,
			daylight: 1
		};
		const melted = stepSnowpack(initial.snowWaterEquivalent, 30, warm);
		expect(melted.meltReleased).toBeGreaterThan(0);
		expect(melted.snowWaterEquivalent + melted.meltReleased).toBeCloseTo(
			initial.snowWaterEquivalent,
			12
		);
	});

	it('classifies the natural river, lake and ocean reservoirs', () => {
		expect(classifyNaturalWaterBody('Planet River', 1)).toBe('river');
		expect(classifyNaturalWaterBody('Planet Lake', 2)).toBe('lake');
		expect(classifyNaturalWaterBody('Planet Ocean', 30)).toBe('ocean');
		expect(classifyNaturalWaterBody('Tropical Rainforest', 0)).toBe('land');
	});

	it('exposes a bounded erosion signal without modifying terrain', () => {
		expect(erosionPotential(0, 0, 0)).toBe(0);
		const active = erosionPotential(0.6, 1.1, 0.5);
		expect(active).toBeGreaterThan(0);
		expect(active).toBeLessThanOrEqual(1);
		expect(Number.isFinite(active)).toBe(true);
	});
});
