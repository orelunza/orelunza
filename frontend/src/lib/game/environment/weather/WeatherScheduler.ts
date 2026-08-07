import {
	getWeatherPreset,
	getWeatherTransitionTargets,
	getWeatherTransitionWeights
} from './WeatherPreset';
import {
	chooseWeightedIndex,
	clampWeather01,
	safeWeatherDelta,
	weatherRandomRange,
	weatherRandomUnit
} from './WeatherMath';
import {
	copyWeatherParameters,
	createWeatherParameters,
	isWeatherKind,
	type WeatherFrameState,
	type WeatherKind,
	type WeatherPhase,
	type WeatherSaveState
} from './WeatherState';
import { WeatherTransition } from './WeatherTransition';
import type { WorldSeason } from '../time/WorldDate';

const NEXT_WEATHER_SALT = 0x6f72656c;
const HOLD_DURATION_SALT = 0x756e7a61;
const TRANSITION_DURATION_SALT = 0x77656174;
const MIN_PHASE_SECONDS = 0.01;
const MAX_PHASE_BOUNDARIES_PER_UPDATE = 100_000;

export interface WeatherClimateContext {
	season: WorldSeason;
	/** Regional/seasonal probability multiplier, not an intensity multiplier. */
	precipitationScale: number;
}

export interface WeatherSchedulerOptions {
	seed: number;
	initialWeather?: WeatherKind;
	/** Test/development scaler. Production leaves this at 1. */
	durationScale?: number;
}

/**
 * Deterministic weather timeline with no rendering or Three.js dependency.
 *
 * Random choices are stateless hashes of (seed, scheduleIndex, salt), so the
 * same seed and elapsed time always produce the same schedule regardless of
 * frame rate or how updates are chunked.
 */
export class WeatherScheduler {
	private readonly transition = new WeatherTransition();
	private readonly frame: WeatherFrameState;
	private readonly durationScale: number;
	private cloudCoverageOverride: number | null = null;
	private climateContext: WeatherClimateContext = { season: 'spring', precipitationScale: 1 };

	constructor(options: WeatherSchedulerOptions) {
		const seed = options.seed >>> 0;
		const current = options.initialWeather ?? 'clear';
		this.durationScale = sanitizeDurationScale(options.durationScale);

		const parameters = createWeatherParameters();
		copyWeatherParameters(parameters, getWeatherPreset(current).parameters);

		this.frame = {
			current,
			next: current,
			transition: 0,
			seed,
			phase: 'holding',
			phaseElapsedSeconds: 0,
			phaseDurationSeconds: 1,
			scheduleIndex: 0,
			paused: false,
			parameters
		};

		this.beginHold();
		this.applyParameters();
	}

	get currentState(): Readonly<WeatherFrameState> {
		return this.frame;
	}

	setClimateContext(context: Readonly<WeatherClimateContext>): void {
		this.climateContext = {
			season: context.season,
			precipitationScale: Math.max(
				0.2,
				Math.min(1.8, finitePositive(context.precipitationScale, 1))
			)
		};
	}

	update(deltaSeconds: number): void {
		let remaining = safeWeatherDelta(deltaSeconds);

		if (remaining <= 0 || this.frame.paused) {
			return;
		}

		let boundaries = 0;

		while (remaining > 0 && boundaries < MAX_PHASE_BOUNDARIES_PER_UPDATE) {
			const untilBoundary = Math.max(
				0,
				this.frame.phaseDurationSeconds - this.frame.phaseElapsedSeconds
			);
			const consumed = Math.min(remaining, untilBoundary);

			this.frame.phaseElapsedSeconds += consumed;
			remaining -= consumed;

			if (this.frame.phase === 'transitioning') {
				this.frame.transition = clampWeather01(
					this.frame.phaseElapsedSeconds / this.frame.phaseDurationSeconds
				);
			}

			if (this.frame.phaseElapsedSeconds + Number.EPSILON < this.frame.phaseDurationSeconds) {
				break;
			}

			this.completePhase();
			boundaries += 1;
		}

		this.applyParameters();
	}

	pause(): void {
		this.frame.paused = true;
	}

	resume(): void {
		this.frame.paused = false;
	}

