import { clamp, clamp01, hashUint32, lerp } from '../EnvironmentMath';
import type { ClimateRegionId } from '../regions/ClimateRegionProfile';
import { getSpecialWeatherPreset } from './SpecialWeatherPreset';
import {
	copySpecialWeatherParameters,
	createSpecialWeatherFrameState,
	createSpecialWeatherParameters,
	isSpecialWeatherKind,
	type SpecialWeatherFrameState,
	type SpecialWeatherKind,
	type SpecialWeatherParameters,
	type SpecialWeatherSaveState
} from './SpecialWeatherState';

const NATURAL_GATE_SALT = 0x53504543;

export interface SpecialWeatherContext {
	regionId: ClimateRegionId;
	dayNumber: number;
	daylight: number;
	temperatureCelsius: number;
	humidity: number;
	precipitation: number;
	windStrength: number;
}

/** Deterministic special-weather envelope. Volcanic phenomena stay opt-in until volcanoes exist. */
export class SpecialWeatherSystem {
	private readonly frame = createSpecialWeatherFrameState();
	private readonly fromParameters = createSpecialWeatherParameters();
	private readonly seed: number;

	constructor(seed: number) {
		this.seed = seed >>> 0;
		copySpecialWeatherParameters(this.fromParameters, getSpecialWeatherPreset('none').parameters);
	}

	get currentState(): Readonly<SpecialWeatherFrameState> {
		return this.frame;
	}

	update(deltaSeconds: number, context: Readonly<SpecialWeatherContext>): void {
		const delta = safePositive(deltaSeconds);
		if (!this.frame.paused && delta > 0) {
			this.frame.elapsedSeconds += delta;
		}

		const desired = this.frame.forcedTarget ?? this.resolveNaturalTarget(context);
		if (desired !== this.frame.target) {
			this.beginTransition(desired);
		}

		if (!this.frame.paused && delta > 0 && this.frame.transition < 1) {
			this.frame.transitionElapsedSeconds = Math.min(
				this.frame.transitionDurationSeconds,
				this.frame.transitionElapsedSeconds + delta
			);
			this.frame.transition = clamp01(
				this.frame.transitionElapsedSeconds / this.frame.transitionDurationSeconds
			);
		}

		const target = getSpecialWeatherPreset(this.frame.target).parameters;
		interpolateParameters(
			this.frame.parameters,
			this.fromParameters,
			target,
			smootherstep(this.frame.transition)
		);
		if (this.frame.transition >= 1) {
			this.frame.current = this.frame.target;
		}
	}

	set(kind: SpecialWeatherKind): void {
		this.frame.forcedTarget = kind;
		if (kind !== this.frame.target) {
			this.beginTransition(kind);
		}
	}

	clear(): void {
		this.frame.forcedTarget = null;
		if (this.frame.target !== 'none') {
			this.beginTransition('none');
		}
	}

	pause(): void {
		this.frame.paused = true;
	}

	resume(): void {
		this.frame.paused = false;
	}

	serialize(): SpecialWeatherSaveState {
		return {
			current: this.frame.current,
			target: this.frame.target,
			transition: this.frame.transition,
			transitionElapsedSeconds: this.frame.transitionElapsedSeconds,
			transitionDurationSeconds: this.frame.transitionDurationSeconds,
			elapsedSeconds: this.frame.elapsedSeconds,
			forcedTarget: this.frame.forcedTarget,
			paused: this.frame.paused,
			fromParameters: { ...this.fromParameters }
		};
	}

	restore(save: SpecialWeatherSaveState | null | undefined): void {
		if (!save) {
			return;
		}
		this.frame.current = isSpecialWeatherKind(save.current) ? save.current : 'none';
		this.frame.target = isSpecialWeatherKind(save.target) ? save.target : this.frame.current;
		this.frame.transition = safeUnit(save.transition);
		this.frame.transitionDurationSeconds = clamp(
			finiteOr(save.transitionDurationSeconds, 1),
			0.05,
			300
		);
		this.frame.transitionElapsedSeconds = clamp(
			finiteOr(
				save.transitionElapsedSeconds,
				this.frame.transitionDurationSeconds * this.frame.transition
			),
			0,
			this.frame.transitionDurationSeconds
		);
		this.frame.elapsedSeconds = nonNegative(save.elapsedSeconds);
		this.frame.forcedTarget = isSpecialWeatherKind(save.forcedTarget) ? save.forcedTarget : null;
		this.frame.paused = save.paused === true;
		copySpecialWeatherParameters(
			this.fromParameters,
			sanitizeParameters(
				save.fromParameters,
				getSpecialWeatherPreset(this.frame.current).parameters
			)
		);
		interpolateParameters(
			this.frame.parameters,
			this.fromParameters,
			getSpecialWeatherPreset(this.frame.target).parameters,
			smootherstep(this.frame.transition)
		);
	}

