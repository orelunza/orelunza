import type { MovementInput } from '../input/KeyboardInput';
import type { PlayerState } from '../player/PlayerState';
import { fallDamageForImpactSpeed } from './HumanDamageSystem';
import { deriveHumanEffects } from './HumanEffects';
import {
	addIllnessExposure,
	createHumanIllness,
	stepHumanIllnesses,
	treatIllnesses
} from './HumanIllnessSystem';
import {
	applyFirstAid,
	createHumanInjury,
	injuryForFallDamage,
	stepHumanInjuries
} from './HumanInjurySystem';
import { stepMetabolism } from './HumanMetabolism';
import { computeHumanRecoveryProfile } from './HumanRecoverySystem';
import { stepRespiration } from './HumanRespiration';
import { stepHumanRest } from './HumanRestSystem';
import {
	MAXIMUM_HEALTH,
	MAXIMUM_HYDRATION,
	MAXIMUM_NUTRITION,
	MAXIMUM_STAMINA,
	createHumanConditionSnapshot,
	createHumanIllnessExposureLoads,
	deriveLifeState,
	restoreHumanCondition,
	restoreHumanConditionMetadata,
	serializeHumanCondition,
	type HumanConditionSaveState,
	type HumanConditionSnapshot,
	type HumanDamageCause,
	type HumanIllnessExposureLoads,
	type HumanIllnessKind,
	type HumanInjuryKind
} from './HumanConditionState';
import type { HumanExposureSnapshot } from './HumanExposure';
import { stepThermoregulation } from './HumanThermoregulation';

export interface HumanEnvironmentInput {
	temperatureCelsius: number;
	windChillCelsius: number;
	rainIntensity: number;
	snowIntensity: number;
	windStrength: number;
	daylight: number;
	humidity: number;
}

export interface HumanWaterInput {
	waterSurfaceY: number | null;
	waterDepth: number;
}

export interface HumanConditionUpdateInput {
	player: Readonly<PlayerState>;
	movement: Readonly<MovementInput>;
	environment: Readonly<HumanEnvironmentInput>;
	exposure: Readonly<HumanExposureSnapshot>;
	water: Readonly<HumanWaterInput>;
	headObstructed: boolean;
}

export interface HumanConditionUpdateResult {
	persistenceDirty: boolean;
	damageApplied: number;
	sleepChanged: boolean;
}

export interface HumanConditionDebugApi {
	getState(): HumanConditionSnapshot;
	damage(amount: number, cause?: HumanDamageCause): void;
	heal(amount: number): void;
	setHydration(value: number): void;
	setNutrition(value: number): void;
	setFatigue(value: number): void;
	drink(amount: number, contamination?: number): void;
	eat(amount: number, contamination?: number): void;
	injure(kind: HumanInjuryKind, severity?: number): void;
	expose(kind: HumanIllnessKind, dose?: number): void;
	firstAid(): boolean;
	treatIllness(kind?: HumanIllnessKind): boolean;
	clearConditions(): void;
	toggleSleep(): void;
	refill(): void;
}

const SAVE_DIRTY_INTERVAL_SECONDS = 5;
const REGENERATION_PER_SECOND = 0.05;
const SLEEP_REGENERATION_MULTIPLIER = 2.25;

export class HumanConditionSystem {
	private stateValue = createHumanConditionSnapshot();
	private exposureLoads: HumanIllnessExposureLoads = createHumanIllnessExposureLoads();
	private conditionSequence = 0;
	private groundInitialized = false;
	private wasGrounded = false;
	private maximumAirborneDownwardSpeed = 0;
	private dirtyElapsed = 0;
	private lastPersistenceFingerprint = '';
	private sleepToggleRequested = false;
	private conditionMutationPending = false;

	get snapshot(): HumanConditionSnapshot {
		return {
			...this.stateValue,
			injuries: this.stateValue.injuries.map((injury) => ({ ...injury })),
			illnesses: this.stateValue.illnesses.map((illness) => ({ ...illness })),
			effects: this.stateValue.effects.map((effect) => ({ ...effect }))
		};
	}

	get canAct(): boolean {
		return (
			!this.stateValue.sleeping &&
			this.stateValue.lifeState !== 'unconscious' &&
			this.stateValue.lifeState !== 'dead'
		);
	}

