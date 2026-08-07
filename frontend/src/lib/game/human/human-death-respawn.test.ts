import { describe, expect, it } from 'vitest';
import { humanDamageCauseLabel, RESPAWN_PROTECTION_SECONDS } from './HumanDeathSystem';
import { deriveHumanFeedback } from './HumanFeedback';
import { HumanConditionSystem } from './HumanConditionSystem';
import { isHumanConditionSaveState } from './HumanConditionState';
import type { PlayerState } from '../player/PlayerState';

function player(): PlayerState {
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
		cameraRecentering: false
	};
}

function step(system: HumanConditionSystem, seconds = 0.1) {
	return system.update(seconds, {
		player: player(),
		movement: { forward: 0, right: 0, jump: false, sprint: false },
		environment: {
			temperatureCelsius: 20,
			windChillCelsius: 20,
			rainIntensity: 0,
			snowIntensity: 0,
			windStrength: 0,
			daylight: 0.7,
			humidity: 0.4
		},
		exposure: {
			sheltered: false,
			skyExposure: 1,
			windExposure: 1,
			precipitationExposure: 1,
			nearbyHeatCelsius: 0
		},
		water: { waterSurfaceY: null, waterDepth: 0 },
		headObstructed: false
	});
}

describe('Human death, feedback and respawn', () => {
	it('captures the fatal cause exactly once', () => {
		const system = new HumanConditionSystem();
		const debug = system.createDebugApi();
		debug.damage(96, 'fall');
		expect(system.snapshot.lifeState).toBe('unconscious');
		debug.damage(4, 'bleeding');
		expect(system.snapshot.lifeState).toBe('dead');
		expect(system.snapshot.lastDeathCause).toBe('bleeding');
		expect(system.snapshot.deathCount).toBe(1);
		debug.damage(100, 'drowning');
		expect(system.snapshot.lastDeathCause).toBe('bleeding');
		expect(system.snapshot.deathCount).toBe(1);
	});

	it('respawns healthy, clears active conditions and grants temporary protection', () => {
		const system = new HumanConditionSystem();
		const debug = system.createDebugApi();
		debug.injure('wound', 0.8);
		debug.expose('infection', 1.2);
		debug.damage(100, 'wound');
		expect(system.snapshot.lifeState).toBe('dead');

		expect(system.respawn()).toBe(true);
		expect(system.snapshot.lifeState).toBe('alive');
		expect(system.snapshot.health).toBe(100);
		expect(system.snapshot.injuries).toHaveLength(0);
		expect(system.snapshot.illnesses).toHaveLength(0);
		expect(system.snapshot.respawnProtectionSeconds).toBe(RESPAWN_PROTECTION_SECONDS);
		expect(system.snapshot.lastDeathCause).toBe('wound');

		debug.damage(100, 'fall');
		expect(system.snapshot.health).toBe(100);
		for (let index = 0; index < 25; index += 1) step(system, 0.25);
		expect(system.snapshot.respawnProtectionSeconds).toBe(0);
		debug.damage(10, 'fall');
		expect(system.snapshot.health).toBe(90);
	});

	it('persists death history in V4 while keeping V3 saves valid', () => {
		const system = new HumanConditionSystem();
		system.createDebugApi().damage(100, 'drowning');
		const save = system.serialize();
		expect(save.version).toBe(4);
		expect(isHumanConditionSaveState(save)).toBe(true);
		if (save.version !== 4) throw new Error('expected V4');
		expect(save.lastDeathCause).toBe('drowning');
		expect(save.deathCount).toBe(1);

		expect(
			isHumanConditionSaveState({
				version: 3,
				health: 80,
				oxygen: 100,
				nutrition: 90,
				hydration: 90,
				stamina: 90,
				fatigue: 20,
				bodyTemperatureCelsius: 37,
				wetness: 0,
				lifeState: 'alive',
				sleeping: false,
				lastDamageCause: null,
				injuries: [],
				illnesses: [],
				exposureLoads: {
					'food-poisoning': 0,
					'waterborne-illness': 0,
					infection: 0
				},
				conditionSequence: 0
			})
		).toBe(true);
	});

	it('derives restrained visual feedback without changing body state', () => {
		const system = new HumanConditionSystem();
		const debug = system.createDebugApi();
		debug.damage(70, 'fall');
		const before = system.snapshot.health;
		const feedback = deriveHumanFeedback(system.snapshot);
		expect(feedback.lowHealth).toBeGreaterThan(0);
		expect(system.snapshot.health).toBe(before);
		expect(humanDamageCauseLabel('hypothermia')).toBe('Hypothermia');
	});
});
