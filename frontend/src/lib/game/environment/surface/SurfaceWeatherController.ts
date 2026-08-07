import { clamp01, smoothstep } from '../EnvironmentMath';
import type { ClimateFrameState } from '../climate/ClimateState';
import type { PrecipitationFrameState } from '../weather/PrecipitationState';
import type { WindFrameState } from '../wind/WindState';
import {
	createSurfaceWeatherFrameState,
	type SurfaceWeatherFrameState,
	type SurfaceWeatherSaveState
} from './SurfaceWeatherState';

/** Accumulates wetness, snow and frost without editing voxel data. */
export class SurfaceWeatherController {
	private readonly frame = createSurfaceWeatherFrameState();

	get currentState(): Readonly<SurfaceWeatherFrameState> {
		return this.frame;
	}

	update(
		deltaSeconds: number,
		climate: Readonly<ClimateFrameState>,
		precipitation: Readonly<PrecipitationFrameState>,
		sunAltitude: number,
		wind: Readonly<WindFrameState>
	): void {
		if (this.frame.paused || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
			return;
		}

		this.frame.elapsedSeconds += deltaSeconds;
		const daylightDrying = smoothstep(-0.05, 0.7, finiteOr(sunAltitude, 0));
		const warmth = smoothstep(1, 24, climate.temperatureCelsius);
		const windDrying = clamp01(wind.strength + wind.gust * 0.25);
		const rain = clamp01(precipitation.rainIntensity);
		const snow = clamp01(precipitation.snowIntensity);
		const wetTarget = clamp01(rain + snow * 0.32);
		const wetResponse =
			wetTarget > this.frame.wetness
				? 1.8
				: 0.035 + daylightDrying * warmth * 0.11 + windDrying * 0.035;
		this.frame.wetness = damp(this.frame.wetness, wetTarget, wetResponse, deltaSeconds);

		const coldEnough = 1 - smoothstep(-1, 3, climate.temperatureCelsius);
		const snowTarget = clamp01(smoothstep(0.05, 0.65, snow) * coldEnough);
		const meltResponse = 0.012 + warmth * daylightDrying * 0.09 + rain * 0.14;
		this.frame.snowCoverage = damp(
			this.frame.snowCoverage,
			snowTarget,
			snowTarget > this.frame.snowCoverage ? 0.18 : meltResponse,
			deltaSeconds
		);

		const frostTarget = clamp01(
			climate.frostPotential * Math.max(this.frame.wetness, climate.humidity * 0.45) * (1 - rain)
		);
		this.frame.frost = damp(
			this.frame.frost,
			frostTarget,
			frostTarget > this.frame.frost ? 0.08 : 0.04 + warmth * 0.16,
			deltaSeconds
		);
	}

	pause(): void {
		this.frame.paused = true;
	}

	resume(): void {
		this.frame.paused = false;
	}

	serialize(): SurfaceWeatherSaveState {
		return {
			elapsedSeconds: this.frame.elapsedSeconds,
			paused: this.frame.paused,
			wetness: this.frame.wetness,
			snowCoverage: this.frame.snowCoverage,
			frost: this.frame.frost
		};
	}

	restore(save: SurfaceWeatherSaveState | null | undefined): void {
		if (!save) {
			return;
		}

		this.frame.elapsedSeconds =
			Number.isFinite(save.elapsedSeconds) && save.elapsedSeconds >= 0 ? save.elapsedSeconds : 0;
		this.frame.paused = save.paused === true;
		this.frame.wetness = safeUnit(save.wetness);
		this.frame.snowCoverage = safeUnit(save.snowCoverage);
		this.frame.frost = safeUnit(save.frost);
	}
}

function safeUnit(value: number): number {
	if (value === Number.POSITIVE_INFINITY) {
		return 1;
	}
	return Number.isFinite(value) ? clamp01(value) : 0;
}

function damp(current: number, target: number, response: number, deltaSeconds: number): number {
	const alpha = 1 - Math.exp(-Math.max(0, response) * Math.max(0, deltaSeconds));
	return clamp01(current + (target - current) * alpha);
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}