	get canSprint(): boolean {
		const severeInjury = this.stateValue.injuries.some((injury) => injury.severity >= 0.8);
		return (
			this.canAct &&
			!severeInjury &&
			this.stateValue.illnessSeverity < 0.85 &&
			this.stateValue.stamina >= 5 &&
			this.stateValue.fatigue < 88
		);
	}

	requestSleepToggle(): void {
		if (this.stateValue.sleeping) {
			this.stateValue.sleeping = false;
			this.stateValue.restState = 'active';
			this.sleepToggleRequested = false;
			this.conditionMutationPending = true;
			return;
		}
		this.sleepToggleRequested = true;
		this.conditionMutationPending = true;
	}

	/** Future food systems can call this without knowing the condition internals. */
	consumeFood(nutrition: number, contamination = 0): void {
		this.stateValue.nutrition = clamp(
			this.stateValue.nutrition + Math.max(0, finiteOr(nutrition, 0)),
			0,
			MAXIMUM_NUTRITION
		);
		if (contamination > 0) {
			this.exposeToIllness('food-poisoning', clamp(contamination, 0, 1) * 0.5, 'food');
		}
		this.conditionMutationPending = true;
	}

	/** Future water interactions can pass a contamination value when water quality exists. */
	drinkWater(hydration: number, contamination = 0): void {
		this.stateValue.hydration = clamp(
			this.stateValue.hydration + Math.max(0, finiteOr(hydration, 0)),
			0,
			MAXIMUM_HYDRATION
		);
		if (contamination > 0) {
			this.exposeToIllness('waterborne-illness', clamp(contamination, 0, 1) * 0.45, 'water');
		}
		this.conditionMutationPending = true;
	}

	reportInjury(kind: HumanInjuryKind, severity: number, source = 'external'): void {
		if (this.stateValue.lifeState === 'dead') return;
		this.stateValue.injuries = mergeInjury(
			this.stateValue.injuries,
			createHumanInjury(kind, severity, this.nextConditionId('injury'), source)
		);
		this.refreshConditionAggregates();
		this.conditionMutationPending = true;
	}

	exposeToIllness(kind: HumanIllnessKind, dose: number, source = 'environment'): void {
		if (this.stateValue.lifeState === 'dead') return;
		const exposure = addIllnessExposure(this.exposureLoads, kind, dose);
		this.exposureLoads = exposure.loads;
		this.conditionMutationPending = true;
		if (exposure.triggeredSeverity === null) return;

		const existing = this.stateValue.illnesses.find((illness) => illness.kind === kind);
		if (existing) {
			existing.severity = clamp(existing.severity + exposure.triggeredSeverity * 0.2, 0.15, 1);
			if (existing.stage === 'recovering') {
				existing.stage = 'incubating';
				existing.stageProgress = 0;
			}
		} else {
			this.stateValue.illnesses.push(
				createHumanIllness(
					kind,
					exposure.triggeredSeverity,
					this.nextConditionId('illness'),
					source
				)
			);
		}
		this.refreshConditionAggregates();
	}

	applyFirstAid(): boolean {
		const result = applyFirstAid(this.stateValue.injuries);
		this.stateValue.injuries = result.injuries;
		this.refreshConditionAggregates();
		if (result.treated) this.conditionMutationPending = true;
		return result.treated;
	}

	applyIllnessTreatment(kind?: HumanIllnessKind): boolean {
		const result = treatIllnesses(this.stateValue.illnesses, kind);
		this.stateValue.illnesses = result.illnesses;
		this.refreshConditionAggregates();
		if (result.treated) this.conditionMutationPending = true;
		return result.treated;
	}

