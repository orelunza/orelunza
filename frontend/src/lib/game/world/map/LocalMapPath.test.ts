import { describe, expect, it } from 'vitest';
import { findLocalMapPath, localMapTarget } from './LocalMapPath';

function mapWithWaterBarrier() {
	const size = 9;
	const cells = [];
	for (let z = 0; z < size; z += 1) {
		for (let x = 0; x < size; x += 1) {
			cells.push({
				x,
				z,
				terrain: x === 5 && z < 7 ? ('water' as const) : ('land' as const),
				elevationMeters: 10
			});
		}
	}
	return { size, cellSizeMeters: 100, cells, playerYaw: 0, northRadians: 0, zoneName: 'Test' };
}

describe('LocalMapPath', () => {
	it('clips a distant destination to the local map edge', () => {
		const target = localMapTarget({ size: 9, cellSizeMeters: 100 }, 5000, 2000);
		expect(target.inside).toBe(false);
		expect(target.x).toBe(7);
	});

	it('finds a land path around local water instead of drawing through it', () => {
		const map = mapWithWaterBarrier();
		const path = findLocalMapPath(map, { x: 7, z: 4, inside: true });
		expect(path.length).toBeGreaterThan(0);
		expect(path.some((point) => point.x === 5 && point.z < 7)).toBe(false);
		expect(path.at(-1)).toEqual({ x: 7, z: 4 });
	});
});
