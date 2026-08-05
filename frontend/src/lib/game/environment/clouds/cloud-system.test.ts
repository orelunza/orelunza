import { describe, expect, test } from 'vitest';
import { getWeatherPreset } from '../weather/WeatherPreset';
import { WindSystem } from '../wind/WindSystem';
import { CloudSystem } from './CloudSystem';

function sample(kind: 'clear' | 'partly_cloudy' | 'overcast' | 'storm') {
	const wind = new WindSystem({ seed: 123 });
	wind.update(12, getWeatherPreset(kind).parameters.windStrength);
	const clouds = new CloudSystem();
	clouds.update(getWeatherPreset(kind).parameters, wind.currentState, 12);

	return { ...clouds.currentState };
}

describe('procedural cloud state', () => {
	test('clear, partly cloudy and overcast produce increasing cloud presence', () => {
		const clear = sample('clear');
		const partial = sample('partly_cloudy');
		const overcast = sample('overcast');

		expect(clear.coverage).toBeLessThan(partial.coverage);
		expect(partial.coverage).toBeLessThan(overcast.coverage);
		expect(clear.opacity).toBeLessThan(partial.opacity);
		expect(partial.opacity).toBeLessThan(overcast.opacity);
		expect(overcast.sunOcclusion).toBeGreaterThan(clear.sunOcclusion);
	});

	test('storm clouds strongly occlude celestial light without leaving bounds', () => {
		const storm = sample('storm');

		for (const value of [
			storm.coverage,
			storm.density,
			storm.darkness,
			storm.opacity,
			storm.sunOcclusion,
			storm.moonOcclusion,
			storm.shadowStrength
		]) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}

		expect(storm.sunOcclusion).toBeGreaterThan(0.8);
	});

	test('cloud drift follows the unified wind vector', () => {
		const wind = new WindSystem({ seed: 88 });
		wind.update(20, 0.7);
		const clouds = new CloudSystem();
		const before = clouds.serialize();
		clouds.update(getWeatherPreset('overcast').parameters, wind.currentState, 10);
		const after = clouds.serialize();

		expect(after.windOffsetX).not.toBe(before.windOffsetX);
		expect(after.windOffsetZ).not.toBe(before.windOffsetZ);
		expect(Number.isFinite(after.windOffsetX)).toBe(true);
		expect(Number.isFinite(after.windOffsetZ)).toBe(true);
	});

	test('serializes and restores procedural drift', () => {
		const wind = new WindSystem({ seed: 77 });
		wind.update(45, 0.5);
		const original = new CloudSystem();
		original.update(getWeatherPreset('partly_cloudy').parameters, wind.currentState, 45);
		const save = original.serialize();

		const restored = new CloudSystem();
		restored.restore(save);
		expect(restored.serialize()).toEqual(save);
	});

	test('ignores invalid deltas without corrupting drift', () => {
		const wind = new WindSystem({ seed: 4 });
		const clouds = new CloudSystem();
		const weather = getWeatherPreset('partly_cloudy').parameters;
		const before = clouds.serialize();

		clouds.update(weather, wind.currentState, Number.NaN);
		clouds.update(weather, wind.currentState, -5);

		expect(clouds.serialize()).toEqual(before);
	});
});
