export type HumanLifeState = 'alive' | 'critical' | 'unconscious' | 'dead';

export type HumanDamageCause =
	| 'fall'
	| 'drowning'
	| 'suffocation'
	| 'hypothermia'
	| 'hyperthermia'
	| 'starvation'
	| 'dehydration';

export type HumanRestState = 'active' | 'tired' | 'exhausted' | 'resting' | 'sleeping' | 'rested';

export type HumanSleepBlockedReason =
	'needs-shelter' | 'must-be-grounded' | 'underwater' | 'unsafe-condition';

export interface HumanConditionSnapshot {
	health: number;
	maximumHealth: number;
	oxygen: number;
	nutrition: number;
	hydration: number;
	stamina: number;
	fatigue: number;
	bodyTemperatureCelsius: number;
	wetness: number;
	lifeState: HumanLifeState;
	restState: HumanRestState;
	sleeping: boolean;
	canSleep: boolean;
	sleepBlockedReason: HumanSleepBlockedReason | null;
	sheltered: boolean;
	skyExposure: number;
	windExposure: number;
	precipitationExposure: number;
	nearbyHeatCelsius: number;
	lastDamageCause: HumanDamageCause | null;
	lastDamageAmount: number;
	underwater: boolean;
	suffocating: boolean;
}

export interface HumanConditionSaveStateV1 {
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

export interface HumanConditionSaveStateV2 {
	version: 2;
	health: number;
	oxygen: number;
	nutrition: number;
	hydration: number;
	stamina: number;
	fatigue: number;
	bodyTemperatureCelsius: number;
	wetness: number;
	lifeState: HumanLifeState;
	sleeping: boolean;
	lastDamageCause: HumanDamageCause | null;
}

export type HumanConditionSaveState = HumanConditionSaveStateV1 | HumanConditionSaveStateV2;

export const MAXIMUM_HEALTH = 100;
export const MAXIMUM_OXYGEN = 100;
export const MAXIMUM_NUTRITION = 100;
export const MAXIMUM_HYDRATION = 100;
export const MAXIMUM_STAMINA = 100;
export const MAXIMUM_FATIGUE = 100;
export const NORMAL_BODY_TEMPERATURE_CELSIUS = 37;

export function createHumanConditionSnapshot(): HumanConditionSnapshot {
	return {
		health: MAXIMUM_HEALTH,
		maximumHealth: MAXIMUM_HEALTH,
		oxygen: MAXIMUM_OXYGEN,
		nutrition: MAXIMUM_NUTRITION,
		hydration: MAXIMUM_HYDRATION,
		stamina: MAXIMUM_STAMINA,
		fatigue: 0,
		bodyTemperatureCelsius: NORMAL_BODY_TEMPERATURE_CELSIUS,
		wetness: 0,
		lifeState: 'alive',
		restState: 'rested',
		sleeping: false,
		canSleep: false,
		sleepBlockedReason: 'needs-shelter',
		sheltered: false,
		skyExposure: 1,
		windExposure: 1,
		precipitationExposure: 1,
		nearbyHeatCelsius: 0,
		lastDamageCause: null,
		lastDamageAmount: 0,
		underwater: false,
		suffocating: false
	};
}

export function serializeHumanCondition(
	state: Readonly<HumanConditionSnapshot>
): HumanConditionSaveStateV2 {
	return {
		version: 2,
		health: clamp(state.health, 0, MAXIMUM_HEALTH),
		oxygen: clamp(state.oxygen, 0, MAXIMUM_OXYGEN),
		nutrition: clamp(state.nutrition, 0, MAXIMUM_NUTRITION),
		hydration: clamp(state.hydration, 0, MAXIMUM_HYDRATION),
		stamina: clamp(state.stamina, 0, MAXIMUM_STAMINA),
		fatigue: clamp(state.fatigue, 0, MAXIMUM_FATIGUE),
		bodyTemperatureCelsius: clamp(state.bodyTemperatureCelsius, 20, 45),
		wetness: clamp(state.wetness, 0, 1),
		lifeState: state.lifeState,
		sleeping: state.sleeping,
		lastDamageCause: state.lastDamageCause
	};
}

export function isHumanConditionSaveState(value: unknown): value is HumanConditionSaveState {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as {
		version?: unknown;
		health?: unknown;
		oxygen?: unknown;
		nutrition?: unknown;
		hydration?: unknown;
		stamina?: unknown;
		fatigue?: unknown;
		bodyTemperatureCelsius?: unknown;
		wetness?: unknown;
		lifeState?: unknown;
		sleeping?: unknown;
		lastDamageCause?: unknown;
	};
	const common =
		isFiniteNumber(candidate.health) &&
		isFiniteNumber(candidate.oxygen) &&
		isFiniteNumber(candidate.nutrition) &&
		isFiniteNumber(candidate.hydration) &&
		isFiniteNumber(candidate.stamina) &&
		isFiniteNumber(candidate.bodyTemperatureCelsius) &&
		isFiniteNumber(candidate.wetness) &&
		isLifeState(candidate.lifeState) &&
		(candidate.lastDamageCause === null || isDamageCause(candidate.lastDamageCause));

	if (!common) return false;
	if (candidate.version === 1) return true;
	return (
		candidate.version === 2 &&
		isFiniteNumber(candidate.fatigue) &&
		typeof candidate.sleeping === 'boolean'
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
	if (save.version === 2) {
		state.fatigue = clamp(save.fatigue, 0, MAXIMUM_FATIGUE);
		state.sleeping = save.sleeping;
	}
	state.restState = deriveRestState(state.fatigue, state.sleeping, false);
	return state;
}

export function deriveLifeState(health: number): HumanLifeState {
	if (health <= 0) return 'dead';
	if (health <= 8) return 'unconscious';
	if (health <= 25) return 'critical';
	return 'alive';
}

export function deriveRestState(
	fatigue: number,
	sleeping: boolean,
	resting: boolean
): HumanRestState {
	if (sleeping) return 'sleeping';
	if (fatigue >= 85) return 'exhausted';
	if (fatigue >= 55) return 'tired';
	if (resting && fatigue > 20) return 'resting';
	if (fatigue <= 20) return 'rested';
	return 'active';
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
