import { describe, expect, test } from 'vitest';
import { Vector3 } from 'three';
import { allBiomeClimateProfiles } from './BiomeClimateProfile';
import { ClimateSystem } from './ClimateSystem';
import { WeatherScheduler } from '../weather/WeatherScheduler';
import { WindSystem } from '../wind/WindSystem';
import type { WeatherWorldQuery } from '../weather/WeatherWorldQuery';

function makeWorld(zone: string): WeatherWorldQuery {
	return {
		surfaceHeightAt: () => 9,
		rainOcclusionAt: () => 0,
		climateZoneAt: () => zone
	};
}

function simulate(zone: string, weatherKind: 'clear' | 'heavy_rain' | 'snow', y = 10, time = 0.58) {
	const weather = new WeatherScheduler({ seed: 71, initialWeather: weatherKind });
	weather.forceWeather(weatherKind);
	const wind = new WindSystem({ seed: 72 });
	wind.update(1, weather.currentState.parameters.windStrength);
	const climate = new ClimateSystem();
	climate.update(
		1,
		new Vector3(0, y, 0),
		time,
		weather.currentState,
		wind.currentState,
		makeWorld(zone)
	);
	return climate;
}

describe('climate Lot 3', () => {
	test('defines finite, bounded climate profiles for every production biome', () => {
		for (const profile of allBiomeClimateProfiles()) {
			expect(profile.zone.length).toBeGreaterThan(0);
			expect(Number.isFinite(profile.baseTemperatureCelsius)).toBe(true);
			expect(profile.dailyRangeCelsius).toBeGreaterThan(0);
			expect(profile.humidity).toBeGreaterThanOrEqual(0);
			expect(profile.humidity).toBeLessThanOrEqual(1);
			expect(profile.lapseRateCelsiusPerMeter).toBeGreaterThan(0);
		}
	});

	test('Amazon rainforest is warmer and more humid than Pine Highlands', () => {
		const amazon = simulate('Amazon Rainforest', 'clear');
		const highlands = simulate('Pine Highlands', 'clear');

		expect(amazon.currentState.temperatureCelsius).toBeGreaterThan(
			highlands.currentState.temperatureCelsius
		);
		expect(amazon.currentState.humidity).toBeGreaterThan(highlands.currentState.humidity);
	});

	test('night is colder than afternoon in the same meadow', () => {
		const afternoon = simulate('Spawn Meadow', 'clear', 10, 0.58);
		const night = simulate('Spawn Meadow', 'clear', 10, 0.08);
		expect(night.currentState.temperatureCelsius).toBeLessThan(
			afternoon.currentState.temperatureCelsius
		);
	});

	test('altitude lowers temperature without changing the selected zone', () => {
		const low = simulate('Pine Highlands', 'clear', 10);
		const high = simulate('Pine Highlands', 'clear', 45);
		expect(high.currentState.zone).toBe(low.currentState.zone);
		expect(high.currentState.temperatureCelsius).toBeLessThan(low.currentState.temperatureCelsius);
	});

	test('cold precipitation becomes snow while warm precipitation remains rain', () => {
		const cold = simulate('Pine Highlands', 'heavy_rain', 42, 0.08);
		const warm = simulate('Amazon Rainforest', 'heavy_rain', 10, 0.58);

		expect(cold.currentState.snowBlend).toBeGreaterThan(cold.currentState.rainBlend);
		expect(cold.currentState.precipitationType).toMatch(/snow|mixed/);
		expect(warm.currentState.rainBlend).toBeGreaterThan(warm.currentState.snowBlend);
		expect(warm.currentState.precipitationType).toBe('rain');
	});

	test('wind chill never warms a cold climate and breath appears only in cold humid air', () => {
		const cold = simulate('Pine Highlands', 'snow', 32, 0.08);
		const warm = simulate('Amazon Rainforest', 'clear', 10, 0.58);
		expect(cold.currentState.windChillCelsius).toBeLessThanOrEqual(
			cold.currentState.temperatureCelsius
		);
		expect(cold.currentState.breathVisibility).toBeGreaterThan(0);
		expect(warm.currentState.breathVisibility).toBe(0);
	});

	test('same inputs are frame-rate independent', () => {
		const run = (fps: number) => {
			const weather = new WeatherScheduler({ seed: 81, initialWeather: 'snow' });
			weather.forceWeather('snow');
			const wind = new WindSystem({ seed: 82 });
			const climate = new ClimateSystem();
			for (let index = 0; index < fps * 12; index += 1) {
				wind.update(1 / fps, weather.currentState.parameters.windStrength);
				climate.update(
					1 / fps,
					new Vector3(0, 28, 0),
					0.08,
					weather.currentState,
					wind.currentState,
					makeWorld('Pine Highlands')
				);
			}
			return climate.currentState;
		};

		const at30 = run(30);
		const at120 = run(120);
		expect(at30.temperatureCelsius).toBeCloseTo(at120.temperatureCelsius, 6);
		expect(at30.windChillCelsius).toBeCloseTo(at120.windChillCelsius, 5);
		expect(at30.snowBlend).toBeCloseTo(at120.snowBlend, 6);
	});

	test('save and restore preserve the climate timeline and values', () => {
		const first = simulate('Pine Highlands', 'snow', 30, 0.08);
		const second = new ClimateSystem();
		second.restore(first.serialize());

		expect(second.currentState.elapsedSeconds).toBeCloseTo(first.currentState.elapsedSeconds, 6);
		expect(second.currentState.zone).toBe(first.currentState.zone);
		expect(second.currentState.temperatureCelsius).toBeCloseTo(
			first.currentState.temperatureCelsius,
			6
		);
		expect(second.currentState.snowBlend).toBeCloseTo(first.currentState.snowBlend, 6);
	});

	test('all values remain finite and bounded during a long climate simulation', () => {
		const weather = new WeatherScheduler({ seed: 91, initialWeather: 'snow' });
		const wind = new WindSystem({ seed: 92 });
		const climate = new ClimateSystem();
		for (let index = 0; index < 20_000; index += 1) {
			weather.update(0.1);
			wind.update(0.1, weather.currentState.parameters.windStrength);
			climate.update(
				0.1,
				new Vector3(index % 120, 8 + (index % 45), -(index % 80)),
				(index % 1000) / 1000,
				weather.currentState,
				wind.currentState,
				makeWorld(index % 2 === 0 ? 'Pine Highlands' : 'Amazon Rainforest')
			);

			if (index % 200 === 0) {
				for (const value of [
					climate.currentState.temperatureCelsius,
					climate.currentState.windChillCelsius,
					climate.currentState.humidity,
					climate.currentState.rainBlend,
					climate.currentState.snowBlend,
					climate.currentState.frostPotential,
					climate.currentState.breathVisibility
				]) {
					expect(Number.isFinite(value)).toBe(true);
				}
				expect(climate.currentState.humidity).toBeGreaterThanOrEqual(0);
				expect(climate.currentState.humidity).toBeLessThanOrEqual(1);
				expect(climate.currentState.snowBlend).toBeGreaterThanOrEqual(0);
				expect(climate.currentState.snowBlend).toBeLessThanOrEqual(1);
			}
		}
	}, 15_000);
});
