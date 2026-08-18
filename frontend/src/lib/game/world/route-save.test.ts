import { describe, expect, it } from 'vitest';
import { parseWorldSave } from './WorldSave';

const base = {
	version: 3,
	worldId: 'a',
	seed: 's',
	player: { playerId: 'p', worldId: 'a', position: { x: 0, y: 2, z: 0 }, yaw: 0, pitch: 0 },
	character: {},
	inventory: {},
	placedBlocks: [],
	removedBlocks: [],
	changes: [],
	environment: {},
	updatedAt: 1
};

describe('navigation save compatibility', () => {
	it('loads a legacy V3 save without a destination or route', () => {
		expect(parseWorldSave(JSON.stringify(base))).not.toBeNull();
	});

	it('preserves a destination independently from player position', () => {
		const navigationDestination = {
			location: {
				countryId: 'b',
				countryName: 'B',
				settlementId: 'b',
				settlementName: 'B',
				latitude: 1,
				longitude: 2,
				elevationMeters: 3,
				worldAnchorId: 'b'
			},
			directDistanceKm: 222
		};
		const save = parseWorldSave(JSON.stringify({ ...base, navigationDestination }));
		expect(save?.player.position.x).toBe(0);
		expect(
			(save as unknown as { navigationDestination?: typeof navigationDestination })
				.navigationDestination?.location.worldAnchorId
		).toBe('b');
	});

	it('still accepts the old optional planned-route field for migration', () => {
		const routePlan = {
			id: 'a:b',
			origin: { worldAnchorId: 'a' },
			destination: { worldAnchorId: 'b' },
			totalDistanceKm: 1,
			travelledDistanceKm: 0,
			remainingDistanceKm: 1,
			progress: 0,
			status: 'planned',
			segments: [],
			transportMode: 'walking'
		};
		const save = parseWorldSave(JSON.stringify({ ...base, routePlan }));
		expect(
			(save as unknown as { routePlan?: typeof routePlan }).routePlan?.destination.worldAnchorId
		).toBe('b');
	});
	it('accepts the persisted anchor of a local world', () => {
		const localWorldPlanetAnchor = {
			version: 1,
			surface: {
				version: 1,
				id: 'earth/face:0/16/1/1',
				latitudeRadians: 0.1,
				longitudeRadians: 0.2,
				referenceElevationMeters: 1000,
				level: 16
			},
			localOrigin: { x: 10, y: 20, z: 30 },
			countryId: 'UGA',
			countryName: 'Uganda',
			settlementId: 'kampala',
			settlementName: 'Kampala',
			biomeName: 'Tropical Savanna'
		};
		const save = parseWorldSave(JSON.stringify({ ...base, localWorldPlanetAnchor }));
		expect(
			(save as unknown as { localWorldPlanetAnchor?: typeof localWorldPlanetAnchor })
				.localWorldPlanetAnchor?.countryName
		).toBe('Uganda');
	});
});