	update(
		deltaSeconds: number,
		input: Readonly<HumanConditionUpdateInput>
	): HumanConditionUpdateResult {
		const dt = safeDelta(deltaSeconds);
		if (dt <= 0) return { persistenceDirty: false, damageApplied: 0, sleepChanged: false };

		this.stateValue.lastDamageAmount = 0;
		let damageApplied = 0;
		let sleepChanged = false;
		const eyeY = input.player.position.y + input.player.height * 0.92;
		const bodyY = input.player.position.y + Math.min(0.42, input.player.height * 0.28);
		const waterSurface = input.water.waterSurfaceY;
		const underwater = waterSurface !== null && waterSurface > eyeY + 0.02;
		const immersed = waterSurface !== null && input.water.waterDepth > 0.02 && waterSurface > bodyY;
		this.stateValue.underwater = underwater;
		this.stateValue.suffocating = input.headObstructed;
		this.stateValue.sheltered = input.exposure.sheltered;
		this.stateValue.skyExposure = clamp(input.exposure.skyExposure, 0, 1);
		this.stateValue.windExposure = clamp(input.exposure.windExposure, 0, 1);
		this.stateValue.precipitationExposure = clamp(input.exposure.precipitationExposure, 0, 1);
		this.stateValue.nearbyHeatCelsius = Math.max(0, finiteOr(input.exposure.nearbyHeatCelsius, 0));

		if (!this.groundInitialized) {
			this.groundInitialized = true;
			this.wasGrounded = input.player.onGround;
		}
		if (!input.player.onGround) {
			this.maximumAirborneDownwardSpeed = Math.max(
				this.maximumAirborneDownwardSpeed,
				Math.max(0, -finiteOr(input.player.verticalSpeed, input.player.velocity.y))
			);
		} else if (!this.wasGrounded) {
			const fallDamage = fallDamageForImpactSpeed(this.maximumAirborneDownwardSpeed);
			if (fallDamage > 0) {
				damageApplied += this.applyDamage(fallDamage, 'fall');
				const injury = injuryForFallDamage(fallDamage, this.nextConditionId('injury'));
				if (injury) this.stateValue.injuries = mergeInjury(this.stateValue.injuries, injury);
			}
			this.maximumAirborneDownwardSpeed = 0;
		}
		this.wasGrounded = input.player.onGround;

		if (this.stateValue.lifeState !== 'dead') {
			const respiration = stepRespiration(this.stateValue.oxygen, dt, {
				underwater,
				headObstructed: input.headObstructed
			});
			this.stateValue.oxygen = respiration.oxygen;
			if (respiration.healthDamage > 0 && respiration.cause) {
				damageApplied += this.applyDamage(respiration.healthDamage, respiration.cause);
			}

			const speed = Math.hypot(input.player.velocity.x, input.player.velocity.z);
			const moving = speed > 0.15;
			const sprinting = input.movement.sprint && speed > 5.2;
			const jumping = input.movement.jump && !input.player.onGround;

			const restBefore = stepHumanRest(this.stateValue.fatigue, dt, {
				moving,
				sprinting,
				jumping,
				onGround: input.player.onGround,
				underwater,
				sheltered: input.exposure.sheltered,
				lifeState: this.stateValue.lifeState,
				bodyTemperatureCelsius: this.stateValue.bodyTemperatureCelsius,
				sleeping: this.stateValue.sleeping
			});
			this.stateValue.canSleep = restBefore.canSleep;
			this.stateValue.sleepBlockedReason = restBefore.sleepBlockedReason;

			if (this.sleepToggleRequested) {
				this.sleepToggleRequested = false;
				if (restBefore.canSleep) {
					this.stateValue.sleeping = true;
					sleepChanged = true;
				}
			}
			if (this.stateValue.sleeping && !restBefore.canSleep) {
				this.stateValue.sleeping = false;
				sleepChanged = true;
			}

			const rest = stepHumanRest(this.stateValue.fatigue, dt, {
				moving: this.stateValue.sleeping ? false : moving,
				sprinting: this.stateValue.sleeping ? false : sprinting,
				jumping: this.stateValue.sleeping ? false : jumping,
				onGround: input.player.onGround,
				underwater,
				sheltered: input.exposure.sheltered,
				lifeState: this.stateValue.lifeState,
				bodyTemperatureCelsius: this.stateValue.bodyTemperatureCelsius,
				sleeping: this.stateValue.sleeping
			});
			this.stateValue.fatigue = rest.fatigue;
			this.stateValue.restState = rest.restState;
			this.stateValue.sleeping = rest.sleeping;
			this.stateValue.canSleep = rest.canSleep;
			this.stateValue.sleepBlockedReason = rest.sleepBlockedReason;

			const metabolism = stepMetabolism(this.stateValue, dt, {
				moving: this.stateValue.sleeping ? false : moving,
				sprinting: this.stateValue.sleeping ? false : sprinting,
				jumping: this.stateValue.sleeping ? false : jumping,
				sleeping: this.stateValue.sleeping,
				staminaRecoveryMultiplier: rest.staminaRecoveryMultiplier,
				fatigue: this.stateValue.fatigue,
				ambientTemperatureCelsius: input.environment.temperatureCelsius
			});
			this.stateValue.nutrition = metabolism.nutrition;
			this.stateValue.hydration = metabolism.hydration;
			this.stateValue.stamina = metabolism.stamina;
			if (metabolism.starvationDamage > 0) {
				damageApplied += this.applyDamage(metabolism.starvationDamage, 'starvation');
			}
			if (metabolism.dehydrationDamage > 0) {
				damageApplied += this.applyDamage(metabolism.dehydrationDamage, 'dehydration');
			}

			this.refreshConditionAggregates();
			const recoveryBefore = computeHumanRecoveryProfile(this.stateValue);
			const injuries = stepHumanInjuries(this.stateValue.injuries, dt, {
				healingMultiplier: recoveryBefore.healingMultiplier,
				sleeping: this.stateValue.sleeping
			});
			this.stateValue.injuries = injuries.injuries;
			this.stateValue.bleedingRate = injuries.bleedingRate;
			if (injuries.healthDamage > 0) {
				damageApplied += this.applyDamage(injuries.healthDamage, 'bleeding');
			}

			const illnesses = stepHumanIllnesses(
				this.stateValue.illnesses,
				dt,
				recoveryBefore.illnessRecoveryMultiplier
			);
			this.stateValue.illnesses = illnesses.illnesses;
			this.stateValue.illnessSeverity = illnesses.maximumSeverity;
			this.stateValue.hydration = clamp(
				this.stateValue.hydration - illnesses.hydrationDrain,
				0,
				MAXIMUM_HYDRATION
			);
			this.stateValue.nutrition = clamp(
				this.stateValue.nutrition - illnesses.nutritionDrain,
				0,
				MAXIMUM_NUTRITION
			);
			this.stateValue.fatigue = clamp(this.stateValue.fatigue + illnesses.fatigueGain, 0, 100);
			if (illnesses.healthDamage > 0 && illnesses.damageCause) {
				damageApplied += this.applyDamage(illnesses.healthDamage, illnesses.damageCause);
			}

			const activityIntensity = this.stateValue.sleeping ? 0 : sprinting ? 1 : moving ? 0.45 : 0;
			const thermoregulation = stepThermoregulation(this.stateValue, dt, {
				ambientTemperatureCelsius: input.environment.temperatureCelsius,
				windChillCelsius: input.environment.windChillCelsius,
				rainIntensity: input.environment.rainIntensity,
				snowIntensity: input.environment.snowIntensity,
				skyExposure: input.exposure.skyExposure,
				windExposure: input.exposure.windExposure,
				precipitationExposure: input.exposure.precipitationExposure,
				nearbyHeatCelsius: input.exposure.nearbyHeatCelsius,
				daylight: input.environment.daylight,
				humidity: input.environment.humidity,
				activityIntensity,
				immersed,
				internalHeatCelsius: illnesses.feverCelsius
			});
			this.stateValue.bodyTemperatureCelsius = thermoregulation.bodyTemperatureCelsius;
			this.stateValue.wetness = thermoregulation.wetness;
			if (thermoregulation.coldDamage > 0) {
				damageApplied += this.applyDamage(thermoregulation.coldDamage, 'hypothermia');
			}
			if (thermoregulation.heatDamage > 0) {
				damageApplied += this.applyDamage(thermoregulation.heatDamage, 'hyperthermia');
			}

			const maximumInjurySeverity = this.stateValue.injuries.reduce(
				(maximum, injury) => Math.max(maximum, injury.severity),
				0
			);
			const conditionStaminaPenalty = maximumInjurySeverity * 18 + illnesses.staminaPenalty;
			const fatigueMaximum = MAXIMUM_STAMINA - this.stateValue.fatigue * 0.35;
			this.stateValue.stamina = clamp(
				this.stateValue.stamina,
				0,
				Math.max(15, fatigueMaximum - conditionStaminaPenalty)
			);

			this.refreshConditionAggregates();
			const recovery = computeHumanRecoveryProfile(this.stateValue);
			this.stateValue.recoveryQuality = recovery.quality;
			this.regenerate(dt, recovery.healthRegenerationMultiplier);
		}

		this.stateValue.lifeState = deriveLifeState(this.stateValue.health);
		if (this.stateValue.lifeState !== 'alive' && this.stateValue.sleeping) {
			this.stateValue.sleeping = false;
			sleepChanged = true;
		}
		this.refreshConditionAggregates();

		this.dirtyElapsed += dt;
		const fingerprint = this.persistenceFingerprint();
		const previousLifeState = this.lastPersistenceFingerprint.split('|').at(-1);
		const significant =
			damageApplied >= 0.5 ||
			sleepChanged ||
			this.conditionMutationPending ||
			this.stateValue.lifeState !== previousLifeState;
		const persistenceDirty =
			significant ||
			(this.dirtyElapsed >= SAVE_DIRTY_INTERVAL_SECONDS &&
				fingerprint !== this.lastPersistenceFingerprint);
		if (persistenceDirty) {
			this.dirtyElapsed = 0;
			this.lastPersistenceFingerprint = fingerprint;
			this.conditionMutationPending = false;
		}
		return { persistenceDirty, damageApplied, sleepChanged };
	}

