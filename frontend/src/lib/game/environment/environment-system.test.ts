import { describe, expect, test } from 'vitest';
import { Vector3 } from 'three';

import { CelestialClock, DEFAULT_DAY_LENGTH_SECONDS, LUNAR_CYCLE_DAYS } from './CelestialClock';
import { EnvironmentState } from './EnvironmentState';
import { resolveEnvironmentQuality } from './EnvironmentQuality';
import { CloudSystem } from './clouds/CloudSystem';
import { WeatherScheduler } from './weather/WeatherScheduler';
import { WindSystem } from './wind/WindSystem';
import {
	DeterministicRandom,
	clamp,
	clamp01,
	hashStringToUint32,
	lerp,
	smoothstep,
	wrap01Range
} from './EnvironmentMath';

/**
 * These tests exercise the deterministic, renderer-free core of the Phase 1
 * environment system: the clock, the derived state, the quality profiles and
 * the math helpers. They deliberately avoid Three.js renderer construction so
 * they run headlessly in Vitest without a WebGL context.
 */

function isFiniteNumber(value: number): boolean {
	return Number.isFinite(value);
}

/** Advances a clock in fixed steps summing to `seconds`, at a given FPS. */
function advanceAtFps(clock: CelestialClock, seconds: number, fps: number): void {
	const step = 1 / fps;
	const steps = Math.round(seconds * fps);

	for (let index = 0; index < steps; index += 1) {
		clock.advance(step);
	}
}

describe('environment math helpers', () => {
	test('clamp and clamp01 bound their inputs', () => {
		expect(clamp(5, 0, 3)).toBe(3);
		expect(clamp(-1, 0, 3)).toBe(0);
		expect(clamp(2, 0, 3)).toBe(2);
		expect(clamp01(2)).toBe(1);
		expect(clamp01(-2)).toBe(0);
		expect(clamp01(0.4)).toBe(0.4);
	});

	test('lerp and smoothstep behave at the edges', () => {
		expect(lerp(0, 10, 0.5)).toBe(5);
		expect(smoothstep(0, 1, -1)).toBe(0);
		expect(smoothstep(0, 1, 2)).toBe(1);
		expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
	});

	test('wrap01Range keeps values in the half-open range', () => {
		expect(wrap01Range(1.25, 1)).toBeCloseTo(0.25, 6);
		expect(wrap01Range(-0.25, 1)).toBeCloseTo(0.75, 6);
		expect(wrap01Range(2.5, 2)).toBeCloseTo(0.5, 6);
	});

	test('string hashing is stable and deterministic', () => {
		expect(hashStringToUint32('orelunza')).toBe(hashStringToUint32('orelunza'));
		expect(hashStringToUint32('a')).not.toBe(hashStringToUint32('b'));
	});

	test('DeterministicRandom reproduces the same sequence for a seed', () => {
		const first = new DeterministicRandom(12345);
		const second = new DeterministicRandom(12345);

		for (let index = 0; index < 100; index += 1) {
			expect(first.next()).toBe(second.next());
		}
	});
});

