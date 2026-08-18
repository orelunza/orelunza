import { describe, expect, it } from 'vitest';
import { PlanetCoordinateSystem } from '../../planet/PlanetCoordinateSystem';
import {
	ConstantPlanetSurfaceElevationSource,
	PlanetSurfaceSpawnResolver
} from '../../planet/surface/PlanetSurfaceSpawnResolver';
import type { PlanetTravelRequest } from '../../planet/surface/PlanetTravelRequest';
import { RemoteSurfaceSession } from './RemoteSurfaceSession';

const LOCATION: PlanetTravelRequest = {
	coordinate: {
		latitudeRadians: 0.01,
		longitudeRadians: 0.02,
		altitudeMeters: 120
	},
	elevationMeters: 120,
	countryId: 'test',
	countryName: 'Test Country'
};

describe('RemoteSurfaceSession', () => {
	it('prepares planetary terrain without creating a player world session', async () => {
		const resolver = new PlanetSurfaceSpawnResolver(
			new PlanetCoordinateSystem(),
			new ConstantPlanetSurfaceElevationSource({
				elevationMeters: 120,
				land: 1,
				bathymetryMeters: 0,
				coastProximity: 0
			})
		);
		const session = new RemoteSurfaceSession(resolver);

		const region = await session.prepare(LOCATION, {
			halfExtentMeters: 64,
			resolution: 5,
			chunkRadius: 1
		});

		expect(region.destination.status).toBe('land');
		expect(region.generator.anchor.coordinate.latitudeRadians).toBeCloseTo(
			LOCATION.coordinate.latitudeRadians
		);
		expect(region.bridge.world.getLoadedChunks().length).toBeGreaterThan(0);
		expect(region.ecology.zoneName).not.toBe('Central City');
		session.dispose();
	});

	it('rejects unreasonable preview radii', async () => {
		const resolver = new PlanetSurfaceSpawnResolver(
			new PlanetCoordinateSystem(),
			new ConstantPlanetSurfaceElevationSource({
				elevationMeters: 50,
				land: 1,
				bathymetryMeters: 0,
				coastProximity: 0
			})
		);
		const session = new RemoteSurfaceSession(resolver);

		await expect(session.prepare(LOCATION, { chunkRadius: 8 })).rejects.toThrow(RangeError);
		session.dispose();
	});
});
