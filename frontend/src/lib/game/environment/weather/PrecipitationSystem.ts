import { clamp01, lerp } from '../EnvironmentMath';
import type { ClimateFrameState } from '../climate/ClimateState';
import type { WeatherFrameState } from './WeatherState';
import type { WindFrameState } from '../wind/WindState';
import {
	createPrecipitationFrameState,
	type PrecipitationFrameState,
	type PrecipitationSaveState
} from './PrecipitationState';

/** Renderer-free precipitation authority shared by rain, snow and splash renderers. */
export class PrecipitationSystem {
	private readonly frame = createPrecipitationFrameState();

	get currentState(): Readonly<PrecipitationFrameState> {
		return this.frame;
	}

	update(
		deltaSeconds: number,
		weather: Readonly<WeatherFrameState>,
		wind: Readonly<WindFrameState>,
		shelter: number,
		climate?: Readonly<ClimateFrameState>
	): void {
		if (!this.frame.paused && Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
			this.frame.elapsedSeconds += deltaSeconds;
		}

		const total = clamp01(weather.parameters.precipitation);
		const snowBlend = clamp01(climate?.snowBlend ?? (weather.current === 'snow' ? total : 0));
		const snowIntensity = Math.min(total, snowBlend);
		const rainIntensity = clamp01(total - snowIntensity);
		const safeShelter = clamp01(shelter);
		const exposure = 1 - safeShelter;
		const visibleRain = rainIntensity * exposure;
		const visibleSnow = snowIntensity * exposure;
		const visible = clamp01(visibleRain + visibleSnow);
		const windScale = lerp(2.5, 14, clamp01(wind.strength + wind.gust * 0.35));

		this.frame.kind = resolveKind(rainIntensity, snowIntensity);
		this.frame.intensity = total;
		this.frame.rainIntensity = rainIntensity;
		this.frame.snowIntensity = snowIntensity;
		this.frame.visibleIntensity = visible;
		this.frame.visibleRainIntensity = visibleRain;
		this.frame.visibleSnowIntensity = visibleSnow;
		this.frame.shelter = safeShelter;
		this.frame.windX = finiteOr(wind.directionX, 1) * windScale;
		this.frame.windZ = finiteOr(wind.directionZ, 0) * windScale;
		this.frame.fallSpeed = lerp(16, 29, rainIntensity);
		this.frame.snowFallSpeed = lerp(2.2, 5.4, snowIntensity);
		this.frame.splashIntensity = clamp01(visibleRain * lerp(0.45, 1, rainIntensity));
	}

	pause(): void {
		this.frame.paused = true;
	}

	resume(): void {
		this.frame.paused = false;
	}

	serialize(): PrecipitationSaveState {
		return {
			elapsedSeconds: this.frame.elapsedSeconds,
			paused: this.frame.paused,
			visibleIntensity: this.frame.visibleIntensity,
			visibleRainIntensity: this.frame.visibleRainIntensity,
			visibleSnowIntensity: this.frame.visibleSnowIntensity
		};
	}

	restore(save: PrecipitationSaveState | null | undefined): void {
		if (!save) {
			return;
		}

		this.frame.elapsedSeconds =
			Number.isFinite(save.elapsedSeconds) && save.elapsedSeconds >= 0 ? save.elapsedSeconds : 0;
		this.frame.paused = save.paused === true;
		this.frame.visibleIntensity = safeUnit(save.visibleIntensity);
		this.frame.visibleRainIntensity = safeUnit(save.visibleRainIntensity ?? save.visibleIntensity);
		this.frame.visibleSnowIntensity = safeUnit(save.visibleSnowIntensity ?? 0);
	}
}

function resolveKind(rain: number, snow: number): PrecipitationFrameState['kind'] {
	if (rain <= 0.005 && snow <= 0.005) {
		return 'none';
	}
	if (rain > 0.005 && snow > 0.005) {
		return 'mixed';
	}
	return snow > rain ? 'snow' : 'rain';
}

function safeUnit(value: number): number {
	return Number.isFinite(value) ? clamp01(value) : 0;
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}
