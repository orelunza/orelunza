import { clamp01, hashUint32, smoothstep } from '../EnvironmentMath';
import type { EnvironmentState } from '../EnvironmentState';
import {
	createRainbowFrameState,
	type RainbowFrameState,
	type RainbowSaveState
} from './RainbowState';

const DAY_GATE_SALT = 0x7261696e;
const FORCED_DURATION_SECONDS = 45;

/** Condition-driven, deterministic post-rain rainbow state. */
export class RainbowSystem {
	private readonly frame = createRainbowFrameState();
	private readonly seed: number;
	private forcedSeconds = 0;

	constructor(seed: number) {
		this.seed = seed >>> 0;
	}

	get currentState(): Readonly<RainbowFrameState> {
		return this.frame;
	}

	update(deltaSeconds: number, environment: Readonly<EnvironmentState>): void {
		const delta = finitePositive(deltaSeconds);
		if (!this.frame.paused && delta > 0) {
			this.frame.elapsedSeconds += delta;
			this.forcedSeconds = Math.max(0, this.forcedSeconds - delta);

			const rain = clamp01(environment.rainVisibleIntensity + environment.snowBlend * 0.15);
			const rainTarget = smoothstep(0.08, 0.55, rain);
			this.frame.rainMemory = damp(
				this.frame.rainMemory,
				rainTarget,
				rainTarget > 0 ? 2 : 55,
				delta
			);
			this.frame.drySeconds = rain > 0.08 ? 0 : Math.min(3600, this.frame.drySeconds + delta);
		}

		const dailyGate = unitHash(this.seed, environment.dayNumber, DAY_GATE_SALT);
		const postRainWindow =
			smoothstep(0.18, 0.55, this.frame.rainMemory) *
			(1 - smoothstep(100, 260, this.frame.drySeconds));
		const sunBand =
			smoothstep(0.02, 0.1, environment.sunAltitude) *
			(1 - smoothstep(0.48, 0.7, environment.sunAltitude));
		const humidity = smoothstep(0.48, 0.78, environment.humidity);
		const rainClearing = 1 - smoothstep(0.12, 0.55, environment.rainVisibleIntensity);
		const sunVisibility = 1 - smoothstep(0.45, 0.92, environment.cloudSunOcclusion);
		const rareGate = dailyGate < 0.42 ? 1 : 0;
		const naturalTarget = clamp01(
			postRainWindow * sunBand * humidity * rainClearing * sunVisibility * rareGate
		);
		const target = this.forcedSeconds > 0 ? Math.max(0.85, naturalTarget) : naturalTarget;

		if (!this.frame.paused && delta > 0) {
			this.frame.intensity = damp(
				this.frame.intensity,
				target,
				target > this.frame.intensity ? 7 : 18,
				delta
			);
		}

		this.frame.azimuthRadians = Math.atan2(
			-environment.sunDirection.z,
			-environment.sunDirection.x
		);
		this.frame.elevationRadians = 0.12 + (1 - clamp01(environment.sunAltitude / 0.7)) * 0.16;
	}

	trigger(): void {
		this.forcedSeconds = FORCED_DURATION_SECONDS;
		this.frame.rainMemory = Math.max(this.frame.rainMemory, 0.85);
		this.frame.drySeconds = Math.min(this.frame.drySeconds, 25);
	}

	pause(): void {
		this.frame.paused = true;
	}

	resume(): void {
		this.frame.paused = false;
	}

	serialize(): RainbowSaveState {
		return {
			elapsedSeconds: this.frame.elapsedSeconds,
			rainMemory: this.frame.rainMemory,
			drySeconds: this.frame.drySeconds,
			intensity: this.frame.intensity,
			forcedSeconds: this.forcedSeconds,
			paused: this.frame.paused
		};
	}

	restore(save: RainbowSaveState | null | undefined): void {
		if (!save) {
			return;
		}

		this.frame.elapsedSeconds = finiteNonNegative(save.elapsedSeconds, 0);
		this.frame.rainMemory = clamp01(save.rainMemory);
		this.frame.drySeconds = finiteNonNegative(save.drySeconds, 0);
		this.frame.intensity = clamp01(save.intensity);
		this.forcedSeconds = finiteNonNegative(save.forcedSeconds, 0);
		this.frame.paused = save.paused === true;
	}
}

function damp(current: number, target: number, seconds: number, deltaSeconds: number): number {
	if (seconds <= 0 || deltaSeconds <= 0) {
		return target;
	}
	return current + (target - current) * (1 - Math.exp(-deltaSeconds / seconds));
}

function unitHash(seed: number, index: number, salt: number): number {
	return hashUint32(seed ^ Math.imul(index >>> 0, 0x9e3779b1) ^ salt) / 4294967296;
}

function finitePositive(value: number): number {
	return Number.isFinite(value) && value > 0 ? value : 0;
}

function finiteNonNegative(value: number, fallback: number): number {
	return Number.isFinite(value) && value >= 0 ? value : fallback;
}
