import { describe, expect, test } from 'vitest';
import { getWeatherPreset } from './WeatherPreset';
import { WeatherScheduler } from './WeatherScheduler';
import { WEATHER_KINDS, type WeatherParameters } from './WeatherState';

function advanceAtFps(scheduler: WeatherScheduler, seconds: number, fps: number): void {
	const frameCount = Math.round(seconds * fps);
	const delta = seconds / frameCount;

	for (let frame = 0; frame < frameCount; frame += 1) {
		scheduler.update(delta);
	}
}

function captureTimeline(seed: number): string[] {
	const scheduler = new WeatherScheduler({ seed, durationScale: 0.025 });
	const timeline: string[] = [];
	let previousIndex = scheduler.currentState.scheduleIndex;

	for (let second = 0; second < 180; second += 1) {
		scheduler.update(1);

		if (scheduler.currentState.scheduleIndex !== previousIndex) {
			previousIndex = scheduler.currentState.scheduleIndex;
			timeline.push(scheduler.currentState.current);
		}
	}

	return timeline;
}

function expectParametersBounded(parameters: Readonly<WeatherParameters>): void {
	for (const value of [
		parameters.cloudCoverage,
		parameters.cloudDensity,
		parameters.cloudDarkness,
		parameters.humidity,
		parameters.precipitation,
		parameters.fogDensity,
		parameters.windStrength,
		parameters.lightningProbability,
		parameters.overcast
	]) {
		expect(Number.isFinite(value)).toBe(true);
		expect(value).toBeGreaterThanOrEqual(0);
		expect(value).toBeLessThanOrEqual(1);
	}

	expect(Number.isFinite(parameters.temperatureOffset)).toBe(true);
}

describe('weather presets', () => {
	test('defines bounded production parameters for every weather kind', () => {
		for (const kind of WEATHER_KINDS) {
			const preset = getWeatherPreset(kind);
			expect(preset.kind).toBe(kind);
			expectParametersBounded(preset.parameters);
			expect(preset.holdSeconds[0]).toBeGreaterThan(0);
			expect(preset.holdSeconds[1]).toBeGreaterThanOrEqual(preset.holdSeconds[0]);
			expect(preset.transitionSeconds[0]).toBeGreaterThan(0);
		}
	});
});

