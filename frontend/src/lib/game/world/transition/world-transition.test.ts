import { describe, expect, it } from 'vitest';
import { firstSpawnPhase } from './WorldTransition';
describe('first spawn transition', () => {
	it('keeps a readable descent before reveal', () => {
		expect(firstSpawnPhase(0, false)).toBe('focusing');
		expect(firstSpawnPhase(500, false)).toBe('descending');
		expect(firstSpawnPhase(500, true)).toBe('descending');
		expect(firstSpawnPhase(900, true)).toBe('revealing');
	});
	it('uses a short reduced-motion bridge', () =>
		expect(firstSpawnPhase(0, true, true)).toBe('revealing'));
});
