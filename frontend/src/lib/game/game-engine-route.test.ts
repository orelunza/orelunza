import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from './GameEngine';

describe('GameEngine normal route planning', () => {
	it('plans B without activating a destination session', () => {
		const engine = Object.create(GameEngine.prototype) as any;
		const sessionA = { id: 'A' };
		engine.status = 'globe';
		engine.activeSession = sessionA;
		engine.travelPlan = null;
		engine.worldLocation = () => ({
			countryId: 'A',
			countryName: 'A',
			settlementId: 'A',
			settlementName: 'A',
			latitude: 0,
			longitude: 0,
			elevationMeters: 0,
			worldAnchorId: 'A'
		});
		engine.emitSnapshot = vi.fn();
		engine.travelToPlanet = vi.fn();
		engine.planRoute({
			coordinate: { latitudeRadians: 0, longitudeRadians: 1, altitudeMeters: 0 },
			elevationMeters: 0,
			countryId: 'B',
			countryName: 'B',
			settlementId: 'B',
			settlementName: 'B',
			totalDistanceKm: 100
		});
		expect(engine.activeSession).toBe(sessionA);
		expect(engine.travelToPlanet).not.toHaveBeenCalled();
		expect(engine.travelPlan.origin.worldAnchorId).toBe('A');
		expect(engine.travelPlan.destination.worldAnchorId).toBe('B');
		expect(engine.travelPlan.status).toBe('planned');
		expect(engine.status).toBe('world-map');
	});
	it('keeps the same plan while moving between Map and Globe', () => {
		const engine = Object.create(GameEngine.prototype) as any;
		const plan = { id: 'A:B' };
		engine.status = 'world-map';
		engine.travelPlan = plan;
		engine.pointerLock = { exit: vi.fn(), request: vi.fn() };
		engine.emitSnapshot = vi.fn();
		engine.openGlobe();
		expect(engine.status).toBe('globe');
		expect(engine.travelPlan).toBe(plan);
		engine.closeWorldMap();
		expect(engine.status).toBe('playing');
		expect(engine.travelPlan).toBe(plan);
	});
});