	private beginTransition(kind: SpecialWeatherKind): void {
		copySpecialWeatherParameters(this.fromParameters, this.frame.parameters);
		this.frame.current = dominantKind(this.frame.current, this.frame.target, this.frame.transition);
		this.frame.target = kind;
		this.frame.transition = 0;
		this.frame.transitionElapsedSeconds = 0;
		this.frame.transitionDurationSeconds = getSpecialWeatherPreset(kind).transitionSeconds;
	}

	private resolveNaturalTarget(context: Readonly<SpecialWeatherContext>): SpecialWeatherKind {
		const gate = unitHash(this.seed, context.dayNumber, NATURAL_GATE_SALT);
		const dryRegion =
			context.regionId === 'free_build_meadow' || context.regionId === 'central_city';
		const dry = context.humidity < 0.46 && context.precipitation < 0.04;
		if (dryRegion && dry && context.windStrength > 0.72 && gate < 0.055) {
			return 'dust_storm';
		}
		if (
			dryRegion &&
			dry &&
			context.daylight > 0.55 &&
			context.temperatureCelsius > 27 &&
			gate >= 0.055 &&
			gate < 0.19
		) {
			return 'hot_haze';
		}
		return 'none';
	}
}

function interpolateParameters(
	out: SpecialWeatherParameters,
	from: Readonly<SpecialWeatherParameters>,
	to: Readonly<SpecialWeatherParameters>,
	progress: number
): void {
	out.ash = clamp01(lerp(from.ash, to.ash, progress));
	out.dust = clamp01(lerp(from.dust, to.dust, progress));
	out.haze = clamp01(lerp(from.haze, to.haze, progress));
	out.smoke = clamp01(lerp(from.smoke, to.smoke, progress));
	out.particleIntensity = clamp01(lerp(from.particleIntensity, to.particleIntensity, progress));
	out.visibilityLoss = clamp01(lerp(from.visibilityLoss, to.visibilityLoss, progress));
	out.cloudDarkening = clamp01(lerp(from.cloudDarkening, to.cloudDarkening, progress));
	out.sunOcclusion = clamp01(lerp(from.sunOcclusion, to.sunOcclusion, progress));
	out.fogBoost = clamp01(lerp(from.fogBoost, to.fogBoost, progress));
	out.windMultiplier = clamp(lerp(from.windMultiplier, to.windMultiplier, progress), 0.4, 2);
	out.temperatureOffset = clamp(
		lerp(from.temperatureOffset, to.temperatureOffset, progress),
		-12,
		12
	);
	out.tintR = clamp01(lerp(from.tintR, to.tintR, progress));
	out.tintG = clamp01(lerp(from.tintG, to.tintG, progress));
	out.tintB = clamp01(lerp(from.tintB, to.tintB, progress));
}

function sanitizeParameters(
	value: Partial<SpecialWeatherParameters> | undefined,
	fallback: Readonly<SpecialWeatherParameters>
): SpecialWeatherParameters {
	const result = createSpecialWeatherParameters();
	for (const key of Object.keys(result) as (keyof SpecialWeatherParameters)[]) {
		const raw = value?.[key];
		result[key] = Number.isFinite(raw) ? (raw as number) : fallback[key];
	}
	return result;
}

function dominantKind(
	current: SpecialWeatherKind,
	target: SpecialWeatherKind,
	transition: number
): SpecialWeatherKind {
	return transition >= 0.5 ? target : current;
}

function smootherstep(value: number): number {
	const t = clamp01(value);
	return t * t * t * (t * (t * 6 - 15) + 10);
}

function unitHash(seed: number, index: number, salt: number): number {
	return hashUint32(seed ^ Math.imul(index >>> 0, 0x9e3779b1) ^ salt) / 4294967296;
}

function safePositive(value: number): number {
	return Number.isFinite(value) && value > 0 ? value : 0;
}

function safeUnit(value: number): number {
	return Number.isFinite(value) ? clamp01(value) : 0;
}

function nonNegative(value: number): number {
	return Number.isFinite(value) && value >= 0 ? value : 0;
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}
