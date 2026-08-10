import { describe, expect, it } from 'vitest';
import { greatCircleDistanceKm } from './GeographicDistance';

describe('greatCircleDistanceKm', () => {
	it('returns zero for the same location', () =>
		expect(
			greatCircleDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })
		).toBe(0));
	it('returns a sane Kampala to Nairobi distance', () => {
		const distance = greatCircleDistanceKm(
			{ latitude: 0.3476, longitude: 32.5825 },
			{ latitude: -1.2864, longitude: 36.8172 }
		);
		expect(distance).toBeGreaterThan(500);
		expect(distance).toBeLessThan(510);
	});
	it('handles the date line on the short arc', () =>
		expect(
			greatCircleDistanceKm({ latitude: 0, longitude: 179 }, { latitude: 0, longitude: -179 })
		).toBeLessThan(230));
});
