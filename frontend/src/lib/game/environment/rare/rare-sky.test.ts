import { describe, expect, test } from 'vitest';
import { EnvironmentState } from '../EnvironmentState';
import { AuroraSystem } from './AuroraSystem';
import { RainbowSystem } from './RainbowSystem';
import { ShootingStarSystem } from './ShootingStarSystem';

function daylightState(): EnvironmentState {
	const state = new EnvironmentState();
	state.daylight = 0.8;
	state.night = 0;
	state.sunAltitude = 0.22;
	state.sunDirection.set(0.4, 0.22, 0.88).normalize();
	state.humidity = 0.82;
	state.cloudSunOcclusion = 0.18;
	state.cloudMoonOcclusion = 0.1;
	state.cloudCoverage = 0.25;
	state.precipitation = 0;
	state.rainVisibleIntensity = 0;
	state.starVisibility = 0;
	state.dayNumber = 4;
	return state;
}

function clearNightState(): EnvironmentState {
	const state = new EnvironmentState();
	state.daylight = 0;
	state.night = 1;
	state.sunAltitude = -0.8;
	state.cloudCoverage = 0.05;
	state.cloudMoonOcclusion = 0.04;
	state.precipitation = 0;
	state.starVisibility = 0.95;
	state.dayNumber = 8;
	return state;
}

describe('rare sky events Lot 5', () => {
	test('rainbow remembers rain and fades in after the sky starts clearing', () => {
		const rainbow = new RainbowSystem(10);
		const state = daylightState();
		state.rainVisibleIntensity = 0.9;
		for (let index = 0; index < 300; index += 1) {
			rainbow.update(1 / 60, state);
		}
		expect(rainbow.currentState.rainMemory).toBeGreaterThan(0.7);

		state.rainVisibleIntensity = 0;
		rainbow.trigger();
		for (let index = 0; index < 600; index += 1) {
			rainbow.update(1 / 60, state);
		}
		expect(rainbow.currentState.intensity).toBeGreaterThan(0.4);
		expect(Number.isFinite(rainbow.currentState.azimuthRadians)).toBe(true);
	});

	test('rainbow save and restore preserve the post-rain envelope', () => {
		const state = daylightState();
		const first = new RainbowSystem(20);
		first.trigger();
		first.update(5, state);
		const second = new RainbowSystem(20);
		second.restore(first.serialize());
		expect(second.serialize()).toEqual(first.serialize());
	});

	test('shooting-star schedules are deterministic for the same seed', () => {
		const state = clearNightState();
		const run = () => {
			const stars = new ShootingStarSystem(30);
			for (let index = 0; index < 4000; index += 1) {
				stars.update(0.05, state);
			}
			return stars.serialize();
		};
		expect(run()).toEqual(run());
	});

	test('missed daytime events do not burst when night begins', () => {
		const state = daylightState();
		const stars = new ShootingStarSystem(35);
		for (let index = 0; index < 3600; index += 1) {
			stars.update(1, state);
		}
		expect(stars.currentState.activeCount).toBe(0);
		state.daylight = 0;
		state.night = 1;
		state.starVisibility = 1;
		stars.update(0.1, state);
		expect(stars.currentState.activeCount).toBeLessThanOrEqual(1);
	});

	test('forced shooting star is visible at night and expires without allocation growth', () => {
		const state = clearNightState();
		const stars = new ShootingStarSystem(40);
		stars.trigger();
		stars.update(0.1, state);
		expect(stars.currentState.activeCount).toBe(1);
		expect(stars.currentState.events).toHaveLength(3);
		stars.update(3, state);
		expect(stars.currentState.activeCount).toBe(0);
		expect(stars.currentState.events).toHaveLength(3);
	});

	test('aurora remains absent in warm daylight and can be forced for inspection', () => {
		const state = daylightState();
		state.climateRegionId = 'amazon_rainforest';
		state.windChillCelsius = 28;
		const aurora = new AuroraSystem(50);
		aurora.update(30, state);
		expect(aurora.currentState.intensity).toBe(0);

		aurora.trigger();
		for (let index = 0; index < 600; index += 1) {
			aurora.update(1 / 60, state);
		}
		expect(aurora.currentState.intensity).toBeGreaterThan(0.35);
	});

	test('aurora save and restore preserve phase and intensity', () => {
		const state = clearNightState();
		state.climateRegionId = 'pine_highlands';
		state.windChillCelsius = -8;
		const first = new AuroraSystem(60);
		first.trigger();
		first.update(12, state);
		const second = new AuroraSystem(60);
		second.restore(first.serialize());
		expect(second.serialize()).toEqual(first.serialize());
	});

	test('all rare-event values stay finite and bounded during a long simulation', () => {
		const state = clearNightState();
		state.climateRegionId = 'pine_highlands';
		state.windChillCelsius = -10;
		const rainbow = new RainbowSystem(70);
		const stars = new ShootingStarSystem(71);
		const aurora = new AuroraSystem(72);

		for (let index = 0; index < 20_000; index += 1) {
			state.dayNumber = Math.floor(index / 1000);
			state.rainVisibleIntensity = index % 1500 < 300 ? 0.8 : 0;
			state.night = index % 2000 < 1000 ? 1 : 0;
			state.daylight = 1 - state.night;
			state.starVisibility = state.night;
			rainbow.update(0.1, state);
			stars.update(0.1, state);
			aurora.update(0.1, state);
		}

		for (const value of [
			rainbow.currentState.intensity,
			rainbow.currentState.rainMemory,
			stars.currentState.visibility,
			aurora.currentState.intensity,
			aurora.currentState.phase
		]) {
			expect(Number.isFinite(value)).toBe(true);
		}
		expect(rainbow.currentState.intensity).toBeGreaterThanOrEqual(0);
		expect(rainbow.currentState.intensity).toBeLessThanOrEqual(1);
		expect(aurora.currentState.intensity).toBeGreaterThanOrEqual(0);
		expect(aurora.currentState.intensity).toBeLessThanOrEqual(1);
	}, 15_000);
});
