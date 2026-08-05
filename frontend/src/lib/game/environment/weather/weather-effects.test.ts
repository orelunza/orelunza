import { describe, expect, test } from 'vitest';
import { Vector3 } from 'three';
import { WeatherScheduler } from './WeatherScheduler';
import { WindSystem } from '../wind/WindSystem';
import { PrecipitationSystem } from './PrecipitationSystem';
import { FogController } from './FogController';
import { LightningSystem } from './LightningSystem';
import { RainOcclusionSystem } from './rendering/RainOcclusionSystem';

function weather(kind: 'clear' | 'light_rain' | 'heavy_rain' | 'storm' | 'snow') {
	const scheduler = new WeatherScheduler({ seed: 77, initialWeather: kind });
	scheduler.forceWeather(kind);
	return scheduler;
}

describe('weather Lot 2 effects', () => {
	test('rain intensity follows weather and the shared wind', () => {
		const scheduler = weather('heavy_rain');
		const wind = new WindSystem({ seed: 19 });
		const rain = new PrecipitationSystem();
		wind.update(1, scheduler.currentState.parameters.windStrength);
		rain.update(1, scheduler.currentState, wind.currentState, 0);

		expect(rain.currentState.kind).toBe('rain');
		expect(rain.currentState.intensity).toBeGreaterThan(0.7);
		expect(rain.currentState.visibleIntensity).toBeCloseTo(rain.currentState.intensity, 6);
		expect(Math.hypot(rain.currentState.windX, rain.currentState.windZ)).toBeGreaterThan(0);
	});

	test('a sealed roof suppresses local rain and splashes', () => {
		const scheduler = weather('storm');
		const wind = new WindSystem({ seed: 20 });
		const rain = new PrecipitationSystem();
		wind.update(1, scheduler.currentState.parameters.windStrength);
		rain.update(1, scheduler.currentState, wind.currentState, 1);

		expect(rain.currentState.intensity).toBe(1);
		expect(rain.currentState.visibleIntensity).toBe(0);
		expect(rain.currentState.splashIntensity).toBe(0);
	});

	test('snow weather emits snow without rain', () => {
		const scheduler = weather('snow');
		const wind = new WindSystem({ seed: 21 });
		const rain = new PrecipitationSystem();
		wind.update(1, scheduler.currentState.parameters.windStrength);
		rain.update(1, scheduler.currentState, wind.currentState, 0);

		expect(rain.currentState.kind).toBe('snow');
		expect(rain.currentState.intensity).toBeGreaterThan(0.6);
		expect(rain.currentState.rainIntensity).toBe(0);
		expect(rain.currentState.snowIntensity).toBeGreaterThan(0.6);
	});

	test('precipitation save restores its deterministic timeline', () => {
		const scheduler = weather('light_rain');
		const wind = new WindSystem({ seed: 22 });
		const first = new PrecipitationSystem();
		wind.update(2.5, scheduler.currentState.parameters.windStrength);
		first.update(2.5, scheduler.currentState, wind.currentState, 0.25);

		const second = new PrecipitationSystem();
		second.restore(first.serialize());
		second.update(0, scheduler.currentState, wind.currentState, 0.25);

		expect(second.currentState.elapsedSeconds).toBeCloseTo(first.currentState.elapsedSeconds, 6);
		expect(second.currentState.visibleIntensity).toBeCloseTo(
			first.currentState.visibleIntensity,
			6
		);
	});

	test('fog combines scheduled density, humidity and rain haze without exceeding bounds', () => {
		const scheduler = weather('heavy_rain');
		const wind = new WindSystem({ seed: 23 });
		const rain = new PrecipitationSystem();
		const fog = new FogController();
		wind.update(1, scheduler.currentState.parameters.windStrength);
		rain.update(1, scheduler.currentState, wind.currentState, 0);
		fog.update(scheduler.currentState, rain.currentState);

		expect(fog.currentState.density).toBeGreaterThan(scheduler.currentState.parameters.fogDensity);
		expect(fog.currentState.density).toBeLessThanOrEqual(1);
		expect(fog.currentState.visibility).toBeGreaterThanOrEqual(0.22);
		expect(fog.currentState.visibility).toBeLessThanOrEqual(1);
	});

	test('lightning scheduling is deterministic for the same seed and elapsed time', () => {
		const scheduler = weather('storm');
		const first = new LightningSystem(0x12345678);
		const second = new LightningSystem(0x12345678);

		for (let index = 0; index < 1200; index += 1) {
			first.update(0.1, scheduler.currentState);
			second.update(0.1, scheduler.currentState);
		}

		expect(second.currentState.strikeId).toBe(first.currentState.strikeId);
		expect(second.currentState.bearingRadians).toBeCloseTo(first.currentState.bearingRadians, 8);
		expect(second.currentState.distanceMeters).toBeCloseTo(first.currentState.distanceMeters, 8);
		expect(first.currentState.strikeId).toBeGreaterThan(0);
	});

	test('manual lightning produces a multi-pulse flash and delayed thunder', () => {
		const scheduler = weather('storm');
		const lightning = new LightningSystem(44);
		lightning.trigger();
		lightning.update(0.04, scheduler.currentState);

		expect(lightning.currentState.flashIntensity).toBeGreaterThan(0);
		expect(lightning.currentState.boltVisibility).toBeGreaterThan(0);
		expect(lightning.currentState.lastThunder).toBeNull();

		lightning.update(1, scheduler.currentState);
		expect(lightning.currentState.lastThunder).not.toBeNull();
		expect(lightning.currentState.lastThunder?.delaySeconds).toBeGreaterThan(0);
	});

	test('lightning save preserves an active strike and pending thunder', () => {
		const scheduler = weather('storm');
		const first = new LightningSystem(55);
		first.trigger();
		first.update(0.08, scheduler.currentState);

		const second = new LightningSystem(55);
		second.restore(first.serialize());

		expect(second.currentState.strikeId).toBe(first.currentState.strikeId);
		expect(second.currentState.flashIntensity).toBeCloseTo(first.currentState.flashIntensity, 6);
		expect(second.currentState.distanceMeters).toBeCloseTo(first.currentState.distanceMeters, 6);
	});

	test('roof sampling uses a coarse cache instead of querying once per particle', () => {
		let queries = 0;
		const occlusion = new RainOcclusionSystem({
			surfaceHeightAt: () => 3,
			rainOcclusionAt: (x) => {
				queries += 1;
				return Math.abs(x) < 1 ? 1 : 0;
			}
		});
		const camera = new Vector3(0, 6, 0);
		occlusion.update(camera, 1);
		const firstQueries = queries;
		occlusion.update(camera, 0.01);

		expect(firstQueries).toBe(25);
		expect(queries).toBe(firstQueries);
		expect(occlusion.shelterFactor).toBeGreaterThan(0.8);
		expect(occlusion.surfaceHeightAt(2, 2)).toBe(3);
	});

	test('all effect values remain finite and bounded during a long storm', () => {
		const scheduler = weather('storm');
		const wind = new WindSystem({ seed: 99 });
		const rain = new PrecipitationSystem();
		const fog = new FogController();
		const lightning = new LightningSystem(100);

		for (let index = 0; index < 20_000; index += 1) {
			wind.update(0.05, scheduler.currentState.parameters.windStrength);
			rain.update(0.05, scheduler.currentState, wind.currentState, index % 200 < 20 ? 1 : 0);
			fog.update(scheduler.currentState, rain.currentState);
			lightning.update(0.05, scheduler.currentState);

			if (index % 100 === 0) {
				for (const value of [
					rain.currentState.intensity,
					rain.currentState.visibleIntensity,
					rain.currentState.splashIntensity,
					fog.currentState.density,
					fog.currentState.visibility,
					lightning.currentState.flashIntensity,
					lightning.currentState.boltVisibility
				]) {
					expect(Number.isFinite(value)).toBe(true);
					expect(value).toBeGreaterThanOrEqual(0);
					expect(value).toBeLessThanOrEqual(1);
				}
			}
		}
	}, 15_000);
});
