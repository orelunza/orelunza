import { clamp01, lerp } from '../EnvironmentMath';
import type { WeatherFrameState } from './WeatherState';
import type { WindFrameState } from '../wind/WindState';
import {
	createPrecipitationFrameState,
	snowBlendForWeather,
	type PrecipitationFrameState,
	type PrecipitationSaveState
} from './PrecipitationState';

/** Renderer-free precipitation authority shared by rain and splash renderers. */
export class PrecipitationSystem {
	private readonly frame = createPrecipitationFrameState();

	get currentState(): Readonly<PrecipitationFrameState> {
		return this.frame;
	}

	update(
		deltaSeconds: number,
		weather: Readonly<WeatherFrameState>,
		wind: Readonly<WindFrameState>,
		shelter: number
	): void {
		if (!this.frame.paused && Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
			this.frame.elapsedSeconds += deltaSeconds;
		}

		const snowBlend = snowBlendForWeather(weather.current, weather.next, weather.transition);
		const rainIntensity = clamp01(weather.parameters.precipitation * (1 - snowBlend));
		const safeShelter = clamp01(shelter);
		const visible = rainIntensity * (1 - safeShelter);
		const windScale = lerp(2.5, 14, clamp01(wind.strength + wind.gust * 0.35));

		this.frame.kind = rainIntensity > 0.005 ? 'rain' : 'none';
		this.frame.intensity = rainIntensity;
		this.frame.visibleIntensity = visible;
		this.frame.shelter = safeShelter;
		this.frame.windX = finiteOr(wind.directionX, 1) * windScale;
		this.frame.windZ = finiteOr(wind.directionZ, 0) * windScale;
		this.frame.fallSpeed = lerp(16, 29, rainIntensity);
		this.frame.splashIntensity = clamp01(visible * lerp(0.45, 1, rainIntensity));
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
			visibleIntensity: this.frame.visibleIntensity
		};
	}

	restore(save: PrecipitationSaveState | null | undefined): void {
		if (!save) {
			return;
		}

		this.frame.elapsedSeconds =
			Number.isFinite(save.elapsedSeconds) && save.elapsedSeconds >= 0 ? save.elapsedSeconds : 0;
		this.frame.paused = save.paused === true;
		this.frame.visibleIntensity = clamp01(save.visibleIntensity);
	}
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}
