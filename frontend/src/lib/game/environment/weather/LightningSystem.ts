import { clamp01, hashUint32, lerp, smoothstep, TWO_PI } from '../EnvironmentMath';
import type { WeatherFrameState } from './WeatherState';
import {
	createLightningFrameState,
	type LightningFrameState,
	type LightningSaveState
} from './LightningState';
import type { ThunderEvent } from './ThunderEvent';

const CHECK_SALT = 0x6c746e67;
const STRIKE_SALT = 0x7374726b;
const DISTANCE_SALT = 0x64697374;
const BEARING_SALT = 0x62656172;
const INTENSITY_SALT = 0x696e746e;
const DURATION_SALT = 0x64757261;
const SOUND_SPEED_METERS_PER_SECOND = 343;

/** Deterministic storm strikes, flash envelopes and delayed thunder events. */
export class LightningSystem {
	private readonly frame = createLightningFrameState();
	private readonly seed: number;
	private nextCheckAtSeconds = 2;
	private strikeIndex = 0;
	private activeStrikeStartedAt = Number.NEGATIVE_INFINITY;
	private activeStrikeDuration = 0.45;
	private pendingThunder: ThunderEvent | null = null;

	constructor(seed: number) {
		this.seed = seed >>> 0;
		this.scheduleNextCheck(0.1, 0);
	}

	get currentState(): Readonly<LightningFrameState> {
		return this.frame;
	}

	update(deltaSeconds: number, weather: Readonly<WeatherFrameState>): void {
		if (!this.frame.paused && Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
			this.frame.elapsedSeconds += deltaSeconds;
		}

		const probability = clamp01(weather.parameters.lightningProbability);
		let guard = 0;

		while (this.frame.elapsedSeconds >= this.nextCheckAtSeconds && guard < 32) {
			const checkTime = this.nextCheckAtSeconds;
			const chance = unitHash(this.seed, this.strikeIndex, CHECK_SALT);

			this.releaseThunderWhenDueAt(checkTime);
			if (probability > 0.01 && chance < probability) {
				this.beginStrike(checkTime);
			}

			this.strikeIndex = (this.strikeIndex + 1) >>> 0;
			this.scheduleNextCheck(probability, checkTime);
			guard += 1;
		}

		this.sampleActiveStrike();
		this.releaseThunderWhenDue();
	}

	trigger(): void {
		this.beginStrike(this.frame.elapsedSeconds);
		this.strikeIndex = (this.strikeIndex + 1) >>> 0;
		this.sampleActiveStrike();
	}

	pause(): void {
		this.frame.paused = true;
	}

	resume(): void {
		this.frame.paused = false;
	}

	serialize(): LightningSaveState {
		return {
			elapsedSeconds: this.frame.elapsedSeconds,
			nextCheckAtSeconds: this.nextCheckAtSeconds,
			strikeIndex: this.strikeIndex,
			activeStrikeId: this.frame.strikeId,
			activeStrikeStartedAt: Number.isFinite(this.activeStrikeStartedAt)
				? this.activeStrikeStartedAt
				: -1,
			activeStrikeDuration: this.activeStrikeDuration,
			bearingRadians: this.frame.bearingRadians,
			distanceMeters: this.frame.distanceMeters,
			intensity: this.frame.intensity,
			paused: this.frame.paused,
			pendingThunder: this.pendingThunder
		};
	}

	restore(save: LightningSaveState | null | undefined): void {
		if (!save) {
			return;
		}

		this.frame.elapsedSeconds = finiteNonNegative(save.elapsedSeconds, 0);
		this.nextCheckAtSeconds = Math.max(
			this.frame.elapsedSeconds,
			finiteNonNegative(save.nextCheckAtSeconds, this.frame.elapsedSeconds + 2)
		);
		this.strikeIndex = finiteUint32(save.strikeIndex, 0);
		this.frame.strikeId = finiteUint32(save.activeStrikeId, 0);
		this.activeStrikeStartedAt = finiteOr(save.activeStrikeStartedAt, Number.NEGATIVE_INFINITY);
		this.activeStrikeDuration = Math.max(0.08, finiteOr(save.activeStrikeDuration, 0.45));
		this.frame.bearingRadians = finiteOr(save.bearingRadians, 0);
		this.frame.distanceMeters = Math.max(1, finiteOr(save.distanceMeters, 40));
		this.frame.intensity = clamp01(save.intensity);
		this.frame.paused = save.paused === true;
		this.pendingThunder = sanitizeThunder(save.pendingThunder);
		this.sampleActiveStrike();
		this.releaseThunderWhenDue();
	}