	/** Immediately selects a weather preset and restarts its deterministic hold. */
	forceWeather(kind: WeatherKind): void {
		this.frame.current = kind;
		this.frame.scheduleIndex = (this.frame.scheduleIndex + 1) >>> 0;
		this.beginHold();
		this.applyParameters();
	}

	/** Starts an explicit transition, used by development controls and tests. */
	transitionTo(kind: WeatherKind, durationSeconds: number): void {
		this.frame.next = kind;
		this.frame.phase = 'transitioning';
		this.frame.phaseElapsedSeconds = 0;
		this.frame.phaseDurationSeconds = sanitizePhaseDuration(durationSeconds);
		this.frame.transition = 0;
		this.refreshTransitionEndpoints();
		this.applyParameters();
	}

	/** Development-only visual override; pass null to resume scheduled coverage. */
	setCloudCoverageOverride(coverage: number | null): void {
		this.cloudCoverageOverride =
			coverage === null ? null : clampWeather01(Number.isFinite(coverage) ? coverage : 0);
		this.applyParameters();
	}

	serialize(): WeatherSaveState {
		return {
			current: this.frame.current,
			next: this.frame.next,
			transition: this.frame.transition,
			seed: this.frame.seed,
			phase: this.frame.phase,
			phaseElapsedSeconds: this.frame.phaseElapsedSeconds,
			phaseDurationSeconds: this.frame.phaseDurationSeconds,
			scheduleIndex: this.frame.scheduleIndex,
			paused: this.frame.paused,
			cloudCoverageOverride: this.cloudCoverageOverride
		};
	}

	restore(save: WeatherSaveState | null | undefined): void {
		if (!save) {
			return;
		}

		const current = isWeatherKind(save.current) ? save.current : 'clear';
		const next = isWeatherKind(save.next) ? save.next : current;
		const transition = clampWeather01(save.transition);
		const inferredPhase: WeatherPhase =
			transition > 0 && current !== next ? 'transitioning' : 'holding';
		const phase =
			save.phase === 'transitioning' || save.phase === 'holding' ? save.phase : inferredPhase;

		this.frame.current = current;
		this.frame.next = next;
		this.frame.seed = Number.isFinite(save.seed) ? save.seed >>> 0 : this.frame.seed;
		this.frame.scheduleIndex = finiteUint32(save.scheduleIndex, 0);
		this.frame.phase = phase;
		this.frame.paused = save.paused === true;
		this.cloudCoverageOverride =
			save.cloudCoverageOverride === null || save.cloudCoverageOverride === undefined
				? null
				: clampWeather01(save.cloudCoverageOverride);

		const fallbackDuration =
			phase === 'holding'
				? this.holdDurationFor(current, this.frame.scheduleIndex)
				: this.transitionDurationFor(current, next, this.frame.scheduleIndex);
		this.frame.phaseDurationSeconds = sanitizePhaseDuration(
			finitePositive(save.phaseDurationSeconds, fallbackDuration)
		);

		const fallbackElapsed =
			phase === 'transitioning' ? transition * this.frame.phaseDurationSeconds : 0;
		this.frame.phaseElapsedSeconds = Math.min(
			this.frame.phaseDurationSeconds,
			Math.max(0, finiteNonNegative(save.phaseElapsedSeconds, fallbackElapsed))
		);
		this.frame.transition =
			phase === 'transitioning'
				? clampWeather01(this.frame.phaseElapsedSeconds / this.frame.phaseDurationSeconds)
				: 0;

		if (phase === 'holding' && current === next) {
			this.frame.next = this.chooseNext(current, this.frame.scheduleIndex);
		}

		this.refreshTransitionEndpoints();
		this.applyParameters();
	}

	private completePhase(): void {
		if (this.frame.phase === 'holding') {
			this.beginTransition();
			return;
		}

		this.frame.current = this.frame.next;
		this.frame.scheduleIndex = (this.frame.scheduleIndex + 1) >>> 0;
		this.beginHold();
	}

	private beginHold(): void {
		this.frame.phase = 'holding';
		this.frame.phaseElapsedSeconds = 0;
		this.frame.phaseDurationSeconds = this.holdDurationFor(
			this.frame.current,
			this.frame.scheduleIndex
		);
		this.frame.transition = 0;
		this.frame.next = this.chooseNext(this.frame.current, this.frame.scheduleIndex);
		this.refreshTransitionEndpoints();
	}