describe('celestial clock timing', () => {
	test('progression is frame-rate independent at 30, 60 and 120 FPS', () => {
		const make = (fps: number): CelestialClock => {
			const clock = new CelestialClock({
				dayLengthSeconds: 100,
				timeOfDaySeconds: 0
			});
			advanceAtFps(clock, 40, fps);

			return clock;
		};

		const at30 = make(30).normalizedTimeOfDay;
		const at60 = make(60).normalizedTimeOfDay;
		const at120 = make(120).normalizedTimeOfDay;

		expect(at30).toBeCloseTo(at60, 5);
		expect(at60).toBeCloseTo(at120, 5);
		expect(at60).toBeCloseTo(0.4, 5);
	});

	test('produces the same state for the same day and time regardless of path', () => {
		const direct = new CelestialClock({
			dayLengthSeconds: 100,
			timeOfDaySeconds: 0
		});
		direct.setTimeOfDaySeconds(63);

		const stepped = new CelestialClock({
			dayLengthSeconds: 100,
			timeOfDaySeconds: 0
		});
		advanceAtFps(stepped, 63, 60);

		expect(stepped.normalizedTimeOfDay).toBeCloseTo(direct.normalizedTimeOfDay, 4);
		expect(stepped.sunAltitude).toBeCloseTo(direct.sunAltitude, 4);
	});

	test('crosses midnight continuously from 23:59 to 00:00 without a jump', () => {
		const dayLength = DEFAULT_DAY_LENGTH_SECONDS;
		const clock = new CelestialClock({
			dayLengthSeconds: dayLength,
			// One second before midnight.
			timeOfDaySeconds: dayLength - 1,
			dayNumber: 3
		});

		const beforeAltitude = clock.sunAltitude;
		clock.advance(2); // Cross midnight by one second.

		expect(clock.currentDayNumber).toBe(4);
		expect(clock.normalizedTimeOfDay).toBeGreaterThanOrEqual(0);
		expect(clock.normalizedTimeOfDay).toBeLessThan(0.01);
		// The sun altitude must be continuous across the boundary (near the
		// nadir on both sides), never snapping to a far-away value.
		expect(Math.abs(clock.sunAltitude - beforeAltitude)).toBeLessThan(0.05);
	});

	test('rolls over multiple days when a single delta is very large', () => {
		const clock = new CelestialClock({
			dayLengthSeconds: 100,
			timeOfDaySeconds: 50
		});
		clock.advance(350); // 50 -> 400: crosses t=100,200,300,400 => 4 midnights.

		expect(clock.currentDayNumber).toBe(4);
		expect(clock.normalizedTimeOfDay).toBeCloseTo(0.0, 4);
	});

	test('places the sun overhead at noon and below at midnight', () => {
		const dayLength = 1000;
		const clock = new CelestialClock({ dayLengthSeconds: dayLength });

		clock.setDayFraction(0.5); // noon
		expect(clock.sunAltitude).toBeGreaterThan(0.9);

		clock.setDayFraction(0.0); // midnight
		expect(clock.sunAltitude).toBeLessThan(-0.9);

		clock.setDayFraction(0.25); // sunrise, on the horizon
		expect(Math.abs(clock.sunAltitude)).toBeLessThan(0.1);
	});

	test('moon is up at night and its phase advances one cycle per lunar month', () => {
		const clock = new CelestialClock({ dayLengthSeconds: 1000, dayNumber: 0 });
		clock.setDayFraction(0.0); // midnight

		expect(clock.moonDirectionRef.y).toBeGreaterThan(0.5);

		const newMoon = new CelestialClock({
			dayLengthSeconds: 1000,
			dayNumber: 0
		});
		const fullMoon = new CelestialClock({
			dayLengthSeconds: 1000,
			dayNumber: Math.round(LUNAR_CYCLE_DAYS / 2)
		});

		expect(newMoon.lunarIllumination).toBeLessThan(0.1);
		expect(fullMoon.lunarIllumination).toBeGreaterThan(0.9);
	});

	test('pause freezes progression and resume restores it', () => {
		const clock = new CelestialClock({
			dayLengthSeconds: 100,
			timeOfDaySeconds: 10
		});
		clock.pause();
		clock.advance(20);

		expect(clock.isPaused).toBe(true);
		expect(clock.normalizedTimeOfDay).toBeCloseTo(0.1, 6);

		clock.resume();
		clock.advance(10);
		expect(clock.normalizedTimeOfDay).toBeCloseTo(0.2, 6);
	});

	test('development time scale accelerates only when set, default is real speed', () => {
		const realClock = new CelestialClock({ dayLengthSeconds: 100 });
		const fastClock = new CelestialClock({ dayLengthSeconds: 100 });
		fastClock.setDevelopmentTimeScale(10);

		realClock.advance(5);
		fastClock.advance(5);

		expect(fastClock.normalizedTimeOfDay).toBeGreaterThan(realClock.normalizedTimeOfDay);
	});

	test('serializes and restores to an identical state', () => {
		const clock = new CelestialClock({
			dayLengthSeconds: 800,
			timeOfDaySeconds: 123
		});
		advanceAtFps(clock, 500, 60);
		const saved = clock.serialize();

		const restored = new CelestialClock({ dayLengthSeconds: 800 });
		restored.restore(saved);

		expect(restored.currentDayNumber).toBe(clock.currentDayNumber);
		expect(restored.normalizedTimeOfDay).toBeCloseTo(clock.normalizedTimeOfDay, 6);
		expect(restored.sunAltitude).toBeCloseTo(clock.sunAltitude, 6);
	});

	test('directions stay finite, normalized and free of NaN across a full day', () => {
		const clock = new CelestialClock({ dayLengthSeconds: 240 });

		for (let index = 0; index < 2400; index += 1) {
			clock.advance(0.1);
			const sun = clock.sunDirectionRef;
			const moon = clock.moonDirectionRef;

			expect(isFiniteNumber(sun.x)).toBe(true);
			expect(isFiniteNumber(sun.y)).toBe(true);
			expect(isFiniteNumber(sun.z)).toBe(true);
			expect(sun.length()).toBeCloseTo(1, 5);
			expect(moon.length()).toBeCloseTo(1, 5);
		}
	});

	test('ignores non-finite or negative deltas', () => {
		const clock = new CelestialClock({
			dayLengthSeconds: 100,
			timeOfDaySeconds: 30
		});
		clock.advance(Number.NaN);
		clock.advance(-5);
		clock.advance(Number.POSITIVE_INFINITY);

		expect(clock.normalizedTimeOfDay).toBeCloseTo(0.3, 6);
	});
});

