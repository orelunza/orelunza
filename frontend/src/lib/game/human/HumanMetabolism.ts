import { MAXIMUM_HYDRATION, MAXIMUM_NUTRITION, MAXIMUM_STAMINA } from './HumanConditionState';

export interface HumanMetabolismInput {
	moving: boolean;
	sprinting: boolean;
	jumping: boolean;
	sleeping: boolean;
	staminaRecoveryMultiplier: number;
	fatigue: number;
	ambientTemperatureCelsius: number;
}

export interface HumanMetabolismResult {
	nutrition: number;
	hydration: number;
	stamina: number;
	starvationDamage: number;
	dehydrationDamage: number;
}

// Human-paced depletion rather than an arcade hunger clock.
const RESTING_NUTRITION_PER_SECOND = MAXIMUM_NUTRITION / (36 * 60 * 60);
const RESTING_HYDRATION_PER_SECOND = MAXIMUM_HYDRATION / (10 * 60 * 60);
const SPRINT_STAMINA_PER_SECOND = 8;
const WALK_STAMINA_PER_SECOND = 0.18;
const STAMINA_RECOVERY_PER_SECOND = 11;

export function stepMetabolism(
	current: Readonly<{ nutrition: number; hydration: number; stamina: number }>,
	deltaSeconds: number,
	input: Readonly<HumanMetabolismInput>
): HumanMetabolismResult {
	const dt = safeDelta(deltaSeconds);
	const activity = input.sleeping ? 0.8 : input.sprinting ? 2.4 : input.moving ? 1.35 : 1;
	const heat = Math.max(0, finiteOr(input.ambientTemperatureCelsius, 20) - 28);
	const hydrationMultiplier = activity * (1 + Math.min(1.4, heat * 0.045));
	const nutrition = Math.max(
		0,
		finiteOr(current.nutrition, MAXIMUM_NUTRITION) - RESTING_NUTRITION_PER_SECOND * activity * dt
	);
	const hydration = Math.max(
		0,
		finiteOr(current.hydration, MAXIMUM_HYDRATION) -
			RESTING_HYDRATION_PER_SECOND * hydrationMultiplier * dt
	);

	let stamina = finiteOr(current.stamina, MAXIMUM_STAMINA);
	if (!input.sleeping && input.sprinting && input.moving) stamina -= SPRINT_STAMINA_PER_SECOND * dt;
	else if (!input.sleeping && input.moving) stamina -= WALK_STAMINA_PER_SECOND * dt;
	else {
		stamina +=
			STAMINA_RECOVERY_PER_SECOND *
			Math.max(0.5, finiteOr(input.staminaRecoveryMultiplier, 1)) *
			dt;
	}
	if (!input.sleeping && input.jumping) stamina -= 0.8 * dt;

	// Long-term fatigue reduces the amount of stamina the body can sustain.
	const fatigue = clamp(finiteOr(input.fatigue, 0), 0, 100);
	const effectiveMaximumStamina = MAXIMUM_STAMINA - fatigue * 0.35;
	stamina = clamp(stamina, 0, effectiveMaximumStamina);

	return {
		nutrition,
		hydration,
		stamina,
		starvationDamage: nutrition <= 0 ? 0.35 * dt : 0,
		dehydrationDamage: hydration <= 0 ? 1.2 * dt : 0
	};
}

function safeDelta(value: number): number {
	return Number.isFinite(value) && value > 0 ? Math.min(0.25, value) : 0;
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
