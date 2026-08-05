import { Vector3 } from 'three';
import { TWO_PI, clamp, wrap01Range } from './EnvironmentMath';

/**
 * Length of a synodic lunar cycle expressed in world days. Real value is close
 * to 29.53; we round to a clean 30 so a "month" is an even number of days and
 * phase maths stay readable, while remaining visually convincing.
 */
export const LUNAR_CYCLE_DAYS = 30;

/** Legacy real-time length of one in-world day before the calendar system. */
export const LEGACY_DEFAULT_DAY_LENGTH_SECONDS = 1200;

/** Default real-time length of one in-world day, in seconds (2 hours). */
export const DEFAULT_DAY_LENGTH_SECONDS = 7200;

/** Serializable portion of the clock, embedded in the world save. */
export interface CelestialClockState {
	/** Seconds elapsed within the current day, in [0, dayLengthSeconds). */
	timeOfDaySeconds: number;
	/** Whole-day counter since world creation. Increments at each midnight. */
	dayNumber: number;
}

/**
 * Remaps a clock save between day lengths while preserving the visible time.
 * This is used when legacy 20-minute worlds migrate to the two-hour day.
 */
export function migrateClockStateToDayLength(
	state: Readonly<CelestialClockState>,
	sourceDayLengthSeconds: number,
	targetDayLengthSeconds: number
): CelestialClockState {
	const source = Math.max(1, finitePositiveOr(sourceDayLengthSeconds, DEFAULT_DAY_LENGTH_SECONDS));
	const target = Math.max(1, finitePositiveOr(targetDayLengthSeconds, DEFAULT_DAY_LENGTH_SECONDS));
	const fraction = wrap01Range(state.timeOfDaySeconds, source) / source;

	return {
		timeOfDaySeconds: fraction * target,
		dayNumber: Math.max(0, Math.floor(Number.isFinite(state.dayNumber) ? state.dayNumber : 0))
	};
}

