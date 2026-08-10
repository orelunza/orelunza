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
describe('route save compatibility', () => {
	it('loads a legacy V3 save without a route', () =>
		expect(parseWorldSave(JSON.stringify(base))).not.toBeNull());
	it('preserves an optional planned route without moving the saved player', () => {
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
		expect(save?.player.position.x).toBe(0);
		expect(
			(save as unknown as { routePlan?: typeof routePlan }).routePlan?.destination.worldAnchorId
		).toBe('b');
	});
});