	private beginTransition(): void {
		this.frame.phase = 'transitioning';
		this.frame.phaseElapsedSeconds = 0;
		this.frame.phaseDurationSeconds = this.transitionDurationFor(
			this.frame.current,
			this.frame.next,
			this.frame.scheduleIndex
		);
		this.frame.transition = 0;
		this.refreshTransitionEndpoints();
	}

	private chooseNext(current: WeatherKind, scheduleIndex: number): WeatherKind {
		const targets = getWeatherTransitionTargets(current);
		const baseWeights = getWeatherTransitionWeights(current);
		const precipitationScale = this.climateContext.precipitationScale;
		const currentWet = isPrecipitating(current);
		const weights = baseWeights.map((weight, index) => {
			const target = targets[index] ?? current;
			let scale = 1;

			if (isPrecipitating(target)) {
				scale *= precipitationScale;
				// Wet fronts have memory, but repeated precipitation becomes less likely.
				if (currentWet) scale *= 0.58;
			} else if (currentWet) {
				scale *= 1.35;
			} else if (target === 'clear' || target === 'partly_cloudy') {
				scale *= Math.max(0.72, 1.35 - precipitationScale * 0.35);
			}

			if (target === 'snow') {
				scale *=
					this.climateContext.season === 'winter'
						? 1.8
						: this.climateContext.season === 'summer'
							? 0.06
							: 0.42;
			}

			return Math.max(0, weight * scale);
		});
		const choice = chooseWeightedIndex(
			weights,
			weatherRandomUnit(this.frame.seed, scheduleIndex, NEXT_WEATHER_SALT)
		);

		return targets[Math.min(choice, targets.length - 1)] ?? current;
	}

	private holdDurationFor(kind: WeatherKind, scheduleIndex: number): number {
		const [minimum, maximum] = getWeatherPreset(kind).holdSeconds;

		return sanitizePhaseDuration(
			weatherRandomRange(minimum, maximum, this.frame.seed, scheduleIndex, HOLD_DURATION_SALT) *
				this.durationScale
		);
	}

	private transitionDurationFor(
		current: WeatherKind,
		next: WeatherKind,
		scheduleIndex: number
	): number {
		const currentRange = getWeatherPreset(current).transitionSeconds;
		const nextRange = getWeatherPreset(next).transitionSeconds;
		const minimum = (currentRange[0] + nextRange[0]) * 0.5;
		const maximum = (currentRange[1] + nextRange[1]) * 0.5;

		return sanitizePhaseDuration(
			weatherRandomRange(
				minimum,
				maximum,
				this.frame.seed,
				scheduleIndex,
				TRANSITION_DURATION_SALT
			) * this.durationScale
		);
	}

	private refreshTransitionEndpoints(): void {
		this.transition.setEndpoints(
			getWeatherPreset(this.frame.current).parameters,
			getWeatherPreset(this.frame.next).parameters
		);
	}

	private applyParameters(): void {
		if (this.frame.phase === 'transitioning') {
			this.transition.sample(this.frame.transition, this.frame.parameters);
		} else {
			copyWeatherParameters(this.frame.parameters, getWeatherPreset(this.frame.current).parameters);
		}

		if (this.cloudCoverageOverride !== null) {
			this.frame.parameters.cloudCoverage = this.cloudCoverageOverride;
		}
	}
}

function sanitizeDurationScale(value: number | undefined): number {
	return Number.isFinite(value) && value !== undefined && value > 0 ? value : 1;
}

function sanitizePhaseDuration(value: number): number {
	return Number.isFinite(value) ? Math.max(MIN_PHASE_SECONDS, value) : MIN_PHASE_SECONDS;
}

function finitePositive(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) && value !== undefined && value > 0 ? value : fallback;
}

function finiteNonNegative(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) && value !== undefined && value >= 0 ? value : fallback;
}

function finiteUint32(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) && value !== undefined && value >= 0 ? value >>> 0 : fallback >>> 0;
}

function isPrecipitating(kind: WeatherKind): boolean {
	return kind === 'light_rain' || kind === 'heavy_rain' || kind === 'storm' || kind === 'snow';
}