	serialize(): HumanConditionSaveState {
		return serializeHumanCondition(this.stateValue, this.exposureLoads, this.conditionSequence);
	}

	restore(save: HumanConditionSaveState | null | undefined): void {
		this.stateValue = restoreHumanCondition(save);
		const metadata = restoreHumanConditionMetadata(save);
		this.exposureLoads = metadata.exposureLoads;
		this.conditionSequence = metadata.conditionSequence;
		this.maximumAirborneDownwardSpeed = 0;
		this.groundInitialized = false;
		this.wasGrounded = false;
		this.dirtyElapsed = 0;
		this.sleepToggleRequested = false;
		this.conditionMutationPending = false;
		this.refreshConditionAggregates();
		this.lastPersistenceFingerprint = this.persistenceFingerprint();
	}

	createDebugApi(): HumanConditionDebugApi {
		return {
			getState: () => this.snapshot,
			damage: (amount, cause = 'fall') => {
				const applied = this.applyDamage(Math.max(0, finiteOr(amount, 0)), cause);
				if (applied > 0) this.conditionMutationPending = true;
			},
			heal: (amount) => {
				this.stateValue.health = Math.min(
					MAXIMUM_HEALTH,
					this.stateValue.health + Math.max(0, finiteOr(amount, 0))
				);
				this.stateValue.lifeState = deriveLifeState(this.stateValue.health);
				this.conditionMutationPending = true;
			},
			setHydration: (value) => {
				this.stateValue.hydration = clamp(value, 0, MAXIMUM_HYDRATION);
				this.conditionMutationPending = true;
			},
			setNutrition: (value) => {
				this.stateValue.nutrition = clamp(value, 0, MAXIMUM_NUTRITION);
				this.conditionMutationPending = true;
			},
			setFatigue: (value) => {
				this.stateValue.fatigue = clamp(value, 0, 100);
				this.conditionMutationPending = true;
			},
			drink: (amount, contamination = 0) => this.drinkWater(amount, contamination),
			eat: (amount, contamination = 0) => this.consumeFood(amount, contamination),
			injure: (kind, severity = 0.5) => this.reportInjury(kind, severity, 'debug'),
			expose: (kind, dose = 1) => this.exposeToIllness(kind, dose, 'debug'),
			firstAid: () => this.applyFirstAid(),
			treatIllness: (kind) => this.applyIllnessTreatment(kind),
			clearConditions: () => this.clearConditions(),
			toggleSleep: () => this.requestSleepToggle(),
			refill: () => {
				this.stateValue.health = 100;
				this.stateValue.oxygen = 100;
				this.stateValue.nutrition = 100;
				this.stateValue.hydration = 100;
				this.stateValue.stamina = 100;
				this.stateValue.fatigue = 0;
				this.stateValue.bodyTemperatureCelsius = 37;
				this.stateValue.wetness = 0;
				this.stateValue.lifeState = 'alive';
				this.stateValue.restState = 'rested';
				this.stateValue.sleeping = false;
				this.stateValue.lastDamageCause = null;
				this.clearConditions();
			}
		};
	}

