import { describe, expect, test } from 'vitest';
import { EnvironmentState } from '../EnvironmentState';
import { WeatherAudioController } from './WeatherAudioController';
import { WeatherAudioMixer } from './WeatherAudioMixer';

describe('procedural weather audio Lot 5', () => {
	test('maps unified wind and rain to bounded mix levels', () => {
		const state = new EnvironmentState();
		state.windStrength = 0.8;
		state.windGust = 0.5;
		state.rainVisibleIntensity = 0.75;
		state.rainShelter = 0;
		const mixer = new WeatherAudioMixer();
		mixer.update(0, state, false);
		expect(mixer.currentLevels.wind).toBeGreaterThan(0.5);
		expect(mixer.currentLevels.rain).toBeCloseTo(0.75, 6);
		for (const value of Object.values(mixer.currentLevels)) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});

	test('shelter attenuates rain without muting the whole environment', () => {
		const state = new EnvironmentState();
		state.windStrength = 0.6;
		state.rainVisibleIntensity = 1;
		const outside = new WeatherAudioMixer();
		outside.update(0, state, false);
		state.rainShelter = 1;
		const sheltered = new WeatherAudioMixer();
		sheltered.update(0, state, false);
		expect(sheltered.currentLevels.rain).toBeLessThan(outside.currentLevels.rain * 0.2);
		expect(sheltered.currentLevels.wind).toBeGreaterThan(0);
	});

	test('pause fades the master target while keeping finite source levels', () => {
		const state = new EnvironmentState();
		state.windStrength = 1;
		state.rainVisibleIntensity = 1;
		const mixer = new WeatherAudioMixer();
		mixer.update(2, state, false);
		mixer.update(2, state, true);
		expect(mixer.currentLevels.master).toBeLessThan(0.01);
		for (const value of Object.values(mixer.currentLevels)) {
			expect(Number.isFinite(value)).toBe(true);
		}
	});

	test('controller stays safe when Web Audio is unavailable in the test runtime', async () => {
		const controller = new WeatherAudioController(123);
		const enabled = await controller.enable();
		expect(enabled).toBe(false);
		controller.dispose();
		controller.dispose();
	});
});
