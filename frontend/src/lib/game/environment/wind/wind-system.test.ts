import { describe, expect, test } from 'vitest';
import { WindSystem } from './WindSystem';

function advance(system: WindSystem, seconds: number, fps: number, strength: number): void {
	const steps = Math.round(seconds * fps);
	const delta = seconds / steps;

	for (let index = 0; index < steps; index += 1) {
		system.update(delta, strength);
	}
}

describe('unified deterministic wind', () => {
	test('same seed and elapsed time produce the same frame at 30, 60 and 120 FPS', () => {
		const run = (fps: number) => {
			const wind = new WindSystem({ seed: 0x1234abcd });
			advance(wind, 93, fps, 0.58);

			return { ...wind.currentState };
		};

		const at30 = run(30);
		const at60 = run(60);
		const at120 = run(120);

		expect(at30.directionRadians).toBeCloseTo(at60.directionRadians, 8);
		expect(at60.directionRadians).toBeCloseTo(at120.directionRadians, 8);
		expect(at30.strength).toBeCloseTo(at60.strength, 8);
		expect(at60.strength).toBeCloseTo(at120.strength, 8);
		expect(at30.gust).toBeCloseTo(at120.gust, 8);
	});

	test('different seeds produce different wind directions', () => {
		const first = new WindSystem({ seed: 1 });
		const second = new WindSystem({ seed: 2 });
		first.update(48, 0.4);
		second.update(48, 0.4);

		expect(first.currentState.directionRadians).not.toBeCloseTo(
			second.currentState.directionRadians,
			4
		);
	});

	test('stronger weather produces stronger wind while staying bounded', () => {
		const calm = new WindSystem({ seed: 99 });
		const storm = new WindSystem({ seed: 99 });
		calm.update(30, 0.12);
		storm.update(30, 0.9);

		expect(storm.currentState.strength).toBeGreaterThan(calm.currentState.strength);
		expect(storm.currentState.strength).toBeLessThanOrEqual(1);
		expect(storm.currentState.gust).toBeGreaterThanOrEqual(0);
		expect(storm.currentState.gust).toBeLessThanOrEqual(1);
		expect(Math.hypot(storm.currentState.directionX, storm.currentState.directionZ)).toBeCloseTo(
			1,
			8
		);
	});

	test('pause freezes absolute wind time and resume continues it', () => {
		const wind = new WindSystem({ seed: 7 });
		wind.update(10, 0.3);
		const before = wind.currentState.elapsedSeconds;
		wind.pause();
		wind.update(100, 0.8);
		expect(wind.currentState.elapsedSeconds).toBe(before);

		wind.resume();
		wind.update(5, 0.8);
		expect(wind.currentState.elapsedSeconds).toBe(before + 5);
	});

	test('serializes and restores the exact wind frame', () => {
		const original = new WindSystem({ seed: 0xcafebabe });
		original.update(137.25, 0.64);
		const save = original.serialize();

		const restored = new WindSystem({ seed: 0xcafebabe });
		restored.restore(save);

		expect(restored.serialize()).toEqual(save);
		expect(restored.currentState.directionRadians).toBeCloseTo(
			original.currentState.directionRadians,
			10
		);
		expect(restored.currentState.strength).toBeCloseTo(original.currentState.strength, 10);
		expect(restored.currentState.gust).toBeCloseTo(original.currentState.gust, 10);
	});

	test('keeps every scalar finite across a long simulation', () => {
		const wind = new WindSystem({ seed: 0xf00dcafe });
		let allFinite = true;
		let minimumStrength = 1;
		let maximumStrength = 0;

		for (let index = 0; index < 20_000; index += 1) {
			wind.update(0.37, (index % 101) / 100);
			const state = wind.currentState;

			allFinite &&= [
				state.directionRadians,
				state.directionX,
				state.directionZ,
				state.strength,
				state.gust,
				state.elapsedSeconds
			].every(Number.isFinite);
			minimumStrength = Math.min(minimumStrength, state.strength);
			maximumStrength = Math.max(maximumStrength, state.strength);
		}

		expect(allFinite).toBe(true);
		expect(minimumStrength).toBeGreaterThanOrEqual(0);
		expect(maximumStrength).toBeLessThanOrEqual(1);
	});
});
