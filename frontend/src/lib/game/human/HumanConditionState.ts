export type HumanLifeState = 'alive' | 'critical' | 'unconscious' | 'dead';

export type HumanDamageCause =
	| 'fall'
	| 'drowning'
	| 'suffocation'
	| 'hypothermia'
	| 'hyperthermia'
	| 'starvation'
	| 'dehydration';

export interface HumanConditionSnapshot {
	health: number;
	maximumHealth: number;
	oxygen: number;
	nutrition: number;
	hydration: number;
	stamina: number;
	bodyTemperatureCelsius: number;
	wetness: number;
	lifeState: HumanLifeState;
	lastDamageCause: HumanDamageCause | null;
	lastDamageAmount: number;
	underwater: boolean;
	suffocating: boolean;
}

export interface HumanConditionSaveState {
	version: 1;
	health: number;
	oxygen: number;
	nutrition: number;
	hydration: number;
	stamina: number;
	bodyTemperatureCelsius: number;
	wetness: number;
	lifeState: HumanLifeState;
	lastDamageCause: HumanDamageCause | null;
}

export const MAXIMUM_HEALTH = 100;
export const MAXIMUM_OXYGEN = 100;
export const MAXIMUM_NUTRITION = 100;
export const MAXIMUM_HYDRATION = 100;
export const MAXIMUM_STAMINA = 100;
export const NORMAL_BODY_TEMPERATURE_CELSIUS = 37;

export function createHumanConditionSnapshot(): HumanConditionSnapshot {
	return {
		health: MAXIMUM_HEALTH,
		maximumHealth: MAXIMUM_HEALTH,
		oxygen: MAXIMUM_OXYGEN,
		nutrition: MAXIMUM_NUTRITION,
		hydration: MAXIMUM_HYDRATION,
		stamina: MAXIMUM_STAMINA,
		bodyTemperatureCelsius: NORMAL_BODY_TEMPERATURE_CELSIUS,
		wetness: 0,
		lifeState: 'alive',
		lastDamageCause: null,
		lastDamageAmount: 0,
		underwater: false,
		suffocating: false
	};
}

export function serializeHumanCondition(
	state: Readonly<HumanConditionSnapshot>
): HumanConditionSaveState {
	return {
		version: 1,
		health: clamp(state.health, 0, MAXIMUM_HEALTH),
		oxygen: clamp(state.oxygen, 0, MAXIMUM_OXYGEN),
		nutrition: clamp(state.nutrition, 0, MAXIMUM_NUTRITION),
		hydration: clamp(state.hydration, 0, MAXIMUM_HYDRATION),
		stamina: clamp(state.stamina, 0, MAXIMUM_STAMINA),
		bodyTemperatureCelsius: clamp(state.bodyTemperatureCelsius, 20, 45),
		wetness: clamp(state.wetness, 0, 1),
		lifeState: state.lifeState,
		lastDamageCause: state.lastDamageCause
	};
}

export function isHumanConditionSaveState(value: unknown): value is HumanConditionSaveState {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<HumanConditionSaveState>;
	return (
		candidate.version === 1 &&
		isFiniteNumber(candidate.health) &&
		isFiniteNumber(candidate.oxygen) &&
		isFiniteNumber(candidate.nutrition) &&
		isFiniteNumber(candidate.hydration) &&
		isFiniteNumber(candidate.stamina) &&
		isFiniteNumber(candidate.bodyTemperatureCelsius) &&
		isFiniteNumber(candidate.wetness) &&
		isLifeState(candidate.lifeState) &&
		(candidate.lastDamageCause === null || isDamageCause(candidate.lastDamageCause))
	);
}

export function restoreHumanCondition(
	save: HumanConditionSaveState | null | undefined
): HumanConditionSnapshot {
	const state = createHumanConditionSnapshot();
	if (!save || !isHumanConditionSaveState(save)) return state;
	state.health = clamp(save.health, 0, MAXIMUM_HEALTH);
	state.oxygen = clamp(save.oxygen, 0, MAXIMUM_OXYGEN);
	state.nutrition = clamp(save.nutrition, 0, MAXIMUM_NUTRITION);
	state.hydration = clamp(save.hydration, 0, MAXIMUM_HYDRATION);
	state.stamina = clamp(save.stamina, 0, MAXIMUM_STAMINA);
	state.bodyTemperatureCelsius = clamp(save.bodyTemperatureCelsius, 20, 45);
	state.wetness = clamp(save.wetness, 0, 1);
	state.lifeState = save.lifeState;
	state.lastDamageCause = save.lastDamageCause;
	return state;
}

export function deriveLifeState(health: number): HumanLifeState {
	if (health <= 0) return 'dead';
	if (health <= 8) return 'unconscious';
	if (health <= 25) return 'critical';
	return 'alive';
}

function isLifeState(value: unknown): value is HumanLifeState {
	return value === 'alive' || value === 'critical' || value === 'unconscious' || value === 'dead';
}

function isDamageCause(value: unknown): value is HumanDamageCause {
	return (
		value === 'fall' ||
		value === 'drowning' ||
		value === 'suffocation' ||
		value === 'hypothermia' ||
		value === 'hyperthermia' ||
		value === 'starvation' ||
		value === 'dehydration'
	);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}
