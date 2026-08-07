export type HumanLifeState = 'alive' | 'critical' | 'unconscious' | 'dead';

export type HumanDamageCause =
	| 'fall'
	| 'drowning'
	| 'suffocation'
	| 'hypothermia'
	| 'hyperthermia'
	| 'starvation'
	| 'dehydration'
	| 'bleeding'
	| 'illness'
	| 'poisoning'
	| 'burn'
	| 'wound';

export type HumanRestState = 'active' | 'tired' | 'exhausted' | 'resting' | 'sleeping' | 'rested';

export type HumanSleepBlockedReason =
	'needs-shelter' | 'must-be-grounded' | 'underwater' | 'unsafe-condition';

export type HumanEffectId =
	| 'hungry'
	| 'thirsty'
	| 'wet'
	| 'cold'
	| 'hypothermia'
	| 'overheated'
	| 'heat-exhaustion'
	| 'exhausted'
	| 'drowning'
	| 'bleeding'
	| 'injured'
	| 'sick'
	| 'fever'
	| 'poisoned'
	| 'recovering'
	| 'rested';

export type HumanEffectSource =
	'metabolism' | 'environment' | 'respiration' | 'injury' | 'illness' | 'rest';

export interface HumanEffectSnapshot {
	id: HumanEffectId;
	intensity: number;
	source: HumanEffectSource;
}

export type HumanInjuryKind = 'minor-fall' | 'severe-fall' | 'burn' | 'wound';

export interface HumanInjurySnapshot {
	id: string;
	kind: HumanInjuryKind;
	severity: number;
	bleedingRate: number;
	healingProgress: number;
	treated: boolean;
	source: string;
}

export type HumanIllnessKind = 'food-poisoning' | 'waterborne-illness' | 'infection';
export type HumanIllnessStage = 'incubating' | 'symptomatic' | 'recovering';

export interface HumanIllnessSnapshot {
	id: string;
	kind: HumanIllnessKind;
	stage: HumanIllnessStage;
	severity: number;
	stageProgress: number;
	treated: boolean;
	source: string;
}

export type HumanIllnessExposureLoads = Record<HumanIllnessKind, number>;

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
	injuries: HumanInjurySnapshot[];
	illnesses: HumanIllnessSnapshot[];
	effects: HumanEffectSnapshot[];
	bleedingRate: number;
	illnessSeverity: number;
	recoveryQuality: number;
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

export interface HumanConditionSaveStateV3 {
	version: 3;
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
	injuries: HumanInjurySnapshot[];
	illnesses: HumanIllnessSnapshot[];
	exposureLoads: HumanIllnessExposureLoads;
	conditionSequence: number;
}

export type HumanConditionSaveState =
	HumanConditionSaveStateV1 | HumanConditionSaveStateV2 | HumanConditionSaveStateV3;

export const MAXIMUM_HEALTH = 100;
export const MAXIMUM_OXYGEN = 100;
export const MAXIMUM_NUTRITION = 100;
export const MAXIMUM_HYDRATION = 100;
export const MAXIMUM_STAMINA = 100;
export const MAXIMUM_FATIGUE = 100;
export const NORMAL_BODY_TEMPERATURE_CELSIUS = 37;

export function createHumanIllnessExposureLoads(): HumanIllnessExposureLoads {
	return {
		'food-poisoning': 0,
		'waterborne-illness': 0,
		infection: 0
	};
}

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
		suffocating: false,
		injuries: [],
		illnesses: [],
		effects: [],
		bleedingRate: 0,
		illnessSeverity: 0,
		recoveryQuality: 1
	};
}