function finitePositiveOr(value: number, fallback: number): number {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

export interface CelestialClockOptions {
	dayLengthSeconds?: number;
	timeOfDaySeconds?: number;
	dayNumber?: number;
}

/**
 * A frame-rate independent, deterministic clock driving every celestial value.
 *
 * The clock never uses wall-clock time or timers. It advances only when
 * {@link advance} is called with a delta in seconds, so at 30, 60 or 120 FPS
 * the same amount of simulated time produces the same state. Sun and moon
 * directions and the lunar phase are pure functions of (dayNumber, timeOfDay),
 * which is what makes the whole sky reproducible from a save.
 */
export class CelestialClock {
	private dayLengthSeconds: number;
	private timeOfDaySeconds: number;
	private dayNumber: number;
	private paused = false;
	private developmentTimeScale = 1;

	/** Normalized time of day in [0, 1): 0 = midnight, 0.5 = noon. */
	private dayFraction = 0;

	private readonly sunDirection = new Vector3(0, 1, 0);
	private readonly moonDirection = new Vector3(0, -1, 0);

	constructor(options: CelestialClockOptions = {}) {
		this.dayLengthSeconds = Math.max(1, options.dayLengthSeconds ?? DEFAULT_DAY_LENGTH_SECONDS);
		this.timeOfDaySeconds = clamp(
			options.timeOfDaySeconds ?? this.dayLengthSeconds / 3,
			0,
			this.dayLengthSeconds
		);
		this.dayNumber = Math.max(0, Math.floor(options.dayNumber ?? 0));
		this.recompute();
	}

	/** Advances the clock by a positive delta in seconds. */
	advance(deltaSeconds: number): void {
		if (this.paused || deltaSeconds <= 0 || !Number.isFinite(deltaSeconds)) {
			return;
		}

		const scaled = deltaSeconds * this.developmentTimeScale;
		let next = this.timeOfDaySeconds + scaled;

		// Roll over as many midnights as the delta crosses. A large dev-time
		// scale can cross several days in one step, so we loop rather than
		// assume a single wrap.
		while (next >= this.dayLengthSeconds) {
			next -= this.dayLengthSeconds;
			this.dayNumber += 1;
		}

		this.timeOfDaySeconds = next;
		this.recompute();
	}

	/** Pauses the day/night cycle. Celestial values freeze until resumed. */
	pause(): void {
		this.paused = true;
	}

	/** Resumes the day/night cycle. */
	resume(): void {
		this.paused = false;
	}

	get isPaused(): boolean {
		return this.paused;
	}

	/**
	 * Sets a development-only time multiplier. A value of 1 is real speed. The
	 * production caller keeps this at 1; the debug interface may raise it.
	 */
	setDevelopmentTimeScale(scale: number): void {
		this.developmentTimeScale = clamp(scale, 0, 10000);
	}

	/** Jumps directly to a normalized time of day in [0, 1). */
	setDayFraction(fraction: number): void {
		this.timeOfDaySeconds = wrap01Range(fraction, 1) * this.dayLengthSeconds;
		this.recompute();
	}

	/** Jumps directly to an absolute time of day in seconds. */
	setTimeOfDaySeconds(seconds: number): void {
		this.timeOfDaySeconds = wrap01Range(seconds, this.dayLengthSeconds);
		this.recompute();
	}

	/** Sets the configurable real length of a full day. */
	setDayLengthSeconds(seconds: number): void {
		const clamped = Math.max(1, seconds);
		const fraction = this.dayFraction;
		this.dayLengthSeconds = clamped;
		this.timeOfDaySeconds = fraction * clamped;
		this.recompute();
	}

	get dayLength(): number {
		return this.dayLengthSeconds;
	}

	/** Normalized [0, 1): 0/1 = midnight, 0.5 = noon. */
	get normalizedTimeOfDay(): number {
		return this.dayFraction;
	}

	get currentDayNumber(): number {
		return this.dayNumber;
	}

	/**
	 * Sun altitude above the horizon in [-1, 1]. 1 is straight up (noon),
	 * 0 is exactly on the horizon (sunrise/sunset), negative is below.
	 */
	get sunAltitude(): number {
		return this.sunDirection.y;
	}

	/** Unit vector pointing from the world toward the sun. */
	get sunDirectionRef(): Vector3 {
		return this.sunDirection;
	}

	/** Unit vector pointing from the world toward the moon. */
	get moonDirectionRef(): Vector3 {
		return this.moonDirection;
	}

	/**
	 * Lunar phase in [0, 1): 0 = new moon (dark), 0.5 = full moon (bright),
	 * approaching 1 returns toward new. Depends only on the day number, so it
	 * advances by roughly one thirtieth per day.
	 */
	get lunarPhase(): number {
		return wrap01Range(this.dayNumber / LUNAR_CYCLE_DAYS, 1);
	}

	/**
	 * Illuminated fraction of the moon in [0, 1]: 0 at new moon, 1 at full.
	 * This is the visual brightness multiplier for the lunar disc and its
	 * contribution to night lighting.
	 */
	get lunarIllumination(): number {
		// cos maps phase 0 -> -1 (new) and phase 0.5 -> 1 (full).
		return (1 - Math.cos(this.lunarPhase * TWO_PI)) * 0.5;
	}

	/** Extracts the serializable state for the world save. */
	serialize(): CelestialClockState {
		return {
			timeOfDaySeconds: this.timeOfDaySeconds,
			dayNumber: this.dayNumber
		};
	}

	/** Restores a previously serialized state. */
	restore(state: CelestialClockState): void {
		this.timeOfDaySeconds = wrap01Range(state.timeOfDaySeconds, this.dayLengthSeconds);
		this.dayNumber = Math.max(0, Math.floor(state.dayNumber));
		this.recompute();
	}

	/**
	 * Recomputes derived values from (timeOfDaySeconds, dayNumber). Kept
	 * allocation-free: it only mutates the two cached direction vectors.
	 */
	private recompute(): void {
		this.dayFraction = this.timeOfDaySeconds / this.dayLengthSeconds;

		// Sun sweeps a great circle. At midnight (fraction 0) it is straight
		// down; at noon (fraction 0.5) straight up. A small tilt on the X axis
		// keeps its arc off the pure vertical so shadows sweep sideways rather
		// than collapsing to a point.
		const sunAngle = (this.dayFraction - 0.25) * TWO_PI;
		const tilt = 0.28;
		const cosT = Math.cos(tilt);
		const sinT = Math.sin(tilt);
		const baseY = Math.sin(sunAngle);
		const baseZ = Math.cos(sunAngle);

		this.sunDirection.set(sinT * baseZ, baseY * cosT, baseZ * cosT);
		this.sunDirection.normalize();

		// The moon rides the opposite side of the same circle so that it is up
		// at night, plus a slight along-track offset per lunar phase so the two
		// bodies are not perfectly antipodal every single day.
		const phaseOffset = this.lunarPhase * 0.6;
		const moonAngle = sunAngle + Math.PI + phaseOffset;
		const moonY = Math.sin(moonAngle);
		const moonZ = Math.cos(moonAngle);

		this.moonDirection.set(sinT * moonZ, moonY * cosT, moonZ * cosT);
		this.moonDirection.normalize();
	}
}
