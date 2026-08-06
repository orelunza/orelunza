import { describe, expect, test } from 'vitest';
import { CoastalLandformResolver } from './CoastalLandformResolver';
import { OceanCurrentResolver } from './OceanCurrentResolver';
import { OceanSurfaceModel } from './OceanSurfaceModel';

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

describe('planet Earth Lot 5 oceans and coasts', () => {
	test('resolves stable regional current families by latitude', () => {
		const currents = new OceanCurrentResolver();
		expect(
			currents.resolve({ latitudeRadians: radians(0), longitudeRadians: 0, altitudeMeters: 0 })
				.region
		).toBe('equatorial-westward');
		expect(
			currents.resolve({ latitudeRadians: radians(-60), longitudeRadians: 0, altitudeMeters: 0 })
				.region
		).toBe('antarctic-circumpolar');
		expect(
			currents.resolve({ latitudeRadians: radians(30), longitudeRadians: 1, altitudeMeters: 0 })
				.region
		).toBe('subtropical-gyre');
	});

	test('keeps current vectors normalized and speeds bounded', () => {
		const currents = new OceanCurrentResolver();
		for (let latitude = -85; latitude <= 85; latitude += 5) {
			const sample = currents.resolve({
				latitudeRadians: radians(latitude),
				longitudeRadians: radians(latitude * 2),
				altitudeMeters: 0
			});
			expect(Math.hypot(sample.directionEast, sample.directionNorth)).toBeCloseTo(1, 8);
			expect(sample.speedMetersPerSecond).toBeGreaterThan(0);
			expect(sample.speedMetersPerSecond).toBeLessThanOrEqual(1.5);
		}
	});

	test('separates beaches, cliffs and open ocean', () => {
		const resolver = new CoastalLandformResolver();
		expect(
			resolver.resolve({ land: 1, elevationMeters: 3, coastProximity: 0.92, slope: 0.05 }).landform
		).toBe('beach');
		expect(
			resolver.resolve({ land: 1, elevationMeters: 80, coastProximity: 0.9, slope: 0.92 }).landform
		).toBe('cliff');
		expect(
			resolver.resolve({ land: 0, elevationMeters: -4200, coastProximity: 0.02, slope: 0.1 })
				.landform
		).toBe('open-ocean');
	});

	test('produces deterministic wind and coast-driven wave foam', () => {
		const current = new OceanCurrentResolver().resolve({
			latitudeRadians: radians(10),
			longitudeRadians: radians(30),
			altitudeMeters: 0
		});
		const model = new OceanSurfaceModel();
		const input = {
			xMeters: 120,
			zMeters: -75,
			elapsedSeconds: 18,
			windStrength: 0.7,
			coastProximity: 0.8,
			current
		};
		expect(model.sample(input)).toEqual(model.sample(input));
		expect(model.sample(input).foam).toBeGreaterThan(0.5);
		expect(Math.abs(model.sample(input).waveHeightMeters)).toBeLessThan(1.5);
	});
});
