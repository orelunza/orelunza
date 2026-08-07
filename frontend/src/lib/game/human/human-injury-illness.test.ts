import { describe, expect, it } from 'vitest';
import { deriveHumanEffects } from './HumanEffects';
import { addIllnessExposure, createHumanIllness, stepHumanIllnesses } from './HumanIllnessSystem';
import {
	applyFirstAid,
	createHumanInjury,
	injuryForFallDamage,
	stepHumanInjuries
} from './HumanInjurySystem';
import {
	createHumanConditionSnapshot,
	createHumanIllnessExposureLoads,
	isHumanConditionSaveState
} from './HumanConditionState';
import { HumanConditionSystem } from './HumanConditionSystem';
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

function step(system: HumanConditionSystem, state = player(), seconds = 0.1): void {
	system.update(seconds, {
		player: state,
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

describe('Human injuries, illnesses and care', () => {
	it('turns only substantial falls into persistent injuries', () => {
		expect(injuryForFallDamage(7, 'injury-1')).toBeNull();
		expect(injuryForFallDamage(18, 'injury-2')?.kind).toBe('minor-fall');
		expect(injuryForFallDamage(55, 'injury-3')?.kind).toBe('severe-fall');
	});

	it('makes wounds bleed gradually and first aid controls rather than erases the injury', () => {
		const wound = createHumanInjury('wound', 1, 'injury-1', 'test');
		const untreated = stepHumanInjuries([wound], 1, {
			healingMultiplier: 1,
			sleeping: false
		});
		expect(untreated.healthDamage).toBeGreaterThan(0);
		expect(untreated.bleedingRate).toBeGreaterThan(0);

		const cared = applyFirstAid([wound]);
		expect(cared.treated).toBe(true);
		expect(cared.injuries[0]?.treated).toBe(true);
		expect(cared.injuries[0]?.healingProgress).toBe(0);
		const afterCare = stepHumanInjuries(cared.injuries, 1, {
			healingMultiplier: 1,
			sleeping: false
		});
		expect(afterCare.bleedingRate).toBeLessThan(untreated.bleedingRate);
	});

	it('accumulates exposure instead of making every contaminated contact an illness', () => {
		let loads = createHumanIllnessExposureLoads();
		let exposure = addIllnessExposure(loads, 'waterborne-illness', 0.4);
		loads = exposure.loads;
		expect(exposure.triggeredSeverity).toBeNull();
		exposure = addIllnessExposure(loads, 'waterborne-illness', 0.4);
		loads = exposure.loads;
		expect(exposure.triggeredSeverity).toBeNull();
		exposure = addIllnessExposure(loads, 'waterborne-illness', 0.4);
		expect(exposure.triggeredSeverity).not.toBeNull();
		expect(exposure.loads['waterborne-illness']).toBeCloseTo(0.2, 6);
	});

	it('progresses illness through incubation, symptoms and recovery', () => {
		let illnesses = [createHumanIllness('food-poisoning', 0.8, 'illness-1', 'test')];
		for (let second = 0; second < 601; second += 1) {
			illnesses = stepHumanIllnesses(illnesses, 1, 1).illnesses;
		}
		expect(illnesses[0]?.stage).toBe('symptomatic');
		const symptomatic = stepHumanIllnesses(illnesses, 1, 1);
		expect(symptomatic.hydrationDrain).toBeGreaterThan(0);
		expect(symptomatic.feverCelsius).toBeGreaterThan(0);
		expect(symptomatic.staminaPenalty).toBeGreaterThan(0);

		illnesses = symptomatic.illnesses;
		for (let second = 0; second < 2700; second += 1) {
			illnesses = stepHumanIllnesses(illnesses, 1, 1).illnesses;
		}
		expect(illnesses[0]?.stage).toBe('recovering');
	});

	it('derives HUD effects from body conditions instead of persisting duplicate flags', () => {
		const state = createHumanConditionSnapshot();
		state.hydration = 8;
		state.wetness = 0.9;
		state.injuries = [createHumanInjury('wound', 0.7, 'injury-1')];
		state.bleedingRate = state.injuries[0]?.bleedingRate ?? 0;
		state.illnesses = [
			{
				...createHumanIllness('infection', 0.8, 'illness-1'),
				stage: 'symptomatic'
			}
		];
		state.illnessSeverity = 0.8;
		const ids = deriveHumanEffects(state).map((effect) => effect.id);
		expect(ids).toContain('thirsty');
		expect(ids).toContain('wet');
		expect(ids).toContain('bleeding');
		expect(ids).toContain('injured');
		expect(ids).toContain('sick');
	});

	it('persists injuries and illnesses in human save V3 while accepting previous V2 saves', () => {
		const system = new HumanConditionSystem();
		const debug = system.createDebugApi();
		debug.injure('wound', 0.75);
		debug.expose('infection', 1.2);
		step(system);
		const save = system.serialize();
		expect(save.version).toBe(3);
		expect(isHumanConditionSaveState(save)).toBe(true);
		if (save.version !== 3) throw new Error('expected human save V3');
		expect(save.injuries).toHaveLength(1);
		expect(save.illnesses).toHaveLength(1);

		const restored = new HumanConditionSystem();
		restored.restore(save);
		expect(restored.snapshot.injuries[0]?.kind).toBe('wound');
		expect(restored.snapshot.illnesses[0]?.kind).toBe('infection');

		expect(
			isHumanConditionSaveState({
				version: 2,
				health: 88,
				oxygen: 100,
				nutrition: 90,
				hydration: 80,
				stamina: 70,
				fatigue: 30,
				bodyTemperatureCelsius: 37,
				wetness: 0,
				lifeState: 'alive',
				sleeping: false,
				lastDamageCause: null
			})
		).toBe(true);
	});
});