	private clearConditions(): void {
		this.stateValue.injuries = [];
		this.stateValue.illnesses = [];
		this.stateValue.effects = [];
		this.stateValue.bleedingRate = 0;
		this.stateValue.illnessSeverity = 0;
		this.stateValue.recoveryQuality = 1;
		this.exposureLoads = createHumanIllnessExposureLoads();
		this.conditionMutationPending = true;
	}

	private applyDamage(amount: number, cause: HumanDamageCause): number {
		const damage = Math.max(0, finiteOr(amount, 0));
		if (damage <= 0 || this.stateValue.health <= 0) return 0;
		const applied = Math.min(this.stateValue.health, damage);
		this.stateValue.health -= applied;
		this.stateValue.lifeState = deriveLifeState(this.stateValue.health);
		this.stateValue.lastDamageCause = cause;
		this.stateValue.lastDamageAmount += applied;
		if (applied > 0 && this.stateValue.sleeping) this.stateValue.sleeping = false;
		return applied;
	}

	private regenerate(deltaSeconds: number, recoveryMultiplier: number): void {
		if (
			this.stateValue.lifeState !== 'alive' ||
			this.stateValue.health <= 0 ||
			this.stateValue.health >= MAXIMUM_HEALTH ||
			this.stateValue.oxygen < 80 ||
			this.stateValue.nutrition < 45 ||
			this.stateValue.hydration < 45 ||
			this.stateValue.bodyTemperatureCelsius < 35.5 ||
			this.stateValue.bodyTemperatureCelsius > 39 ||
			recoveryMultiplier <= 0
		) {
			return;
		}
		const sleepMultiplier = this.stateValue.sleeping ? SLEEP_REGENERATION_MULTIPLIER : 1;
		this.stateValue.health = Math.min(
			MAXIMUM_HEALTH,
			this.stateValue.health +
				REGENERATION_PER_SECOND * sleepMultiplier * clamp(recoveryMultiplier, 0, 2.5) * deltaSeconds
		);
	}

