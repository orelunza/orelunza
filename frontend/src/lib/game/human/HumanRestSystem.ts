import type {
	HumanLifeState,
	HumanRestState,
	HumanSleepBlockedReason
} from './HumanConditionState';
import { MAXIMUM_FATIGUE, deriveRestState } from './HumanConditionState';

export interface HumanRestInput {
	moving: boolean;
	sprinting: boolean;
	jumping: boolean;
	onGround: boolean;
	underwater: boolean;
	sheltered: boolean;
	lifeState: HumanLifeState;
	bodyTemperatureCelsius: number;
	sleeping: boolean;
}

export interface HumanRestResult {
	fatigue: number;
	restState: HumanRestState;
	sleeping: boolean;
	canSleep: boolean;
	sleepBlockedReason: HumanSleepBlockedReason | null;
	staminaRecoveryMultiplier: number;
}

const BASE_FATIGUE_PER_SECOND = MAXIMUM_FATIGUE / (90 * 60);
const SLEEP_RECOVERY_PER_SECOND = MAXIMUM_FATIGUE / (35 * 60);
const QUIET_RECOVERY_PER_SECOND = MAXIMUM_FATIGUE / (7 * 60 * 60);

export function stepHumanRest(
	currentFatigue: number,
	deltaSeconds: number,
	input: Readonly<HumanRestInput>
): HumanRestResult {
	const dt = safeDelta(deltaSeconds);
	const sleepEligibility = evaluateSleepEligibility(input);
	let sleeping = input.sleeping && sleepEligibility.canSleep;
	let fatigue = clamp(currentFatigue, 0, MAXIMUM_FATIGUE);

	if (sleeping) {
		fatigue -= SLEEP_RECOVERY_PER_SECOND * dt;
	} else {
		const activityMultiplier = input.sprinting ? 2.2 : input.moving ? 1.3 : 0.72;
		const jumpMultiplier = input.jumping ? 1.18 : 1;
		const thermalStress =
			input.bodyTemperatureCelsius < 35.5 || input.bodyTemperatureCelsius > 39 ? 1.35 : 1;
		fatigue += BASE_FATIGUE_PER_SECOND * activityMultiplier * jumpMultiplier * thermalStress * dt;
		if (!input.moving && input.onGround && input.lifeState === 'alive') {
			fatigue -= QUIET_RECOVERY_PER_SECOND * dt;
		}
	}
	fatigue = clamp(fatigue, 0, MAXIMUM_FATIGUE);

	const resting = !sleeping && !input.moving && input.onGround && input.lifeState === 'alive';
	return {
		fatigue,
		restState: deriveRestState(fatigue, sleeping, resting),
		sleeping,
		canSleep: sleepEligibility.canSleep,
		sleepBlockedReason: sleepEligibility.reason,
		staminaRecoveryMultiplier: sleeping ? 1.75 : resting ? 1.18 : 1
	};
}

export function evaluateSleepEligibility(
	input: Pick<
		HumanRestInput,
		'onGround' | 'underwater' | 'sheltered' | 'lifeState' | 'bodyTemperatureCelsius'
	>
): { canSleep: boolean; reason: HumanSleepBlockedReason | null } {
	if (input.lifeState !== 'alive') return { canSleep: false, reason: 'unsafe-condition' };
	if (input.underwater) return { canSleep: false, reason: 'underwater' };
	if (!input.onGround) return { canSleep: false, reason: 'must-be-grounded' };
	if (!input.sheltered) return { canSleep: false, reason: 'needs-shelter' };
	if (input.bodyTemperatureCelsius < 34.5 || input.bodyTemperatureCelsius > 39.5) {
		return { canSleep: false, reason: 'unsafe-condition' };
	}
	return { canSleep: true, reason: null };
}

function safeDelta(value: number): number {
	return Number.isFinite(value) && value > 0 ? Math.min(1, value) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}
