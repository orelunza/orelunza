import type {
	HumanConditionSnapshot,
	HumanEffectId,
	HumanEffectSnapshot,
	HumanEffectSource
} from './HumanConditionState';

export function deriveHumanEffects(state: Readonly<HumanConditionSnapshot>): HumanEffectSnapshot[] {
	const effects: HumanEffectSnapshot[] = [];
	const add = (id: HumanEffectId, intensity: number, source: HumanEffectSource): void => {
		const safeIntensity = clamp01(intensity);
		if (safeIntensity <= 0) return;
		effects.push({ id, intensity: safeIntensity, source });
	};

	if (state.nutrition < 20) add('hungry', (20 - state.nutrition) / 20, 'metabolism');
	if (state.hydration < 25) add('thirsty', (25 - state.hydration) / 25, 'metabolism');
	if (state.wetness > 0.35) add('wet', (state.wetness - 0.35) / 0.65, 'environment');
	if (state.bodyTemperatureCelsius < 35.5) {
		add('cold', (35.5 - state.bodyTemperatureCelsius) / 2.5, 'environment');
	}
	if (state.bodyTemperatureCelsius < 35) {
		add('hypothermia', (35 - state.bodyTemperatureCelsius) / 3, 'environment');
	}
	if (state.bodyTemperatureCelsius > 38.5) {
		add('overheated', (state.bodyTemperatureCelsius - 38.5) / 2.5, 'environment');
	}
	if (state.bodyTemperatureCelsius > 39.2 && state.hydration < 45) {
		add(
			'heat-exhaustion',
			Math.max((state.bodyTemperatureCelsius - 39.2) / 2, (45 - state.hydration) / 45),
			'environment'
		);
	}
	if (state.fatigue >= 85) add('exhausted', (state.fatigue - 85) / 15 + 0.25, 'rest');
	if (state.underwater && state.oxygen < 35)
		add('drowning', (35 - state.oxygen) / 35, 'respiration');
	if (state.bleedingRate > 0) add('bleeding', state.bleedingRate / 0.015, 'injury');
	if (state.injuries.length > 0) {
		add('injured', Math.max(...state.injuries.map((injury) => injury.severity)), 'injury');
	}

	const symptomatic = state.illnesses.filter((illness) => illness.stage === 'symptomatic');
	const recovering = state.illnesses.filter((illness) => illness.stage === 'recovering');
	if (symptomatic.length > 0) {
		add('sick', Math.max(...symptomatic.map((illness) => illness.severity)), 'illness');
		if (symptomatic.some((illness) => illness.kind === 'food-poisoning')) {
			add(
				'poisoned',
				Math.max(
					...symptomatic
						.filter((illness) => illness.kind === 'food-poisoning')
						.map((illness) => illness.severity)
				),
				'illness'
			);
		}
		if (state.bodyTemperatureCelsius >= 37.8) {
			add('fever', (state.bodyTemperatureCelsius - 37.8) / 2.2, 'illness');
		}
	}
	if (
		recovering.length > 0 ||
		state.injuries.some((injury) => injury.healingProgress > 0.35 && injury.bleedingRate === 0)
	) {
		add('recovering', state.recoveryQuality, 'rest');
	}
	if (state.restState === 'rested' && state.fatigue <= 20 && state.lifeState === 'alive') {
		add('rested', 1 - state.fatigue / 20, 'rest');
	}

	return effects;
}

export function hasHumanEffect(
	effects: readonly HumanEffectSnapshot[],
	id: HumanEffectId
): boolean {
	return effects.some((effect) => effect.id === id);
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
