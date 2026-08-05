import { clamp01, hashUint32, lerp, TWO_PI } from '../EnvironmentMath';
import type { EnvironmentState } from '../EnvironmentState';
import {
	createShootingStarEventState,
	type ShootingStarEventState,
	type ShootingStarFrameState,
	type ShootingStarSaveState
} from './ShootingStarState';

const EVENT_INTERVAL_SALT = 0x73696e74;
const AZIMUTH_SALT = 0x617a696d;
const ELEVATION_SALT = 0x656c6576;
const LENGTH_SALT = 0x6c656e67;
const DURATION_SALT = 0x64757261;
const BRIGHTNESS_SALT = 0x62726967;
const POOL_SIZE = 3;

/** Small deterministic scheduler for rare shooting-star streaks. */
export class ShootingStarSystem {
	private readonly events = Array.from({ length: POOL_SIZE }, () => createShootingStarEventState());
	private readonly frame: ShootingStarFrameState = {
		elapsedSeconds: 0,
		activeCount: 0,
		visibility: 0,
		paused: false,
		events: this.events
	};
	private readonly seed: number;
	private nextEventAtSeconds = 20;
	private eventIndex = 0;

	constructor(seed: number) {
		this.seed = seed >>> 0;
		this.scheduleNext(0);
	}

	get currentState(): Readonly<ShootingStarFrameState> {
		return this.frame;
	}

	update(deltaSeconds: number, environment: Readonly<EnvironmentState>): void {
		const delta = finitePositive(deltaSeconds);
		if (!this.frame.paused && delta > 0) {
			this.frame.elapsedSeconds += delta;
		}

		const eligible =
			environment.night > 0.62 &&
			environment.cloudCoverage < 0.45 &&
			environment.precipitation < 0.08;
		this.frame.visibility = clamp01(
			environment.starVisibility * (1 - environment.cloudMoonOcclusion * 0.7)
		);

		if (!this.frame.paused && delta > 0) {
			let guard = 0;
			while (this.frame.elapsedSeconds >= this.nextEventAtSeconds && guard < 64) {
				if (eligible) {
					this.spawnEvent(this.eventIndex);
				}
				const previousEventTime = this.nextEventAtSeconds;
				this.eventIndex = (this.eventIndex + 1) >>> 0;
				this.scheduleNext(previousEventTime);
				guard += 1;
			}
			if (guard === 64 && this.frame.elapsedSeconds >= this.nextEventAtSeconds) {
				this.scheduleNext(this.frame.elapsedSeconds);
			}
		}

		let activeCount = 0;
		for (const event of this.events) {
			if (!event.active) {
				continue;
			}
			if (!this.frame.paused && delta > 0) {
				event.ageSeconds += delta;
			}
			if (event.ageSeconds >= event.durationSeconds || !eligible) {
				event.active = false;
				event.brightness = 0;
				continue;
			}
			activeCount += 1;
		}
		this.frame.activeCount = activeCount;
	}

	trigger(): void {
		this.spawnEvent(this.eventIndex);
		this.eventIndex = (this.eventIndex + 1) >>> 0;
		this.scheduleNext(this.frame.elapsedSeconds);
	}

	pause(): void {
		this.frame.paused = true;
	}

	resume(): void {
		this.frame.paused = false;
	}

	serialize(): ShootingStarSaveState {
		return {
			elapsedSeconds: this.frame.elapsedSeconds,
			nextEventAtSeconds: this.nextEventAtSeconds,
			eventIndex: this.eventIndex,
			activeEvents: this.events.map((event) => ({ ...event })),
			paused: this.frame.paused
		};
	}

	restore(save: ShootingStarSaveState | null | undefined): void {
		if (!save) {
			return;
		}
		this.frame.elapsedSeconds = finiteNonNegative(save.elapsedSeconds, 0);
		this.nextEventAtSeconds = Math.max(
			this.frame.elapsedSeconds,
			finiteNonNegative(save.nextEventAtSeconds, this.frame.elapsedSeconds + 25)
		);
		this.eventIndex = finiteUint32(save.eventIndex, 0);
		this.frame.paused = save.paused === true;

		for (let index = 0; index < this.events.length; index += 1) {
			const target = this.events[index];
			const source = save.activeEvents?.[index];
			if (!source) {
				Object.assign(target, createShootingStarEventState());
				continue;
			}
			target.active = source.active === true;
			target.id = finiteUint32(source.id, 0);
			target.ageSeconds = finiteNonNegative(source.ageSeconds, 0);
			target.durationSeconds = Math.max(0.2, finiteOr(source.durationSeconds, 0.8));
			target.azimuthRadians = finiteOr(source.azimuthRadians, 0);
			target.elevationRadians = finiteOr(source.elevationRadians, 0.65);
			target.lengthRadians = Math.max(0.04, finiteOr(source.lengthRadians, 0.18));
			target.brightness = clamp01(source.brightness);
		}
		this.frame.activeCount = this.events.filter((event) => event.active).length;
	}

	private spawnEvent(index: number): void {
		const slot = this.events.find((event) => !event.active) ?? this.events[0];
		slot.active = true;
		slot.id = (slot.id + 1) >>> 0;
		slot.ageSeconds = 0;
		slot.durationSeconds = lerp(0.55, 1.15, unitHash(this.seed, index, DURATION_SALT));
		slot.azimuthRadians = unitHash(this.seed, index, AZIMUTH_SALT) * TWO_PI;
		slot.elevationRadians = lerp(0.35, 1.12, unitHash(this.seed, index, ELEVATION_SALT));
		slot.lengthRadians = lerp(0.1, 0.28, unitHash(this.seed, index, LENGTH_SALT));
		slot.brightness = lerp(0.55, 1, unitHash(this.seed, index, BRIGHTNESS_SALT));
	}

	private scheduleNext(baseSeconds: number): void {
		this.nextEventAtSeconds =
			Math.max(0, baseSeconds) +
			lerp(35, 145, unitHash(this.seed, this.eventIndex, EVENT_INTERVAL_SALT));
	}
}

function unitHash(seed: number, index: number, salt: number): number {
	return hashUint32(seed ^ Math.imul(index >>> 0, 0x9e3779b1) ^ salt) / 4294967296;
}

function finitePositive(value: number): number {
	return Number.isFinite(value) && value > 0 ? value : 0;
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
