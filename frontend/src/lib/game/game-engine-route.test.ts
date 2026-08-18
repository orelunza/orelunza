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

function mapCapableEngine() {
	const engine = Object.create(GameEngine.prototype) as any;
	engine.pointerLock = { exit: vi.fn(), request: vi.fn() };
	engine.lastMiniMapAt = 0;
	engine.updateMiniMap = vi.fn();
	engine.persistence = { markDirty: vi.fn() };
	engine.emitSnapshot = vi.fn();
	return engine;
}

describe('GameEngine destination selection', () => {
	it('sets a destination without moving the player and opens the local map', () => {
		const engine = mapCapableEngine();
		const sessionA = { id: 'A' };
		engine.status = 'globe';
		engine.activeSession = sessionA;
		engine.currentGeographicLocation = origin;
		engine.navigationDestination = null;
		engine.travelPlan = null;
		engine.travelToPlanet = vi.fn();

		engine.setNavigationDestination(destinationRequest);

		expect(engine.activeSession).toBe(sessionA);
		expect(engine.travelToPlanet).not.toHaveBeenCalled();
		expect(engine.navigationDestination.location.worldAnchorId).toBe('B');
		expect(engine.navigationDestination.directDistanceKm).toBe(42);
		expect(engine.travelPlan).toBeNull();
		expect(engine.status).toBe('world-map');
		expect(engine.pointerLock.exit).toHaveBeenCalledOnce();
		expect(engine.updateMiniMap).toHaveBeenCalledOnce();
		expect(engine.persistence.markDirty).toHaveBeenCalledOnce();
	});

	it('keeps the same destination while moving between local map and globe', () => {
		const engine = mapCapableEngine();
		const destination = { location: { ...origin, worldAnchorId: 'B' }, directDistanceKm: 5 };
		engine.status = 'world-map';
		engine.navigationDestination = destination;

		engine.openGlobe();
		expect(engine.status).toBe('globe');
		expect(engine.navigationDestination).toBe(destination);

		engine.openWorldMap();
		expect(engine.status).toBe('world-map');
		expect(engine.navigationDestination).toBe(destination);
	});

	it('replaces a destination and returns to the local map', () => {
		const engine = mapCapableEngine();
		engine.status = 'globe';
		engine.currentGeographicLocation = origin;
		engine.navigationDestination = {
			location: { ...origin, worldAnchorId: 'old' },
			directDistanceKm: 1
		};
		engine.travelPlan = null;

		engine.setNavigationDestination(destinationRequest);

		expect(engine.navigationDestination.location.countryName).toBe('B');
		expect(engine.navigationDestination.directDistanceKm).toBe(42);
		expect(engine.status).toBe('world-map');
	});

	it('does not invent a 0,0 origin when the local world is not anchored', () => {
		const engine = mapCapableEngine();
		engine.status = 'globe';
		engine.currentGeographicLocation = null;
		engine.navigationDestination = null;
		engine.travelPlan = null;

		engine.setNavigationDestination({
			...destinationRequest,
			totalDistanceKm: undefined
		});

		expect(engine.navigationDestination.directDistanceKm).toBeNull();
		expect(engine.status).toBe('world-map');
	});

	it('clears the destination without moving the player', () => {
		const engine = mapCapableEngine();
		const sessionA = { id: 'A' };
		engine.status = 'world-map';
		engine.activeSession = sessionA;
		engine.navigationDestination = {
			location: { ...origin, worldAnchorId: 'B' },
			directDistanceKm: 5
		};
		engine.travelPlan = null;

		engine.clearNavigationDestination();

		expect(engine.activeSession).toBe(sessionA);
		expect(engine.navigationDestination).toBeNull();
		expect(engine.travelPlan).toBeNull();
		expect(engine.persistence.markDirty).toHaveBeenCalledOnce();
	});
});
