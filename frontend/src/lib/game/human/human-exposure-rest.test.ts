import { describe, expect, it } from 'vitest';
import { BlockRegistry } from '../world/BlockRegistry';
import type { BlockCoordinate, VoxelBlock } from '../world/voxel-types';
import type { PlayerState } from '../player/PlayerState';
import { sampleHumanExposure, type HumanExposureWorldQuery } from './HumanExposure';
import { evaluateSleepEligibility, stepHumanRest } from './HumanRestSystem';

function player(overrides: Partial<PlayerState> = {}): PlayerState {
	return {
		playerId: 'p',
		worldId: 'w',
		position: { x: 0.5, y: 10, z: 0.5 },
		velocity: { x: 0, y: 0, z: 0 },
		yaw: 0,
		pitch: 0,
		onGround: true,
		height: 1.78,
		radius: 0.32,
		cameraYaw: 0,
		bodyYaw: 0,
		desiredMovementYaw: 0,
		headYaw: 0,
		localForwardSpeed: 0,
		localSideSpeed: 0,
		verticalSpeed: 0,
		stepEvent: null,
		mouseLookActive: false,
		cameraRecentering: false,
		...overrides
	};
}

function fakeWorld(solidAt: (position: BlockCoordinate) => boolean): HumanExposureWorldQuery {
	return {
		getLoadedBlock(position: BlockCoordinate): VoxelBlock {
			return BlockRegistry.create(solidAt(position) ? 'brick' : 'air', position);
		}
	};
}

describe('Human exposure and rest', () => {
	it('detects open sky versus a roofed and walled shelter', () => {
		const open = sampleHumanExposure(
			fakeWorld(() => false),
			player(),
			0
		);
		expect(open.sheltered).toBe(false);
		expect(open.skyExposure).toBe(1);
		expect(open.windExposure).toBe(1);

		const enclosed = sampleHumanExposure(
			fakeWorld(({ x, y, z }) => {
				if (x === 0 && z === 0 && y === 13) return true;
				if (y >= 10 && y <= 12 && (Math.abs(x) >= 1 || Math.abs(z) >= 1)) return true;
				return false;
			}),
			player(),
			0
		);
		expect(enclosed.skyExposure).toBe(0);
		expect(enclosed.windExposure).toBeLessThanOrEqual(0.72);
		expect(enclosed.sheltered).toBe(true);
	});

	it('requires shelter and dry breathing space before sleep', () => {
		expect(
			evaluateSleepEligibility({
				onGround: true,
				underwater: false,
				sheltered: false,
				lifeState: 'alive',
				bodyTemperatureCelsius: 37
			})
		).toEqual({ canSleep: false, reason: 'needs-shelter' });

		expect(
			evaluateSleepEligibility({
				onGround: true,
				underwater: false,
				sheltered: true,
				lifeState: 'alive',
				bodyTemperatureCelsius: 37
			})
		).toEqual({ canSleep: true, reason: null });
	});

	it('builds fatigue while active and recovers it while sleeping', () => {
		let fatigue = 20;
		for (let i = 0; i < 600; i += 1) {
			fatigue = stepHumanRest(fatigue, 1, {
				moving: true,
				sprinting: true,
				jumping: false,
				onGround: true,
				underwater: false,
				sheltered: false,
				lifeState: 'alive',
				bodyTemperatureCelsius: 37,
				sleeping: false
			}).fatigue;
		}
		expect(fatigue).toBeGreaterThan(20);

		const beforeSleep = fatigue;
		for (let i = 0; i < 600; i += 1) {
			fatigue = stepHumanRest(fatigue, 1, {
				moving: false,
				sprinting: false,
				jumping: false,
				onGround: true,
				underwater: false,
				sheltered: true,
				lifeState: 'alive',
				bodyTemperatureCelsius: 37,
				sleeping: true
			}).fatigue;
		}
		expect(fatigue).toBeLessThan(beforeSleep);
	});
});
