import type { HumanConditionSnapshot } from './HumanConditionState';

export interface HumanRecoveryProfile {
	quality: number;
	healingMultiplier: number;
	illnessRecoveryMultiplier: number;
	healthRegenerationMultiplier: number;
}

export function computeHumanRecoveryProfile(
	state: Readonly<
		Pick<
			HumanConditionSnapshot,
			| 'nutrition'
			| 'hydration'
			| 'oxygen'
			| 'bodyTemperatureCelsius'
			| 'fatigue'
			| 'sleeping'
			| 'restState'
			| 'bleedingRate'
			| 'illnessSeverity'
		>
	>
): HumanRecoveryProfile {
	const nutrition = clamp01(state.nutrition / 65);
	const hydration = clamp01(state.hydration / 65);
	const oxygen = clamp01(state.oxygen / 85);
	const temperaturePenalty = clamp01(Math.abs(state.bodyTemperatureCelsius - 37) / 3.5);
	const thermal = 1 - temperaturePenalty;
	const fatigue = 1 - clamp01(Math.max(0, state.fatigue - 35) / 65) * 0.45;
	const quality = clamp01(
		Math.pow(Math.max(0.01, nutrition * hydration * oxygen * thermal * fatigue), 0.2)
	);
	const rest = state.sleeping ? 1.75 : state.restState === 'resting' ? 1.18 : 1;
	// Health points do not regenerate through an actively bleeding wound. The
	// injury itself still heals in parallel, and regeneration resumes after
	// clotting/first aid has brought bleeding to zero.
	const bleedingPenalty = state.bleedingRate > 0 ? 0 : 1;
	const illnessPenalty = 1 - clamp01(state.illnessSeverity) * 0.55;

	return {
		quality,
		healingMultiplier: clamp(quality * rest, 0.12, 3),
		illnessRecoveryMultiplier: clamp(quality * (state.sleeping ? 1.45 : 1), 0.15, 2.5),
		healthRegenerationMultiplier: clamp(quality * rest * bleedingPenalty * illnessPenalty, 0, 2.5)
	};
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function clamp01(value: number): number {
	return clamp(value, 0, 1);
}