describe('environment state derivation', () => {
	test('is fully daylight at noon and fully night at midnight', () => {
		const state = new EnvironmentState();
		const clock = new CelestialClock({ dayLengthSeconds: 1000 });

		clock.setDayFraction(0.5);
		state.update(clock);
		expect(state.daylight).toBeGreaterThan(0.9);
		expect(state.night).toBeLessThan(0.1);
		expect(state.starVisibility).toBeLessThan(0.1);

		clock.setDayFraction(0.0);
		state.update(clock);
		expect(state.night).toBeGreaterThan(0.9);
		expect(state.daylight).toBeLessThan(0.1);
		expect(state.starVisibility).toBeGreaterThan(0.8);
	});

	test('dense clouds dim celestial light, soften shadows and hide stars', () => {
		const clock = new CelestialClock({ dayLengthSeconds: 1000 });
		const weather = new WeatherScheduler({ seed: 9 });
		const wind = new WindSystem({ seed: 10 });
		const clouds = new CloudSystem();
		const clearState = new EnvironmentState();
		const stormState = new EnvironmentState();

		clock.setDayFraction(0.5);
		weather.forceWeather('clear');
		wind.update(0, weather.currentState.parameters.windStrength);
		clouds.update(weather.currentState.parameters, wind.currentState, 0);
		clearState.update(clock, weather.currentState, wind.currentState, clouds.currentState);

		weather.forceWeather('storm');
		wind.update(0, weather.currentState.parameters.windStrength);
		clouds.update(weather.currentState.parameters, wind.currentState, 0);
		stormState.update(clock, weather.currentState, wind.currentState, clouds.currentState);

		expect(stormState.lightIntensity).toBeLessThan(clearState.lightIntensity);
		expect(stormState.exposure).toBeLessThan(clearState.exposure);
		expect(stormState.shadowSoftness).toBeGreaterThan(clearState.shadowSoftness);

		clock.setDayFraction(0);
		clearState.update(clock, weather.currentState, wind.currentState, {
			...clouds.currentState,
			moonOcclusion: 0
		});
		stormState.update(clock, weather.currentState, wind.currentState, clouds.currentState);
		expect(stormState.starVisibility).toBeLessThan(clearState.starVisibility);
	});

	test('every derived scalar stays within its documented bounds all day', () => {
		const state = new EnvironmentState();
		const clock = new CelestialClock({ dayLengthSeconds: 300 });

		for (let index = 0; index < 3000; index += 1) {
			clock.advance(0.1);
			state.update(clock);

			for (const value of [
				state.daylight,
				state.night,
				state.twilight,
				state.goldenHour,
				state.starVisibility,
				state.lunarIllumination
			]) {
				expect(isFiniteNumber(value)).toBe(true);
				expect(value).toBeGreaterThanOrEqual(0);
				expect(value).toBeLessThanOrEqual(1);
			}

			expect(isFiniteNumber(state.lightIntensity)).toBe(true);
			expect(state.lightIntensity).toBeGreaterThanOrEqual(0);
			expect(isFiniteNumber(state.exposure)).toBe(true);
		}
	});

	test('colours remain finite and in gamut across a full day', () => {
		const state = new EnvironmentState();
		const clock = new CelestialClock({ dayLengthSeconds: 300 });

		for (let index = 0; index < 1500; index += 1) {
			clock.advance(0.2);
			state.update(clock);

			for (const color of [
				state.zenithColor,
				state.horizonColor,
				state.lightColor,
				state.ambientColor,
				state.fogColor
			]) {
				expect(isFiniteNumber(color.r)).toBe(true);
				expect(color.r).toBeGreaterThanOrEqual(0);
				expect(color.g).toBeGreaterThanOrEqual(0);
				expect(color.b).toBeGreaterThanOrEqual(0);
			}
		}
	});

	test('remains stable across thousands of simulated days', () => {
		const state = new EnvironmentState();
		const clock = new CelestialClock({ dayLengthSeconds: 60 });

		// 3000 in-world days at a coarse step; verifies no drift into NaN and
		// that the day counter keeps climbing monotonically.
		for (let index = 0; index < 30000; index += 1) {
			clock.advance(6);
			state.update(clock);
		}

		expect(clock.currentDayNumber).toBe(3000);
		expect(isFiniteNumber(state.sunAltitude)).toBe(true);
		expect(isFiniteNumber(state.lightIntensity)).toBe(true);
		expect(state.starVisibility).toBeGreaterThanOrEqual(0);
		expect(state.starVisibility).toBeLessThanOrEqual(1);
	});

	test('restores weather state and clamps the transition', () => {
		const state = new EnvironmentState();
		state.restoreWeather({
			current: 'overcast',
			next: 'clear',
			transition: 2,
			seed: 7
		});

		expect(state.weather.current).toBe('overcast');
		expect(state.weather.next).toBe('clear');
		expect(state.weather.transition).toBe(1);
		expect(state.weather.seed).toBe(7);
	});
});