export function serializeHumanCondition(
	state: Readonly<HumanConditionSnapshot>,
	exposureLoads: Readonly<HumanIllnessExposureLoads> = createHumanIllnessExposureLoads(),
	conditionSequence = 0
): HumanConditionSaveStateV3 {
	return {
		version: 3,
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
		lastDamageCause: state.lastDamageCause,
		injuries: state.injuries.map(sanitizeInjury),
		illnesses: state.illnesses.map(sanitizeIllness),
		exposureLoads: sanitizeExposureLoads(exposureLoads),
		conditionSequence: Math.max(0, Math.floor(finiteOr(conditionSequence, 0)))
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
		injuries?: unknown;
		illnesses?: unknown;
		exposureLoads?: unknown;
		conditionSequence?: unknown;
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
	if (
		candidate.version === 2 &&
		isFiniteNumber(candidate.fatigue) &&
		typeof candidate.sleeping === 'boolean'
	) {
		return true;
	}
	return (
		candidate.version === 3 &&
		isFiniteNumber(candidate.fatigue) &&
		typeof candidate.sleeping === 'boolean' &&
		Array.isArray(candidate.injuries) &&
		candidate.injuries.every(isHumanInjurySnapshot) &&
		Array.isArray(candidate.illnesses) &&
		candidate.illnesses.every(isHumanIllnessSnapshot) &&
		isExposureLoads(candidate.exposureLoads) &&
		isFiniteNumber(candidate.conditionSequence)
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
	state.lifeState = deriveLifeState(state.health);
	state.lastDamageCause = save.lastDamageCause;
	if (save.version === 2 || save.version === 3) {
		state.fatigue = clamp(save.fatigue, 0, MAXIMUM_FATIGUE);
		state.sleeping = save.sleeping && state.lifeState === 'alive';
	}
	if (save.version === 3) {
		state.injuries = save.injuries.map(sanitizeInjury);
		state.illnesses = save.illnesses.map(sanitizeIllness);
		state.bleedingRate = state.injuries.reduce((sum, injury) => sum + injury.bleedingRate, 0);
		state.illnessSeverity = state.illnesses.reduce(
			(maximum, illness) =>
				illness.stage === 'symptomatic' ? Math.max(maximum, illness.severity) : maximum,
			0
		);
	}
	state.restState = deriveRestState(state.fatigue, state.sleeping, false);
	return state;
}

export function restoreHumanConditionMetadata(save: HumanConditionSaveState | null | undefined): {
	exposureLoads: HumanIllnessExposureLoads;
	conditionSequence: number;
} {
	if (!save || !isHumanConditionSaveState(save) || save.version !== 3) {
		return { exposureLoads: createHumanIllnessExposureLoads(), conditionSequence: 0 };
	}
	return {
		exposureLoads: sanitizeExposureLoads(save.exposureLoads),
		conditionSequence: Math.max(0, Math.floor(save.conditionSequence))
	};
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

export function isHumanInjuryKind(value: unknown): value is HumanInjuryKind {
	return value === 'minor-fall' || value === 'severe-fall' || value === 'burn' || value === 'wound';
}

export function isHumanIllnessKind(value: unknown): value is HumanIllnessKind {
	return value === 'food-poisoning' || value === 'waterborne-illness' || value === 'infection';
}

function isHumanInjurySnapshot(value: unknown): value is HumanInjurySnapshot {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<HumanInjurySnapshot>;
	return (
		typeof candidate.id === 'string' &&
		isHumanInjuryKind(candidate.kind) &&
		isFiniteNumber(candidate.severity) &&
		isFiniteNumber(candidate.bleedingRate) &&
		isFiniteNumber(candidate.healingProgress) &&
		typeof candidate.treated === 'boolean' &&
		typeof candidate.source === 'string'
	);
}

function isHumanIllnessSnapshot(value: unknown): value is HumanIllnessSnapshot {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<HumanIllnessSnapshot>;
	return (
		typeof candidate.id === 'string' &&
		isHumanIllnessKind(candidate.kind) &&
		isIllnessStage(candidate.stage) &&
		isFiniteNumber(candidate.severity) &&
		isFiniteNumber(candidate.stageProgress) &&
		typeof candidate.treated === 'boolean' &&
		typeof candidate.source === 'string'
	);
}

function isExposureLoads(value: unknown): value is HumanIllnessExposureLoads {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<HumanIllnessExposureLoads>;
	return (
		isFiniteNumber(candidate['food-poisoning']) &&
		isFiniteNumber(candidate['waterborne-illness']) &&
		isFiniteNumber(candidate.infection)
	);
}

function sanitizeInjury(injury: HumanInjurySnapshot): HumanInjurySnapshot {
	return {
		id: injury.id,
		kind: injury.kind,
		severity: clamp(injury.severity, 0, 1),
		bleedingRate: clamp(injury.bleedingRate, 0, 0.1),
		healingProgress: clamp(injury.healingProgress, 0, 1),
		treated: injury.treated,
		source: injury.source
	};
}

function sanitizeIllness(illness: HumanIllnessSnapshot): HumanIllnessSnapshot {
	return {
		id: illness.id,
		kind: illness.kind,
		stage: illness.stage,
		severity: clamp(illness.severity, 0, 1),
		stageProgress: clamp(illness.stageProgress, 0, 1),
		treated: illness.treated,
		source: illness.source
	};
}

function sanitizeExposureLoads(
	loads: Readonly<HumanIllnessExposureLoads>
): HumanIllnessExposureLoads {
	return {
		'food-poisoning': clamp(loads['food-poisoning'], 0, 4),
		'waterborne-illness': clamp(loads['waterborne-illness'], 0, 4),
		infection: clamp(loads.infection, 0, 4)
	};
}

function isLifeState(value: unknown): value is HumanLifeState {
	return value === 'alive' || value === 'critical' || value === 'unconscious' || value === 'dead';
}

function isIllnessStage(value: unknown): value is HumanIllnessStage {
	return value === 'incubating' || value === 'symptomatic' || value === 'recovering';
}

function isDamageCause(value: unknown): value is HumanDamageCause {
	return (
		value === 'fall' ||
		value === 'drowning' ||
		value === 'suffocation' ||
		value === 'hypothermia' ||
		value === 'hyperthermia' ||
		value === 'starvation' ||
		value === 'dehydration' ||
		value === 'bleeding' ||
		value === 'illness' ||
		value === 'poisoning' ||
		value === 'burn' ||
		value === 'wound'
	);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}
