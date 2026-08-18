import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from './GameEngine';

const origin = {
	countryId: 'A',
	countryName: 'A',
	settlementId: 'A',
	settlementName: 'A',
	latitude: 0,
	longitude: 0,
	elevationMeters: 0,
	worldAnchorId: 'A'
};

const destinationRequest = {
	coordinate: { latitudeRadians: 0.25, longitudeRadians: 0.5, altitudeMeters: 10 },
	elevationMeters: 10,
	countryId: 'B',
	countryName: 'B',
	settlementId: 'B',
	settlementName: 'B',
	totalDistanceKm: 42
};

describe('GameEngine destination selection', () => {
	it('sets a destination without moving the player or creating a route', () => {
		const engine = Object.create(GameEngine.prototype) as any;
		const sessionA = { id: 'A' };
		engine.status = 'world-map';
		engine.activeSession = sessionA;
		engine.navigationDestination = null;
		engine.travelPlan = null;
		engine.persistence = { markDirty: vi.fn() };
		engine.emitSnapshot = vi.fn();
		engine.travelToPlanet = vi.fn();

		engine.setNavigationDestination(destinationRequest);

		expect(engine.activeSession).toBe(sessionA);
		expect(engine.travelToPlanet).not.toHaveBeenCalled();
		expect(engine.navigationDestination.location.worldAnchorId).toBe('B');
		expect(engine.navigationDestination.directDistanceKm).toBe(42);
		expect(engine.travelPlan).toBeNull();
		expect(engine.status).toBe('world-map');
		expect(engine.persistence.markDirty).toHaveBeenCalledOnce();
	});

	it('keeps the same destination while moving between map and globe', () => {
		const engine = Object.create(GameEngine.prototype) as any;
		const destination = { location: { ...origin, worldAnchorId: 'B' }, directDistanceKm: 5 };
		engine.status = 'world-map';
		engine.navigationDestination = destination;
		engine.pointerLock = { exit: vi.fn(), request: vi.fn() };
		engine.emitSnapshot = vi.fn();

		engine.openGlobe();
		expect(engine.status).toBe('globe');
		expect(engine.navigationDestination).toBe(destination);

		engine.closeWorldMap();
		expect(engine.status).toBe('playing');
		expect(engine.navigationDestination).toBe(destination);
	});

	it('replaces a destination directly from the 2D world map', () => {
		const engine = Object.create(GameEngine.prototype) as any;
		engine.status = 'world-map';
		engine.navigationDestination = {
			location: { ...origin, worldAnchorId: 'old' },
			directDistanceKm: 1
		};
		engine.travelPlan = null;
		engine.persistence = { markDirty: vi.fn() };
		engine.emitSnapshot = vi.fn();

		engine.setNavigationDestination(destinationRequest);

		expect(engine.navigationDestination.location.countryName).toBe('B');
		expect(engine.navigationDestination.directDistanceKm).toBe(42);
		expect(engine.status).toBe('world-map');
	});

	it('clears the destination without moving the player', () => {
		const engine = Object.create(GameEngine.prototype) as any;
		const sessionA = { id: 'A' };
		engine.status = 'world-map';
		engine.activeSession = sessionA;
		engine.navigationDestination = {
			location: { ...origin, worldAnchorId: 'B' },
			directDistanceKm: 5
		};
		engine.travelPlan = null;
		engine.persistence = { markDirty: vi.fn() };
		engine.emitSnapshot = vi.fn();

		engine.clearNavigationDestination();

		expect(engine.activeSession).toBe(sessionA);
		expect(engine.navigationDestination).toBeNull();
		expect(engine.travelPlan).toBeNull();
		expect(engine.persistence.markDirty).toHaveBeenCalledOnce();
	});
});
