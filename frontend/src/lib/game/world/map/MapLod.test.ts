import { describe, expect, it } from 'vitest';
import { lodFeatures } from './MapLod';

describe('map LOD', () => {
	it('excludes local roads and buildings far away', () => {
		const far = lodFeatures(3);
		expect(far.roads).toBe(false);
		expect(far.buildings).toBe(false);
	});
	it('permits authoritative close city features only at close zoom', () => {
		const medium = lodFeatures(8),
			close = lodFeatures(13);
		expect(medium.roads).toBe(true);
		expect(medium.buildings).toBe(false);
		expect(close.buildings).toBe(true);
	});
	it('keeps country reference geography visible at every zoom level', () => {
		expect(lodFeatures(3).countries).toBe(true);
		expect(lodFeatures(8).countries).toBe(true);
		expect(lodFeatures(13).countries).toBe(true);
	});
});
