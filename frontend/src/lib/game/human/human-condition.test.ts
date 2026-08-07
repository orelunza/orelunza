import { describe, expect, it } from 'vitest';
import { fallDamageForImpactSpeed } from './HumanDamageSystem';
import { HumanConditionSystem, type HumanWaterInput } from './HumanConditionSystem';
import { stepRespiration } from './HumanRespiration';
import { isHumanConditionSaveState } from './HumanConditionState';
import type { HumanExposureSnapshot } from './HumanExposure';
import type { PlayerState } from '../player/PlayerState';

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

const movement = { forward: 0, right: 0, jump: false, sprint: false };
const environment = {
	temperatureCelsius: 20,
	windChillCelsius: 20,
	rainIntensity: 0,
	snowIntensity: 0,
	windStrength: 0.2,
	daylight: 0.7,
	humidity: 0.4
};
const exposure: HumanExposureSnapshot = {
	sheltered: false,
	skyExposure: 1,
	windExposure: 1,
	precipitationExposure: 1,
	nearbyHeatCelsius: 0
};
const dry: HumanWaterInput = { waterSurfaceY: null, waterDepth: 0 };

function step(
	system: HumanConditionSystem,
	state: PlayerState,
	seconds = 0.1,
	water: HumanWaterInput = dry,
	exposureInput: HumanExposureSnapshot = exposure
): void {
	system.update(seconds, {
		player: state,
		movement,
		environment,
		exposure: exposureInput,
		water,
		headObstructed: false
	});
}

describe('HumanConditionSystem', () => {
	it('keeps normal jumps safe but damages a hard landing', () => {
		expect(fallDamageForImpactSpeed(9)).toBe(0);
		expect(fallDamageForImpactSpeed(18)).toBeGreaterThan(20);
		const system = new HumanConditionSystem();
		step(system, player());
		step(system, player({ onGround: false, verticalSpeed: -18, velocity: { x: 0, y: -18, z: 0 } }));
		step(system, player({ onGround: true, verticalSpeed: 0 }));
		expect(system.snapshot.health).toBeLessThan(100);
		expect(system.snapshot.lastDamageCause).toBe('fall');
	});

	it('drains oxygen underwater and causes drowning only after oxygen is exhausted', () => {
		const breathing = stepRespiration(100, 1, { underwater: true, headObstructed: false });
		expect(breathing.oxygen).toBe(95);
		expect(breathing.healthDamage).toBe(0);
		const exhausted = stepRespiration(1, 1, { underwater: true, headObstructed: false });
		expect(exhausted.oxygen).toBe(0);
		expect(exhausted.healthDamage).toBeGreaterThan(0);
		expect(exhausted.cause).toBe('drowning');
	});

	it('detects the eyes below the physical water surface', () => {
		const system = new HumanConditionSystem();
		const state = player({ position: { x: 0.5, y: 10, z: 0.5 } });
		step(system, state, 0.1, { waterSurfaceY: 12, waterDepth: 3 });
		expect(system.snapshot.underwater).toBe(true);
		step(system, state, 0.1, { waterSurfaceY: 10.5, waterDepth: 1.5 });
		expect(system.snapshot.underwater).toBe(false);
	});

	it('persists the complete body state and keeps older worlds compatible', () => {
		const system = new HumanConditionSystem();
		system.createDebugApi().damage(20, 'fall');
		system.createDebugApi().setHydration(63);
		system.createDebugApi().setFatigue(61);
		const save = system.serialize();
		expect(isHumanConditionSaveState(save)).toBe(true);
		const restored = new HumanConditionSystem();
		restored.restore(save);
		expect(restored.snapshot.health).toBe(80);
		expect(restored.snapshot.hydration).toBe(63);
		expect(restored.snapshot.fatigue).toBe(61);
		expect(save.version).toBe(4);
		const fresh = new HumanConditionSystem();
		fresh.restore(undefined);
		expect(fresh.snapshot.health).toBe(100);
	});

	it('sleeps only when grounded and sheltered and wakes on request', () => {
		const system = new HumanConditionSystem();
		system.createDebugApi().setFatigue(70);
		system.requestSleepToggle();
		step(system, player(), 0.1, dry, { ...exposure, sheltered: false });
		expect(system.snapshot.sleeping).toBe(false);
		expect(system.snapshot.sleepBlockedReason).toBe('needs-shelter');

		system.requestSleepToggle();
		step(system, player(), 0.1, dry, {
			...exposure,
			sheltered: true,
			skyExposure: 0,
			windExposure: 0.2,
			precipitationExposure: 0
		});
		expect(system.snapshot.sleeping).toBe(true);
		expect(system.canAct).toBe(false);

		system.requestSleepToggle();
		expect(system.snapshot.sleeping).toBe(false);
		expect(system.canAct).toBe(true);
	});

	it('uses critical, unconscious and dead life states', () => {
		const system = new HumanConditionSystem();
		system.createDebugApi().damage(80);
		step(system, player());
		expect(system.snapshot.lifeState).toBe('critical');
		system.createDebugApi().damage(15);
		step(system, player());
		expect(system.snapshot.lifeState).toBe('unconscious');
		system.createDebugApi().damage(5);
		step(system, player());
		expect(system.snapshot.lifeState).toBe('dead');
		expect(system.canAct).toBe(false);
	});
});
