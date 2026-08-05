import { clamp01, lerp } from '../EnvironmentMath';
import type { WeatherFrameState } from './WeatherState';
import type { PrecipitationFrameState } from './PrecipitationState';

export interface WeatherFogFrameState {
	density: number;
	rainHaze: number;
	visibility: number;
}

/** Derives weather fog from humidity, scheduled fog and active precipitation. */
export class FogController {
	private readonly frame: WeatherFogFrameState = {
		density: 0,
		rainHaze: 0,
		visibility: 1
	};

	get currentState(): Readonly<WeatherFogFrameState> {
		return this.frame;
	}

	update(
		weather: Readonly<WeatherFrameState>,
		precipitation: Readonly<PrecipitationFrameState>
	): void {
		const humidityFog = clamp01((weather.parameters.humidity - 0.68) * 0.35);
		const rainHaze = clamp01(precipitation.intensity * 0.28);
		const density = clamp01(weather.parameters.fogDensity + humidityFog + rainHaze);

		this.frame.density = density;
		this.frame.rainHaze = rainHaze;
		this.frame.visibility = lerp(1, 0.22, density);
	}
}
