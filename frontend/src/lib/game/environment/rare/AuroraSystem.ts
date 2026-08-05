import { clamp01, hashUint32, smoothstep } from '../EnvironmentMath';
import type { EnvironmentState } from '../EnvironmentState';
import { createAuroraFrameState, type AuroraFrameState, type AuroraSaveState } from './AuroraState';

const DAY_GATE_SALT = 0x61757261;
const FORCED_DURATION_SECONDS = 70;

/** Rare cold-region aurora envelope. Rendering is handled separately. */
export class AuroraSystem {
	private readonly frame = createAuroraFrameState();
	private readonly seed: number;
	private forcedSeconds = 0;

	constructor(seed: number) {
		this.seed = seed >>> 0;
	}

	get currentState(): Readonly<AuroraFrameState> {
		return this.frame;
	}

	update(deltaSeconds: number, environment: Readonly<EnvironmentState>): void {
		const delta = finitePositive(deltaSeconds);
		if (!this.frame.paused && delta > 0) {
			this.frame.elapsedSeconds += delta;
			this.frame.phase = (this.frame.phase + delta * 0.025) % 4096;
			this.forcedSeconds = Math.max(0, this.forcedSeconds - delta);
		}

		const coldRegion = environment.climateRegionId === 'pine_highlands' ? 1 : 0;
		const coldAir = smoothstep(6, -12, environment.windChillCelsius);
		const clearSky = 1 - smoothstep(0.35, 0.85, environment.cloudCoverage);
		const dryEnough = 1 - smoothstep(0.05, 0.35, environment.precipitation);
		const dailyGate = unitHash(this.seed, environment.dayNumber, DAY_GATE_SALT) < 0.22 ? 1 : 0;
		const naturalTarget = clamp01(
			environment.night * coldRegion * coldAir * clearSky * dryEnough * dailyGate
		);
		const target = this.forcedSeconds > 0 ? Math.max(0.9, naturalTarget) : naturalTarget;

		if (!this.frame.paused && delta > 0) {
			this.frame.intensity = damp(
				this.frame.intensity,
				target,
				target > this.frame.intensity ? 12 : 24,
				delta
			);
		}
		this.frame.latitudeBias = clamp01(coldRegion * 0.8 + coldAir * 0.2);
	}

	trigger(): void {
		this.forcedSeconds = FORCED_DURATION_SECONDS;
	}

	pause(): void {
		this.frame.paused = true;
	}

	resume(): void {
		this.frame.paused = false;
	}

	serialize(): AuroraSaveState {
		return {
			elapsedSeconds: this.frame.elapsedSeconds,
			intensity: this.frame.intensity,
			phase: this.frame.phase,
			forcedSeconds: this.forcedSeconds,
			paused: this.frame.paused
		};
	}

	restore(save: AuroraSaveState | null | undefined): void {
		if (!save) {
			return;
		}
		this.frame.elapsedSeconds = finiteNonNegative(save.elapsedSeconds, 0);
		this.frame.intensity = clamp01(save.intensity);
		this.frame.phase = finiteNonNegative(save.phase, 0) % 4096;
		this.forcedSeconds = finiteNonNegative(save.forcedSeconds, 0);
		this.frame.paused = save.paused === true;
	}
}

function damp(current: number, target: number, seconds: number, deltaSeconds: number): number {
	return current + (target - current) * (1 - Math.exp(-deltaSeconds / Math.max(0.001, seconds)));
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