describe('environment quality profiles', () => {
	test('low, medium and high scale the mandated knobs monotonically', () => {
		const low = resolveEnvironmentQuality('low');
		const medium = resolveEnvironmentQuality('medium');
		const high = resolveEnvironmentQuality('high');

		expect(low.starCount).toBeLessThan(medium.starCount);
		expect(medium.starCount).toBeLessThan(high.starCount);

		expect(low.skySegments).toBeLessThan(medium.skySegments);
		expect(medium.skySegments).toBeLessThanOrEqual(high.skySegments);

		expect(low.richAtmosphere).toBe(false);
		expect(medium.richAtmosphere).toBe(true);

		expect(low.cloudSegments).toBeLessThan(medium.cloudSegments);
		expect(medium.cloudSegments).toBeLessThan(high.cloudSegments);
		expect(low.cloudDetail).toBeLessThan(medium.cloudDetail);
		expect(medium.cloudDetail).toBeLessThanOrEqual(high.cloudDetail);

		expect(low.sunShadows).toBe(false);
		expect(medium.sunShadows).toBe(true);
		expect(high.sunShadows).toBe(true);

		expect(high.shadowMapSize).toBeGreaterThanOrEqual(medium.shadowMapSize);
	});

	test('an unknown value falls back to medium', () => {
		const fallback = resolveEnvironmentQuality('unknown' as 'medium');
		expect(fallback.quality).toBe('medium');
	});
});

describe('celestial vector helpers', () => {
	test('sun and moon are on opposite hemispheres at midnight', () => {
		const clock = new CelestialClock({ dayLengthSeconds: 1000 });
		clock.setDayFraction(0.0);

		const sun = new Vector3().copy(clock.sunDirectionRef);
		const moon = new Vector3().copy(clock.moonDirectionRef);

		// The moon is up (positive y) while the sun is down (negative y).
		expect(moon.y).toBeGreaterThan(0);
		expect(sun.y).toBeLessThan(0);
	});
});
