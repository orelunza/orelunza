import { describe, expect, test } from 'vitest';
import { SurfaceWeatherController } from './SurfaceWeatherController';
import { createClimateFrameState } from '../climate/ClimateState';
import { createPrecipitationFrameState } from '../weather/PrecipitationState';
import type { WindFrameState } from '../wind/WindState';

const calmWind: WindFrameState = {
	elapsedSeconds: 0,
	paused: false,
	directionRadians: 0,
	directionX: 1,
	directionZ: 0,
	strength: 0.1,
	gust: 0
};

describe('surface weather Lot 3', () => {
	test('rain wets the surface and warm sun dries it progressively', () => {
		const controller = new SurfaceWeatherController();
		const climate = createClimateFrameState();
		const precipitation = createPrecipitationFrameState();
		precipitation.visibleRainIntensity = 1;
		precipitation.rainIntensity = 1;

		for (let index = 0; index < 120; index += 1) {
			controller.update(1 / 60, climate, precipitation, -0.2, calmWind);
		}
		const wet = controller.currentState.wetness;
		expect(wet).toBeGreaterThan(0.8);

		precipitation.visibleRainIntensity = 0;
		precipitation.rainIntensity = 0;
		climate.temperatureCelsius = 26;
		for (let index = 0; index < 3600; index += 1) {
			controller.update(1 / 60, climate, precipitation, 0.9, calmWind);
		}
		expect(controller.currentState.wetness).toBeLessThan(wet);
	});

	test('snow accumulates below freezing and melts in warm rain', () => {
		const controller = new SurfaceWeatherController();
		const climate = createClimateFrameState();
		const precipitation = createPrecipitationFrameState();
		climate.temperatureCelsius = -7;
		precipitation.visibleSnowIntensity = 1;
		precipitation.snowIntensity = 1;
		for (let index = 0; index < 1200; index += 1) {
			controller.update(1 / 60, climate, precipitation, -0.3, calmWind);
		}
		const accumulated = controller.currentState.snowCoverage;
		expect(accumulated).toBeGreaterThan(0.9);

		climate.temperatureCelsius = 18;
		precipitation.visibleSnowIntensity = 0;
		precipitation.snowIntensity = 0;
		precipitation.visibleRainIntensity = 0.8;
		precipitation.rainIntensity = 0.8;
		for (let index = 0; index < 1800; index += 1) {
			controller.update(1 / 60, climate, precipitation, 0.8, calmWind);
		}
		expect(controller.currentState.snowCoverage).toBeLessThan(accumulated);
	});

	test('cold humid wet surfaces develop frost without exceeding bounds', () => {
		const controller = new SurfaceWeatherController();
		const climate = createClimateFrameState();
		const precipitation = createPrecipitationFrameState();
		climate.temperatureCelsius = -4;
		climate.humidity = 0.92;
		climate.frostPotential = 1;
		precipitation.visibleRainIntensity = 0.35;
		for (let index = 0; index < 2400; index += 1) {
			controller.update(1 / 60, climate, precipitation, -0.4, calmWind);
		}
		expect(controller.currentState.frost).toBeGreaterThan(0.2);
		expect(controller.currentState.frost).toBeLessThanOrEqual(1);
	});

	test('pause freezes accumulation and resume continues it', () => {
		const controller = new SurfaceWeatherController();
		const climate = createClimateFrameState();
		const precipitation = createPrecipitationFrameState();
		precipitation.visibleRainIntensity = 1;
		controller.pause();
		controller.update(10, climate, precipitation, 0.5, calmWind);
		expect(controller.currentState.wetness).toBe(0);
		controller.resume();
		controller.update(1, climate, precipitation, 0.5, calmWind);
		expect(controller.currentState.wetness).toBeGreaterThan(0);
	});

	test('save and restore preserve wetness, snow and frost', () => {
		const first = new SurfaceWeatherController();
		first.restore({
			elapsedSeconds: 42,
			paused: true,
			wetness: 0.7,
			snowCoverage: 0.4,
			frost: 0.3
		});
		const second = new SurfaceWeatherController();
		second.restore(first.serialize());
		expect(second.serialize()).toEqual(first.serialize());
	});

	test('invalid save values are clamped safely', () => {
		const controller = new SurfaceWeatherController();
		controller.restore({
			elapsedSeconds: Number.NaN,
			paused: false,
			wetness: 5,
			snowCoverage: -2,
			frost: Number.POSITIVE_INFINITY
		});
		expect(controller.currentState.elapsedSeconds).toBe(0);
		expect(controller.currentState.wetness).toBe(1);
		expect(controller.currentState.snowCoverage).toBe(0);
		expect(controller.currentState.frost).toBe(1);
	});
});
