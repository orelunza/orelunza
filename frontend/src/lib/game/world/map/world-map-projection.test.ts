import { describe, expect, it } from 'vitest';
import { boundsFor, project, unproject } from './WorldMapProjection';
describe('WorldMapProjection', () => {
	it('round trips geographic points including the date line', () => {
		for (const p of [
			[0, 0],
			[45, 179],
			[-80, -179]
		] as const) {
			const r = unproject(project(p[0], p[1]).x, project(p[0], p[1]).y);
			expect(r.latitude).toBeCloseTo(p[0], 5);
			expect(r.longitude).toBeCloseTo(p[1], 5);
		}
	});
	it('clamps invalid latitude, normalizes longitude, and stays finite', () => {
		const top = project(200, 540);
		expect(top.x).toBeCloseTo(0, 6);
		expect(Number.isFinite(top.y)).toBe(true);
		expect(unproject(top.x, top.y).latitude).toBeLessThanOrEqual(85.05112878);
		expect(boundsFor(project(0, 179), 3, 2).west).toBeGreaterThan(
			boundsFor(project(0, 179), 3, 2).east
		);
	});
});
