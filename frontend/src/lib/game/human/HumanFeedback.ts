import type { HumanConditionSnapshot } from './HumanConditionState';

export interface HumanFeedbackSnapshot {
	lowHealth: number;
	damagePulse: number;
	oxygenLoss: number;
	coldStress: number;
	heatStress: number;
	illness: number;
	bleeding: number;
	unconscious: number;
	dead: boolean;
}

/** Pure presentation signals. They never mutate or persist body state. */
export function deriveHumanFeedback(
	state: Readonly<HumanConditionSnapshot>
): HumanFeedbackSnapshot {
	return {
		lowHealth: clamp01((45 - state.health) / 45),
		damagePulse: clamp01(state.lastDamageAmount / 18),
		oxygenLoss: state.underwater ? clamp01((40 - state.oxygen) / 40) : 0,
		coldStress: clamp01((35.5 - state.bodyTemperatureCelsius) / 3.5),
		heatStress: clamp01((state.bodyTemperatureCelsius - 38.5) / 3),
		illness: clamp01(state.illnessSeverity),
		bleeding: clamp01(state.bleedingRate / 0.015),
		unconscious: state.lifeState === 'unconscious' ? 1 : 0,
		dead: state.lifeState === 'dead'
	};
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
