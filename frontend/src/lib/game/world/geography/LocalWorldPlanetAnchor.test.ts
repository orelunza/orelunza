import { describe, expect, it } from 'vitest';
import { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import {
	createLocalWorldPlanetAnchor,
	geographicLocationFromLocalAnchor,
	restoreLocalWorldPlanetAnchor,
	serializeLocalWorldPlanetAnchor
} from './LocalWorldPlanetAnchor';

describe('LocalWorldPlanetAnchor', () => {
	it('maps the local origin exactly to the selected Earth position', () => {
		const planet = new PlanetCoordinateSystem();
		const anchor = createLocalWorldPlanetAnchor(
			planet,
			{
				coordinate: {
					latitudeRadians: (0.3476 * Math.PI) / 180,
					longitudeRadians: (32.5825 * Math.PI) / 180,
					altitudeMeters: 1190
				},
				elevationMeters: 1190,
				countryName: 'Uganda',
				settlementName: 'Kampala'
			},
			{ x: 12, y: 8, z: -4 }
		);
		const location = geographicLocationFromLocalAnchor(anchor, { x: 12, y: 8, z: -4 });
		expect(location.latitude).toBeCloseTo(0.3476, 5);
		expect(location.longitude).toBeCloseTo(32.5825, 5);
		expect(location.elevationMeters).toBeCloseTo(1190, 2);
		expect(location.countryName).toBe('Uganda');
	});

	it('preserves the anchor through save and restore', () => {
		const planet = new PlanetCoordinateSystem();
		const anchor = createLocalWorldPlanetAnchor(
			planet,
			{
				coordinate: { latitudeRadians: 0.1, longitudeRadians: 0.2, altitudeMeters: 500 },
				elevationMeters: 500,
				countryName: 'Test'
			},
			{ x: 3, y: 4, z: 5 }
		);
		const restored = restoreLocalWorldPlanetAnchor(planet, serializeLocalWorldPlanetAnchor(anchor));
		expect(restored.localOrigin.toArray()).toEqual([3, 4, 5]);
		expect(restored.countryName).toBe('Test');
		expect(restored.surface.id).toBe(anchor.surface.id);
	});
});