	private beginStrike(startedAtSeconds: number): void {
		const index = this.strikeIndex;
		const distance = lerp(18, 125, unitHash(this.seed, index, DISTANCE_SALT));
		const intensity = lerp(0.58, 1, unitHash(this.seed, index, INTENSITY_SALT));

		this.frame.strikeId = (this.frame.strikeId + 1) >>> 0;
		this.frame.bearingRadians = unitHash(this.seed, index, BEARING_SALT) * TWO_PI;
		this.frame.distanceMeters = distance;
		this.frame.intensity = intensity;
		this.activeStrikeStartedAt = startedAtSeconds;
		this.activeStrikeDuration = lerp(0.28, 0.62, unitHash(this.seed, index, DURATION_SALT));
		this.pendingThunder = {
			strikeId: this.frame.strikeId,
			distanceMeters: distance,
			delaySeconds: distance / SOUND_SPEED_METERS_PER_SECOND,
			intensity,
			occurredAtSeconds: startedAtSeconds + distance / SOUND_SPEED_METERS_PER_SECOND
		};
	}

	private sampleActiveStrike(): void {
		const local =
			(this.frame.elapsedSeconds - this.activeStrikeStartedAt) / this.activeStrikeDuration;

		if (!Number.isFinite(local) || local < 0 || local >= 1) {
			this.frame.flashIntensity = 0;
			this.frame.boltVisibility = 0;
			return;
		}

		const first = pulse(local, 0.02, 0.16);
		const second = pulse(local, 0.26, 0.43) * 0.72;
		const third = pulse(local, 0.55, 0.78) * 0.38;
		this.frame.flashIntensity = clamp01(Math.max(first, second, third) * this.frame.intensity);
		this.frame.boltVisibility = clamp01(first * 1.2 + second * 0.42);
	}

	private scheduleNextCheck(probability: number, baseTimeSeconds: number): void {
		const index = this.strikeIndex;
		const base = lerp(12, 4.5, clamp01(probability));
		const variation = lerp(0.68, 1.42, unitHash(this.seed, index, STRIKE_SALT));
		this.nextCheckAtSeconds = Math.max(0, baseTimeSeconds) + base * variation;
	}

	private releaseThunderWhenDue(): void {
		this.releaseThunderWhenDueAt(this.frame.elapsedSeconds);
	}

	private releaseThunderWhenDueAt(timeSeconds: number): void {
		if (!this.pendingThunder || this.pendingThunder.occurredAtSeconds > timeSeconds) {
			return;
		}

		this.frame.lastThunder = this.pendingThunder;
		this.pendingThunder = null;
	}
}

function pulse(value: number, start: number, end: number): number {
	const middle = (start + end) * 0.5;
	return value <= middle ? smoothstep(start, middle, value) : 1 - smoothstep(middle, end, value);
}

function unitHash(seed: number, index: number, salt: number): number {
	return hashUint32(seed ^ Math.imul(index >>> 0, 0x9e3779b1) ^ salt) / 4294967296;
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function finiteNonNegative(value: number, fallback: number): number {
	return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function finiteUint32(value: number, fallback: number): number {
	return Number.isFinite(value) && value >= 0 ? value >>> 0 : fallback >>> 0;
}

function sanitizeThunder(value: ThunderEvent | null | undefined): ThunderEvent | null {
	if (!value || !Number.isFinite(value.occurredAtSeconds)) {
		return null;
	}

	return {
		strikeId: finiteUint32(value.strikeId, 0),
		distanceMeters: Math.max(1, finiteOr(value.distanceMeters, 40)),
		delaySeconds: Math.max(0, finiteOr(value.delaySeconds, 0)),
		intensity: clamp01(value.intensity),
		occurredAtSeconds: value.occurredAtSeconds
	};
}