	private refreshConditionAggregates(): void {
		this.stateValue.bleedingRate = this.stateValue.injuries.reduce(
			(sum, injury) => sum + Math.max(0, injury.bleedingRate),
			0
		);
		this.stateValue.illnessSeverity = this.stateValue.illnesses.reduce((maximum, illness) => {
			if (illness.stage === 'incubating') return maximum;
			const visible =
				illness.stage === 'recovering'
					? illness.severity * (1 - clamp(illness.stageProgress, 0, 1) * 0.82)
					: illness.severity;
			return Math.max(maximum, visible);
		}, 0);
		this.stateValue.effects = deriveHumanEffects(this.stateValue);
	}

	private nextConditionId(prefix: 'injury' | 'illness'): string {
		this.conditionSequence += 1;
		return `${prefix}-${this.conditionSequence}`;
	}

	private persistenceFingerprint(): string {
		const state = this.stateValue;
		const injuries = state.injuries
			.map(
				(injury) =>
					`${injury.id}:${Math.round(injury.healingProgress * 1000)}:${Math.round(injury.bleedingRate * 10000)}:${injury.treated ? 1 : 0}`
			)
			.join(',');
		const illnesses = state.illnesses
			.map(
				(illness) =>
					`${illness.id}:${illness.stage}:${Math.round(illness.stageProgress * 1000)}:${illness.treated ? 1 : 0}`
			)
			.join(',');
		return [
			Math.round(state.health * 2) / 2,
			Math.round(state.oxygen),
			Math.round(state.nutrition),
			Math.round(state.hydration),
			Math.round(state.stamina),
			Math.round(state.fatigue),
			Math.round(state.bodyTemperatureCelsius * 10) / 10,
			Math.round(state.wetness * 20) / 20,
			state.sleeping ? 1 : 0,
			injuries,
			illnesses,
			Math.round(this.exposureLoads['food-poisoning'] * 100),
			Math.round(this.exposureLoads['waterborne-illness'] * 100),
			Math.round(this.exposureLoads.infection * 100),
			state.lifeState
		].join('|');
	}
}

function mergeInjury(
	current: readonly HumanConditionSnapshot['injuries'][number][],
	incoming: HumanConditionSnapshot['injuries'][number]
): HumanConditionSnapshot['injuries'] {
	const injuries = current.map((injury) => ({ ...injury }));
	// Avoid an unbounded list from repeated small impacts. Similar injuries merge
	// by keeping the worse severity while preserving already-earned healing.
	const existing = injuries.find((injury) => injury.kind === incoming.kind && !injury.treated);
	if (!existing) return [...injuries, incoming].slice(-6);
	existing.severity = Math.max(existing.severity, incoming.severity);
	existing.bleedingRate = Math.max(existing.bleedingRate, incoming.bleedingRate);
	existing.healingProgress = Math.min(existing.healingProgress, 0.25);
	existing.source = incoming.source;
	return injuries;
}

function safeDelta(value: number): number {
	return Number.isFinite(value) && value > 0 ? Math.min(0.25, value) : 0;
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}
