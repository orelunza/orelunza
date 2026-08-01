import { describe, expect, it, vi } from 'vitest';

import type { MoveHumanRequest, WorldPlace } from '$lib/api/contracts/world';

import { InteractionSystem } from '$lib/world/systems/InteractionSystem';
import { MovementSystem } from '$lib/world/systems/MovementSystem';
import { PositionSyncSystem } from '$lib/world/systems/PositionSyncSystem';

const bounds = {
	x: 0,
	y: 0,
	width: 100,
	height: 100
};

function place(id: string, x: number, y: number): WorldPlace {
	return {
		id,
		region_id: 'region-green',
		name: id,
		description: '',
		type: 'garden',
		position_x: x,
		position_y: y,
		enabled: true,
		created_at: 1,
		updated_at: 1
	};
}

function moveRequest(x: number, y: number): MoveHumanRequest {
	return {
		region_id: 'region-green',
		place_id: null,
		position_x: x,
		position_y: y
	};
}

describe('MovementSystem', () => {
	it('normalizes diagonal movement', () => {
		const movement = new MovementSystem({
			initialPosition: { x: 50, y: 50 },
			bounds,
			speed: 100
		});

		const position = movement.step({
			direction: { x: 1, y: 1 },
			deltaMS: 1000
		});

		expect(position.x).toBeCloseTo(100);
		expect(position.y).toBeCloseTo(100);
	});

	it('clamps movement to world bounds', () => {
		const movement = new MovementSystem({
			initialPosition: { x: 95, y: 95 },
			bounds,
			speed: 100
		});

		const position = movement.step({
			direction: { x: 1, y: 1 },
			deltaMS: 1000
		});

		expect(position).toEqual({ x: 100, y: 100 });
	});

	it('moves toward a clicked destination and stops near it', () => {
		const stops = vi.fn();
		const movement = new MovementSystem({
			initialPosition: { x: 10, y: 10 },
			bounds,
			speed: 50,
			destinationTolerance: 2,
			onMovementStop: stops
		});

		movement.setDestination({ x: 60, y: 10 });

		expect(movement.destination).toEqual({ x: 60, y: 10 });

		movement.step({ direction: { x: 0, y: 0 }, deltaMS: 500 });
		expect(movement.position.x).toBeCloseTo(35);
		expect(movement.isMoving).toBe(true);

		movement.step({ direction: { x: 0, y: 0 }, deltaMS: 1000 });

		expect(movement.position).toEqual({ x: 60, y: 10 });
		expect(movement.destination).toBeNull();
		expect(movement.isMoving).toBe(false);
		expect(stops).toHaveBeenCalledTimes(1);
	});
});

describe('InteractionSystem', () => {
	it('detects the nearest nearby place', () => {
		const library = place('library', 50, 50);
		const garden = place('garden', 80, 50);
		const interaction = new InteractionSystem({
			places: [library, garden],
			interactionRadius: 40
		});

		const state = interaction.evaluate({ x: 55, y: 50 });

		expect(state.nearbyPlace?.id).toBe('library');
		expect(state.canInteract).toBe(true);
		expect(state.distanceToNearbyPlace).toBeCloseTo(5);
	});
});

describe('PositionSyncSystem', () => {
	it('limits sync frequency', async () => {
		let now = 0;
		let scheduled: (() => void) | undefined;
		const sync = vi.fn<(request: MoveHumanRequest) => Promise<void>>().mockResolvedValue(undefined);
		const system = new PositionSyncSystem({
			sync,
			minIntervalMs: 1000,
			now: () => now,
			setTimer: (handler) => {
				scheduled = handler;
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
			clearTimer: () => {
				scheduled = undefined;
			}
		});

		system.notePosition(moveRequest(10, 10));
		await system.flush();

		system.notePosition(moveRequest(30, 10));

		expect(sync).toHaveBeenCalledTimes(1);
		expect(scheduled).not.toBeNull();

		now = 1000;
		const runScheduled = scheduled;
		expect(runScheduled).toBeDefined();
		runScheduled?.();
		await Promise.resolve();
		await Promise.resolve();

		expect(sync).toHaveBeenCalledTimes(2);
	});

	it('does not sync when the position did not materially change', async () => {
		const sync = vi.fn().mockResolvedValue(undefined);
		const system = new PositionSyncSystem({
			sync,
			minIntervalMs: 0,
			minDistance: 5
		});

		system.notePosition(moveRequest(10, 10));
		await system.flush();

		system.notePosition(moveRequest(12, 12));
		await system.flush();

		expect(sync).toHaveBeenCalledTimes(1);
	});
});
