import { describe, expect, it } from 'vitest';
import { BoundedCellCache, visibleCells } from './MapSpatialCells';

describe('map spatial cells', () => {
	it('keeps visible date-line cells bounded', () => {
		const cells = visibleCells({ west: 170, east: -170, south: -10, north: 10 }, 5, 96);
		expect(cells.length).toBeLessThanOrEqual(96);
		expect(new Set(cells.map((cell) => cell.x)).size).toBeGreaterThan(1);
	});
	it('bounds cache and evicts distant cells', () => {
		const cache = new BoundedCellCache<number>(3);
		for (let x = 0; x < 5; x += 1) cache.set({ level: 2, x, y: 0 }, x);
		expect(cache.size).toBe(3);
		cache.retain([{ level: 2, x: 4, y: 0 }]);
		expect(cache.size).toBeLessThanOrEqual(2);
	});
});
