import { clamp01, hashUint32, lerp, smoothstep, TWO_PI } from '../EnvironmentMath';
import { createWindFrameState, type WindFrameState, type WindSaveState } from './WindState';

const DIRECTION_SEGMENT_SECONDS = 24;
const SPEED_SEGMENT_SECONDS = 15;
const GUST_SEGMENT_SECONDS = 7;
const DIRECTION_SALT = 0x77696e64;
const SPEED_SALT = 0x73706565;
const GUST_SALT = 0x67757374;

export interface WindSystemOptions {
	seed: number;
}

/**
 * One deterministic authority for every wind-driven system.
 *
 * Direction, base variation and gusts are sampled from stateless smooth noise
 * over absolute elapsed time. The result therefore depends only on seed, time
 * and the weather target strength, not on how a frame delta was split.
 */
export class WindSystem {
	private readonly frame = createWindFrameState();
	private readonly seed: number;
	private weatherStrength = 0.15;

	constructor(options: WindSystemOptions) {
		this.seed = options.seed >>> 0;
		this.sample();
	}

	get currentState(): Readonly<WindFrameState> {
		return this.frame;
	}

	update(deltaSeconds: number, weatherStrength: number): void {
		if (!this.frame.paused && Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
			this.frame.elapsedSeconds += deltaSeconds;
		}

		this.weatherStrength = clamp01(Number.isFinite(weatherStrength) ? weatherStrength : 0.15);
		this.sample();
	}

	pause(): void {
		this.frame.paused = true;
	}

	resume(): void {
		this.frame.paused = false;
	}

	serialize(): WindSaveState {
		return {
			elapsedSeconds: this.frame.elapsedSeconds,
			paused: this.frame.paused,
			weatherStrength: this.weatherStrength
		};
	}

	restore(save: WindSaveState | null | undefined): void {
		if (!save) {
			return;
		}

		this.frame.elapsedSeconds =
			Number.isFinite(save.elapsedSeconds) && save.elapsedSeconds >= 0 ? save.elapsedSeconds : 0;
		this.frame.paused = save.paused === true;
		this.weatherStrength = clamp01(
			Number.isFinite(save.weatherStrength) ? (save.weatherStrength as number) : 0.15
		);
		this.sample();
	}

	private sample(): void {
		const time = this.frame.elapsedSeconds;
		const segment = Math.floor(time / DIRECTION_SEGMENT_SECONDS);
		const local = (time - segment * DIRECTION_SEGMENT_SECONDS) / DIRECTION_SEGMENT_SECONDS;
		const eased = smoothstep(0, 1, local);
		const fromAngle = unitHash(this.seed, segment, DIRECTION_SALT) * TWO_PI;
		const toAngle = unitHash(this.seed, segment + 1, DIRECTION_SALT) * TWO_PI;
		const angle = fromAngle + shortestAngleDelta(fromAngle, toAngle) * eased;
		const x = Math.cos(angle);
		const z = Math.sin(angle);

		const speedNoise = smoothNoise(this.seed, time, SPEED_SEGMENT_SECONDS, SPEED_SALT);
		const gustNoise = smoothNoise(this.seed, time, GUST_SEGMENT_SECONDS, GUST_SALT);
		const target = this.weatherStrength;
		const gust = smoothstep(0.62, 0.94, gustNoise) * target;
		const varied = target * lerp(0.72, 1.18, speedNoise);

		this.frame.directionX = x;
		this.frame.directionZ = z;
		this.frame.directionRadians = normalizeRadians(Math.atan2(z, x));
		this.frame.gust = clamp01(gust);
		this.frame.strength = clamp01(varied + gust * 0.22);
	}
}

function smoothNoise(seed: number, time: number, segmentSeconds: number, salt: number): number {
	const segment = Math.floor(time / segmentSeconds);
	const local = (time - segment * segmentSeconds) / segmentSeconds;
	const eased = smoothstep(0, 1, local);
	const from = unitHash(seed, segment, salt);
	const to = unitHash(seed, segment + 1, salt);

	return lerp(from, to, eased);
}

function unitHash(seed: number, index: number, salt: number): number {
	const mixed = hashUint32(seed ^ Math.imul(index >>> 0, 0x9e3779b1) ^ salt);

	return mixed / 4294967296;
}

function shortestAngleDelta(from: number, to: number): number {
	let delta = (to - from) % TWO_PI;

	if (delta > Math.PI) {
		delta -= TWO_PI;
	} else if (delta < -Math.PI) {
		delta += TWO_PI;
	}

	return delta;
}

function normalizeRadians(value: number): number {
	const wrapped = value % TWO_PI;

	return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}