describe('deterministic weather scheduling', () => {
	test('same seed produces the same weather calendar', () => {
		expect(captureTimeline(0x12345678)).toEqual(captureTimeline(0x12345678));
	});

	test('different seeds produce different weather calendars', () => {
		expect(captureTimeline(11)).not.toEqual(captureTimeline(987654321));
	});

	test('progression is frame-rate independent at 30, 60 and 120 FPS', () => {
		const make = (fps: number): WeatherScheduler => {
			const scheduler = new WeatherScheduler({ seed: 42, durationScale: 0.02 });
			advanceAtFps(scheduler, 140, fps);
			return scheduler;
		};

		const at30 = make(30).serialize();
		const at60 = make(60).serialize();
		const at120 = make(120).serialize();

		for (const candidate of [at30, at120]) {
			expect(candidate.current).toBe(at60.current);
			expect(candidate.next).toBe(at60.next);
			expect(candidate.phase).toBe(at60.phase);
			expect(candidate.scheduleIndex).toBe(at60.scheduleIndex);
			expect(candidate.transition).toBeCloseTo(at60.transition, 6);
			expect(candidate.phaseElapsedSeconds).toBeCloseTo(at60.phaseElapsedSeconds ?? 0, 6);
		}
	});

	test('a transition changes continuously and completes without a jump', () => {
		const scheduler = new WeatherScheduler({ seed: 7 });
		scheduler.forceWeather('clear');
		scheduler.transitionTo('storm', 10);

		const clearCoverage = getWeatherPreset('clear').parameters.cloudCoverage;
		const stormCoverage = getWeatherPreset('storm').parameters.cloudCoverage;

		scheduler.update(5);
		expect(scheduler.currentState.transition).toBeCloseTo(0.5, 6);
		expect(scheduler.currentState.parameters.cloudCoverage).toBeGreaterThan(clearCoverage);
		expect(scheduler.currentState.parameters.cloudCoverage).toBeLessThan(stormCoverage);

		scheduler.update(5);
		expect(scheduler.currentState.current).toBe('storm');
		expect(scheduler.currentState.transition).toBe(0);
		expect(scheduler.currentState.parameters.cloudCoverage).toBeCloseTo(stormCoverage, 6);
	});

	test('pause freezes the timeline and resume continues it', () => {
		const scheduler = new WeatherScheduler({ seed: 55, durationScale: 0.02 });
		scheduler.update(3);
		const before = scheduler.serialize();

		scheduler.pause();
		scheduler.update(100);
		const paused = scheduler.serialize();
		expect(paused.phaseElapsedSeconds).toBe(before.phaseElapsedSeconds);
		expect(paused.scheduleIndex).toBe(before.scheduleIndex);

		scheduler.resume();
		scheduler.update(1);
		expect(scheduler.serialize().phaseElapsedSeconds).not.toBe(paused.phaseElapsedSeconds);
	});

	test('serializes and restores exactly in the middle of a transition', () => {
		const original = new WeatherScheduler({ seed: 987 });
		original.transitionTo('heavy_rain', 37);
		original.update(13.25);

		const save = original.serialize();
		const restored = new WeatherScheduler({ seed: 1 });
		restored.restore(save);

		expect(restored.serialize()).toEqual(save);
		expect(restored.currentState.parameters.cloudCoverage).toBeCloseTo(
			original.currentState.parameters.cloudCoverage,
			8
		);

		original.update(11.5);
		restored.update(11.5);
		expect(restored.serialize()).toEqual(original.serialize());
	});

	test('restores the older Phase 1 weather save shape', () => {
		const scheduler = new WeatherScheduler({ seed: 5 });
		scheduler.restore({
			current: 'overcast',
			next: 'clear',
			transition: 0.4,
			seed: 91
		});

		expect(scheduler.currentState.current).toBe('overcast');
		expect(scheduler.currentState.next).toBe('clear');
		expect(scheduler.currentState.phase).toBe('transitioning');
		expect(scheduler.currentState.transition).toBeCloseTo(0.4, 6);
		expect(scheduler.currentState.seed).toBe(91);
		expectParametersBounded(scheduler.currentState.parameters);
	});

	test('keeps every value finite across thousands of weather changes', () => {
		const scheduler = new WeatherScheduler({ seed: 0xf00dcafe, durationScale: 0.001 });

		for (let index = 0; index < 10_000; index += 1) {
			scheduler.update(1);
			expectParametersBounded(scheduler.currentState.parameters);
			expect(Number.isFinite(scheduler.currentState.transition)).toBe(true);
			expect(scheduler.currentState.transition).toBeGreaterThanOrEqual(0);
			expect(scheduler.currentState.transition).toBeLessThanOrEqual(1);
		}

		expect(scheduler.currentState.scheduleIndex).toBeGreaterThan(1000);
	}, 15_000);

	test('ignores negative and non-finite deltas', () => {
		const scheduler = new WeatherScheduler({ seed: 3 });
		const before = scheduler.serialize();

		scheduler.update(-1);
		scheduler.update(Number.NaN);
		scheduler.update(Number.POSITIVE_INFINITY);

		expect(scheduler.serialize()).toEqual(before);
	});

	test('development cloud coverage override is bounded and serializable', () => {
		const scheduler = new WeatherScheduler({ seed: 3 });
		scheduler.setCloudCoverageOverride(4);
		expect(scheduler.currentState.parameters.cloudCoverage).toBe(1);
		expect(scheduler.serialize().cloudCoverageOverride).toBe(1);

		scheduler.setCloudCoverageOverride(null);
		expect(scheduler.currentState.parameters.cloudCoverage).toBeCloseTo(
			getWeatherPreset(scheduler.currentState.current).parameters.cloudCoverage,
			6
		);
	});
});
