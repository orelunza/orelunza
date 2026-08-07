import type { MovementInput } from '../input/KeyboardInput';
import type { PlayerState } from '../player/PlayerState';
import { fallDamageForImpactSpeed } from './HumanDamageSystem';
import { stepMetabolism } from './HumanMetabolism';
import { stepRespiration } from './HumanRespiration';
import { stepHumanRest } from './HumanRestSystem';
import {
	MAXIMUM_HEALTH,
	createHumanConditionSnapshot,
	deriveLifeState,
	restoreHumanCondition,
	serializeHumanCondition,
	type HumanConditionSaveState,
	type HumanConditionSnapshot,
	type HumanDamageCause
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
	toggleSleep(): void;
	refill(): void;
}

const SAVE_DIRTY_INTERVAL_SECONDS = 5;
const REGENERATION_PER_SECOND = 0.05;
const SLEEP_REGENERATION_MULTIPLIER = 2.25;

export class HumanConditionSystem {
	private stateValue = createHumanConditionSnapshot();
	private groundInitialized = false;
	private wasGrounded = false;
	private maximumAirborneDownwardSpeed = 0;
	private dirtyElapsed = 0;
	private lastPersistenceFingerprint = '';
	private sleepToggleRequested = false;

	get snapshot(): HumanConditionSnapshot {
		return { ...this.stateValue };
	}

	get canAct(): boolean {
		return (
			!this.stateValue.sleeping &&
			this.stateValue.lifeState !== 'unconscious' &&
			this.stateValue.lifeState !== 'dead'
		);
	}

	get canSprint(): boolean {
		return this.canAct && this.stateValue.stamina >= 5 && this.stateValue.fatigue < 88;
	}

	requestSleepToggle(): void {
		if (this.stateValue.sleeping) {
			this.stateValue.sleeping = false;
			this.stateValue.restState = 'active';
			this.sleepToggleRequested = false;
			return;
		}
		this.sleepToggleRequested = true;
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
			if (fallDamage > 0) damageApplied += this.applyDamage(fallDamage, 'fall');
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
			if (metabolism.starvationDamage > 0)
				damageApplied += this.applyDamage(metabolism.starvationDamage, 'starvation');
			if (metabolism.dehydrationDamage > 0)
				damageApplied += this.applyDamage(metabolism.dehydrationDamage, 'dehydration');

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
				immersed
			});
			this.stateValue.bodyTemperatureCelsius = thermoregulation.bodyTemperatureCelsius;
			this.stateValue.wetness = thermoregulation.wetness;
			if (thermoregulation.coldDamage > 0)
				damageApplied += this.applyDamage(thermoregulation.coldDamage, 'hypothermia');
			if (thermoregulation.heatDamage > 0)
				damageApplied += this.applyDamage(thermoregulation.heatDamage, 'hyperthermia');

			this.regenerate(dt);
		}

		this.stateValue.lifeState = deriveLifeState(this.stateValue.health);
		if (this.stateValue.lifeState !== 'alive' && this.stateValue.sleeping) {
			this.stateValue.sleeping = false;
			sleepChanged = true;
		}

		this.dirtyElapsed += dt;
		const fingerprint = this.persistenceFingerprint();
		const significant =
			damageApplied > 0 ||
			sleepChanged ||
			fingerprint.split('|').at(-1) !== this.lastPersistenceFingerprint.split('|').at(-1);
		const persistenceDirty =
			significant ||
			(this.dirtyElapsed >= SAVE_DIRTY_INTERVAL_SECONDS &&
				fingerprint !== this.lastPersistenceFingerprint);
		if (persistenceDirty) {
			this.dirtyElapsed = 0;
			this.lastPersistenceFingerprint = fingerprint;
		}
		return { persistenceDirty, damageApplied, sleepChanged };
	}

	serialize(): HumanConditionSaveState {
		return serializeHumanCondition(this.stateValue);
	}

	restore(save: HumanConditionSaveState | null | undefined): void {
		this.stateValue = restoreHumanCondition(save);
		this.maximumAirborneDownwardSpeed = 0;
		this.groundInitialized = false;
		this.wasGrounded = false;
		this.dirtyElapsed = 0;
		this.sleepToggleRequested = false;
		this.lastPersistenceFingerprint = this.persistenceFingerprint();
	}

	createDebugApi(): HumanConditionDebugApi {
		return {
			getState: () => this.snapshot,
			damage: (amount, cause = 'fall') => {
				this.applyDamage(Math.max(0, finiteOr(amount, 0)), cause);
				this.stateValue.lifeState = deriveLifeState(this.stateValue.health);
			},
			heal: (amount) => {
				this.stateValue.health = Math.min(
					MAXIMUM_HEALTH,
					this.stateValue.health + Math.max(0, finiteOr(amount, 0))
				);
				this.stateValue.lifeState = deriveLifeState(this.stateValue.health);
			},
			setHydration: (value) => {
				this.stateValue.hydration = clamp(value, 0, 100);
			},
			setNutrition: (value) => {
				this.stateValue.nutrition = clamp(value, 0, 100);
			},
			setFatigue: (value) => {
				this.stateValue.fatigue = clamp(value, 0, 100);
			},
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
			}
		};
	}

	private applyDamage(amount: number, cause: HumanDamageCause): number {
		const damage = Math.max(0, finiteOr(amount, 0));
		if (damage <= 0 || this.stateValue.health <= 0) return 0;
		const applied = Math.min(this.stateValue.health, damage);
		this.stateValue.health -= applied;
		this.stateValue.lastDamageCause = cause;
		this.stateValue.lastDamageAmount += applied;
		if (applied > 0 && this.stateValue.sleeping) this.stateValue.sleeping = false;
		return applied;
	}

	private regenerate(deltaSeconds: number): void {
		if (
			this.stateValue.lifeState !== 'alive' ||
			this.stateValue.health <= 0 ||
			this.stateValue.health >= MAXIMUM_HEALTH ||
			this.stateValue.oxygen < 80 ||
			this.stateValue.nutrition < 45 ||
			this.stateValue.hydration < 45 ||
			this.stateValue.bodyTemperatureCelsius < 35.5 ||
			this.stateValue.bodyTemperatureCelsius > 39
		) {
			return;
		}
		const multiplier = this.stateValue.sleeping ? SLEEP_REGENERATION_MULTIPLIER : 1;
		this.stateValue.health = Math.min(
			MAXIMUM_HEALTH,
			this.stateValue.health + REGENERATION_PER_SECOND * multiplier * deltaSeconds
		);
	}

	private persistenceFingerprint(): string {
		const state = this.stateValue;
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
			state.lifeState
		].join('|');
	}
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
